import { supabase } from './supabase-client.js';

document.addEventListener('DOMContentLoaded', async () => {
    const notification = document.getElementById('save-notification');
    let currentQuote = null;
    let currentClient = null;
    let services = [];
    let hasInitializedListeners = false;
    
    const urlParams = new URLSearchParams(window.location.search);
    const quoteId = urlParams.get('quote_id');

    if (!quoteId) {
        document.querySelector('main').innerHTML = '<h1>Orçamento não encontrado.</h1>';
        return;
    }

    // --- CARREGAMENTO DE DADOS ---
    async function loadData() {
        try {
            const [quoteRes, servicesRes] = await Promise.all([
                supabase.from('quotes').select('*, clients(*)').eq('id', quoteId).single(),
                supabase.from('services').select('*')
            ]);
            
            if (quoteRes.error || !quoteRes.data) throw quoteRes.error || new Error('Orçamento não encontrado.');
            if (servicesRes.error) throw servicesRes.error;

            currentQuote = quoteRes.data;
            currentClient = quoteRes.data.clients;
            services = servicesRes.data;
            
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

    // --- RENDERIZAÇÃO ---
    function populatePage() {
        // Resumo do Evento
        document.getElementById('summary-client-name').textContent = currentQuote.client_name;
        document.getElementById('summary-guest-count').textContent = currentQuote.quote_data.guest_count;
        document.getElementById('summary-total-value').textContent = formatCurrency(currentQuote.total_value);
        document.getElementById('view-quote-link').href = `index.html?quote_id=${quoteId}`;
        const eventDates = currentQuote.quote_data.event_dates.map(d => new Date(d.date + 'T12:00:00Z').toLocaleDateString('pt-BR')).join(', ');
        document.getElementById('summary-event-dates').textContent = eventDates;
        
        // Dados do Cliente
        populateClientForm();
        
        // Seções dinâmicas
        renderServicesSummary();
        renderPayments();
    }

    function populateClientForm() {
        document.getElementById('client-name').value = currentQuote.client_name || '';
        document.getElementById('client-cnpj').value = currentQuote.quote_data.client_cnpj || currentQuote.clients?.cnpj || '';
        document.getElementById('client-email').value = currentQuote.quote_data.client_email || currentQuote.clients?.email ||'';
        document.getElementById('client-phone').value = currentQuote.quote_data.client_phone || currentQuote.clients?.phone || '';
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

        const itemsByCategory = items.reduce((acc, item) => {
            const service = services.find(s => s.id === item.service_id);
            if (!service) return acc;
            const category = service.category || 'Outros';
            if (!acc[category]) acc[category] = [];
            acc[category].push({ ...item, name: service.name });
            return acc;
        }, {});

        let html = '';
        const categoryOrder = ['Espaço', 'Gastronomia', 'Equipamentos', 'Serviços e Outros'];
        
        categoryOrder.forEach(category => {
            if(itemsByCategory[category]) {
                html += `<div class="service-summary-category"><h3>${category}</h3>`;
                itemsByCategory[category].forEach(item => {
                    html += `<div class="service-summary-item"><span>${item.name}</span><span>${item.quantity} x ${formatCurrency(item.calculated_unit_price)}</span></div>`;
                });
                if (category === 'Gastronomia') {
                    html += `<button id="define-cardapio-btn" class="btn btn-primary" style="margin-top: 1rem;">Definir Cardápio</button>`;
                }
                html += `</div>`;
            }
        });
        container.innerHTML = html || '<p>Não foi possível detalhar os serviços.</p>';
    }

    // --- EVENT LISTENERS E AÇÕES ---
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
            if (e.target.matches('#define-cardapio-btn')) {
                // CORRIGIDO: Redireciona para a proposta correta para edição
                window.location.href = `index.html?quote_id=${quoteId}`;
            }
        });
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

        const { data: savedClient, error: clientError } = await supabase.from('clients').upsert(clientData).select().single();
        if (clientError) { showNotification('Erro ao salvar cliente.', true); console.error(clientError); return; }
        
        let quoteUpdateData = { client_name: savedClient.name };
        if (!currentQuote.client_id) {
             quoteUpdateData.client_id = savedClient.id;
        }

        const { error: quoteError } = await supabase.from('quotes').update(quoteUpdateData).eq('id', quoteId);
        if (quoteError) { showNotification('Erro ao vincular cliente ao orçamento.', true); console.error(quoteError); return; }
        
        showNotification('Dados do cliente salvos com sucesso!');
        await loadData(); // Recarrega os dados para garantir consistência
    }

    function handleAddPayment() {
        if (!currentQuote) return;
        if (!currentQuote.quote_data.payments) currentQuote.quote_data.payments = [];
        currentQuote.quote_data.payments.push({ due_date: '', amount: 0, method: '', status: 'A Pagar' });
        renderPayments();
        saveQuoteData();
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
        if (error) { showNotification('Erro ao salvar dados.', true); } 
        else { showNotification(message); }
    }

    function formatCurrency(value) { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(parseFloat(value) || 0); }
    function showNotification(message, isError = false) { notification.textContent = message; notification.style.backgroundColor = isError ? 'var(--danger-color)' : 'var(--success-color)'; notification.classList.add('show'); setTimeout(() => notification.classList.remove('show'), 4000); }

    loadData();
});
