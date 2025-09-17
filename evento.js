import { supabase } from './supabase-client.js';

document.addEventListener('DOMContentLoaded', async () => {
    const notification = document.getElementById('save-notification');
    let currentQuote = null;
    let currentClient = null;
    let services = [];
    let cardapioItems = [];
    let hasInitializedListeners = false;
    let selectedCardapioServiceId = null;
    let saveTimeout;

    const urlParams = new URLSearchParams(window.location.search);
    const quoteId = urlParams.get('quote_id');

    if (!quoteId) {
        document.querySelector('main').innerHTML = '<h1>Orçamento não encontrado.</h1>';
        return;
    }

    async function loadData() {
        try {
            const [quoteRes, servicesRes, cardapioItemsRes] = await Promise.all([
                supabase.from('quotes').select('*, clients(*)').eq('id', quoteId).single(),
                supabase.from('services').select('*'),
                supabase.from('cardapio_items').select('*').order('name')
            ]);
            
            if (quoteRes.error || !quoteRes.data) throw quoteRes.error || new Error('Orçamento não encontrado.');
            if (servicesRes.error) throw servicesRes.error;
            if (cardapioItemsRes.error) throw cardapioItemsRes.error;

            currentQuote = quoteRes.data;
            currentClient = currentQuote.clients;
            services = servicesRes.data;
            cardapioItems = cardapioItemsRes.data;
            
            if (!currentQuote.quote_data.selected_cardapio) {
                currentQuote.quote_data.selected_cardapio = {};
            }

            populatePage();
            if (!hasInitializedListeners) {
                setupEventListeners();
                hasInitializedListeners = true;
            }

        } catch (error) {
            showNotification('Erro ao carregar dados do evento.', true);
            console.error(error);
        }
    }

    function populatePage() {
        document.getElementById('summary-client-name').textContent = currentQuote.client_name;
        document.getElementById('summary-guest-count').textContent = currentQuote.quote_data.guest_count;
        document.getElementById('summary-total-value').textContent = formatCurrency(currentQuote.total_value);
        document.getElementById('view-quote-link').href = `index.html?quote_id=${quoteId}`;
        
        const firstEventDate = currentQuote.quote_data.event_dates[0];
        if (firstEventDate) {
            document.getElementById('summary-event-dates').textContent = new Date(firstEventDate.date + 'T12:00:00Z').toLocaleDateString('pt-BR');
            document.getElementById('summary-event-times').textContent = `${firstEventDate.start || ''} - ${firstEventDate.end || ''}`;
        }
        
        populateClientForm();
        renderServicesSummary();
        renderPayments();
    }

    function populateClientForm() {
        document.getElementById('client-name').value = currentQuote.client_name || '';
        document.getElementById('client-cnpj').value = currentQuote.quote_data.client_cnpj || currentClient?.cnpj || '';
        document.getElementById('client-email').value = currentQuote.quote_data.client_email || currentClient?.email ||'';
        document.getElementById('client-phone').value = currentQuote.quote_data.client_phone || currentClient?.phone || '';
        if (currentClient) {
            document.getElementById('client-legal-name').value = currentClient.legal_name || '';
            document.getElementById('client-state-reg').value = currentClient.state_registration || '';
            document.getElementById('client-rep-name').value = currentClient.legal_rep_name || '';
            document.getElementById('client-rep-cpf').value = currentClient.legal_rep_cpf || '';
            if (currentClient.address) {
                document.getElementById('client-address-street').value = currentClient.address.street || '';
                document.getElementById('client-address-city').value = currentClient.address.city || '';
                document.getElementById('client-address-state').value = currentClient.address.state || '';
                document.getElementById('client-address-zip').value = currentClient.address.zip || '';
            }
        }
    }
    
    function renderPayments() {
        const tbody = document.getElementById('payments-table')?.querySelector('tbody');
        if (!tbody) return;
        tbody.innerHTML = '';
        const payments = currentQuote.quote_data.payments || [];
        
        payments.forEach((payment, index) => {
            const row = tbody.insertRow();
            row.innerHTML = `
                <td><input type="date" class="payment-input" data-index="${index}" data-field="due_date" value="${payment.due_date || ''}"></td>
                <td><input type="number" step="0.01" class="payment-input" data-index="${index}" data-field="amount" value="${payment.amount || 0}"></td>
                <td><input type="text" class="payment-input" data-index="${index}" data-field="method" value="${payment.method || ''}"></td>
                <td>
                    <select class="payment-input" data-index="${index}" data-field="status">
                        <option value="A Pagar" ${payment.status === 'A Pagar' ? 'selected' : ''}>A Pagar</option>
                        <option value="Pago" ${payment.status === 'Pago' ? 'selected' : ''}>Pago</option>
                    </select>
                </td>
                <td><button class="btn-remove remove-payment-btn" data-index="${index}">&times;</button></td>
            `;
        });
    }

    function renderServicesSummary() {
        const container = document.getElementById('services-summary-container');
        const items = currentQuote?.quote_data?.items;
        if (!container || !items || items.length === 0) {
            container.innerHTML = '<p>Nenhum serviço contratado encontrado.</p>';
            return;
        }

        // Agrupa os serviços por categoria
        const itemsByCategory = items.reduce((acc, item) => {
            const service = services.find(s => s.id === item.service_id);
            if (service) {
                const category = service.category || 'Outros';
                if (!acc[category]) {
                    acc[category] = [];
                }
                acc[category].push({ ...item, service_name: service.name });
            }
            return acc;
        }, {});
        
        let finalHtml = '';
        const categoryOrder = ['Espaço', 'Gastronomia', 'Equipamentos', 'Serviços e Outros'];

        categoryOrder.forEach(category => {
            if (itemsByCategory[category]) {
                finalHtml += `<div class="sub-section service-category-group"><h4>${category}</h4>`;
                finalHtml += `<div class="table-container">
                    <table class="services-table">
                        <thead>
                            <tr>
                                <th>Serviço / Item</th>
                                <th>Data</th>
                                <th>Início</th>
                                <th>Término</th>
                                <th>Ações</th>
                            </tr>
                        </thead>
                        <tbody>`;
                
                itemsByCategory[category].forEach((item, index) => {
                    const itemIdentifier = `${item.service_id}-${item.event_date}`;
                    const eventDateInfo = currentQuote.quote_data.event_dates.find(d => d.date === item.event_date);
                    const date = eventDateInfo ? new Date(eventDateInfo.date + 'T12:00:00Z').toLocaleDateString('pt-BR') : 'N/A';
                    
                    // Se o item não tiver horário próprio, usa o do evento como padrão
                    const startTime = item.start_time || eventDateInfo?.start || '';
                    const endTime = item.end_time || eventDateInfo?.end || '';

                    let actionButton = '';
                    if (category === 'Gastronomia') {
                        actionButton = `<button class="btn define-cardapio-btn" data-service-id="${item.service_id}">Definir Cardápio</button>`;
                    }

                    finalHtml += `
                        <tr>
                            <td>${item.service_name}</td>
                            <td>${date}</td>
                            <td><input type="time" class="service-time-input" data-id="${itemIdentifier}" data-field="start_time" value="${startTime}"></td>
                            <td><input type="time" class="service-time-input" data-id="${itemIdentifier}" data-field="end_time" value="${endTime}"></td>
                            <td class="actions">${actionButton}</td>
                        </tr>
                    `;
                });

                finalHtml += '</tbody></table></div></div>';
            }
        });

        container.innerHTML = finalHtml || '<p>Nenhum serviço encontrado.</p>';
    }

    function openCardapioModal(serviceId) {
        selectedCardapioServiceId = serviceId;
        const service = services.find(s => s.id === serviceId);
        document.getElementById('cardapio-modal-title').textContent = `Definir Itens para "${service.name}"`;
        populateCardapioModal(serviceId);
        document.getElementById('cardapioModal').style.display = 'block';
    }

    function populateCardapioModal(serviceId) {
        const checklistContainer = document.getElementById('cardapio-items-checklist');
        checklistContainer.innerHTML = '<div>Carregando itens...</div>';

        const selectedItemIds = new Set(currentQuote.quote_data.selected_cardapio[serviceId] || []);

        if (cardapioItems.length > 0) {
            checklistContainer.innerHTML = cardapioItems.map(item => `
                <div class="checkbox-item">
                    <input type="checkbox" id="item-${item.id}" value="${item.id}" ${selectedItemIds.has(item.id) ? 'checked' : ''}>
                    <label for="item-${item.id}">${item.name}</label>
                </div>
            `).join('');
        } else {
            checklistContainer.innerHTML = '<div>Nenhum item de cardápio cadastrado.</div>';
        }
    }
    
    async function handleCardapioSave() {
        if (!selectedCardapioServiceId) return;

        const checklistContainer = document.getElementById('cardapio-items-checklist');
        const selectedInputs = checklistContainer.querySelectorAll('input[type="checkbox"]:checked');
        const selectedItemIds = Array.from(selectedInputs).map(input => input.value);
        
        currentQuote.quote_data.selected_cardapio[selectedCardapioServiceId] = selectedItemIds;
        
        await saveQuoteData('Cardápio salvo com sucesso!');
        closeCardapioModal();
    }

    function closeCardapioModal() {
        document.getElementById('cardapioModal').style.display = 'none';
        selectedCardapioServiceId = null;
    }

    function setupEventListeners() {
        document.getElementById('client-details-form').addEventListener('submit', handleClientFormSubmit);
        document.getElementById('add-payment-btn').addEventListener('click', handleAddPayment);
        
        const paymentsTable = document.getElementById('payments-table');
        paymentsTable.addEventListener('change', handlePaymentChange);
        paymentsTable.addEventListener('click', handlePaymentClick);
        
        document.body.addEventListener('click', (e) => {
            const header = e.target.closest('.collapsible-card > .card-header');
            if (header) {
                header.closest('.collapsible-card')?.classList.toggle('collapsed');
            }
            const defineCardapioBtn = e.target.closest('.define-cardapio-btn');
            if (defineCardapioBtn) {
                const serviceId = defineCardapioBtn.dataset.serviceId;
                openCardapioModal(serviceId);
            }
        });

        // Listener para salvar horários dos serviços
        document.getElementById('services-summary-container').addEventListener('change', handleServiceTimeChange);

        document.getElementById('close-cardapio-modal-btn').addEventListener('click', closeCardapioModal);
        document.getElementById('save-cardapio-btn').addEventListener('click', handleCardapioSave);
    }

    async function handleClientFormSubmit(e) {
        e.preventDefault();
        const clientData = {
            id: currentClient?.id, 
            name: document.getElementById('client-name').value,
            cnpj: document.getElementById('client-cnpj').value,
            email: document.getElementById('client-email').value,
            phone: document.getElementById('client-phone').value,
            legal_name: document.getElementById('client-legal-name').value,
            state_registration: document.getElementById('client-state-reg').value,
            legal_rep_name: document.getElementById('client-rep-name').value,
            legal_rep_cpf: document.getElementById('client-rep-cpf').value,
            address: { street: document.getElementById('client-address-street').value, city: document.getElementById('client-address-city').value, state: document.getElementById('client-address-state').value, zip: document.getElementById('client-address-zip').value }
        };

        const { data: savedClient, error: clientError } = await supabase.from('clients').upsert(clientData, { onConflict: 'id' }).select().single();
        if (clientError) { showNotification('Erro ao salvar cliente.', true); console.error(clientError); return; }
        
        let quoteUpdateData = { client_name: savedClient.name };
        if (!currentQuote.client_id) {
             quoteUpdateData.client_id = savedClient.id;
        }

        const { error: quoteError } = await supabase.from('quotes').update(quoteUpdateData).eq('id', quoteId);
        if (quoteError) { showNotification('Erro ao vincular cliente ao orçamento.', true); console.error(quoteError); return; }
        
        showNotification('Dados do cliente salvos com sucesso!');
        await loadData();
    }

    function handleAddPayment() {
        if (!currentQuote) return;
        if (!currentQuote.quote_data.payments) currentQuote.quote_data.payments = [];
        currentQuote.quote_data.payments.push({ due_date: '', amount: 0, method: '', status: 'A Pagar' });
        renderPayments();
        saveQuoteData();
    }
    
    function handleServiceTimeChange(e) {
        if (e.target.classList.contains('service-time-input')) {
            const itemIdentifier = e.target.dataset.id;
            const field = e.target.dataset.field;
            const value = e.target.value;

            const itemIndex = currentQuote.quote_data.items.findIndex(item => `${item.service_id}-${item.event_date}` === itemIdentifier);
            
            if (itemIndex !== -1) {
                currentQuote.quote_data.items[itemIndex][field] = value;
                
                // Debounce o salvamento para não salvar a cada keystroke
                clearTimeout(saveTimeout);
                saveTimeout = setTimeout(() => {
                    saveQuoteData('Horário salvo.');
                }, 1000);
            }
        }
    }

    async function handlePaymentChange(e) {
        if (e.target.classList.contains('payment-input')) {
            const index = e.target.dataset.index;
            const field = e.target.dataset.field;
            let value = e.target.value;
            if (e.target.type === 'number') value = parseFloat(value) || 0;
            currentQuote.quote_data.payments[index][field] = value;
            await saveQuoteData('Parcela salva!');
        }
    }

    async function handlePaymentClick(e) {
        if (e.target.classList.contains('remove-payment-btn')) {
            const index = e.target.dataset.index;
            currentQuote.quote_data.payments.splice(index, 1);
            renderPayments();
            await saveQuoteData('Parcela removida!');
        }
    }

    async function saveQuoteData(message = 'Dados salvos.') {
        if (!currentQuote) return;
        const { error } = await supabase.from('quotes').update({ quote_data: currentQuote.quote_data }).eq('id', quoteId);
        if (error) { showNotification('Erro ao salvar dados.', true); console.error(error); } 
        else { showNotification(message); }
    }

    function formatCurrency(value) { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(parseFloat(value) || 0); }
    function showNotification(message, isError = false) { notification.textContent = message; notification.style.backgroundColor = isError ? 'var(--danger-color)' : 'var(--success-color)'; notification.classList.add('show'); setTimeout(() => notification.classList.remove('show'), 4000); }

    loadData();
});
