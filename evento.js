import { supabase } from './supabase-client.js';

document.addEventListener('DOMContentLoaded', async () => {
    const notification = document.getElementById('save-notification');
    let currentQuote = null;
    let currentClient = null;
    let services = [];
    let cardapioItems = [];
    let productionStagesTemplate = []; // Molde do funil
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
            const [quoteRes, servicesRes, cardapioItemsRes, stagesRes] = await Promise.all([
                supabase.from('quotes').select('*, clients(*)').eq('id', quoteId).single(),
                supabase.from('services').select('*'),
                supabase.from('menu_items').select('*').order('name'),
                supabase.from('production_stages').select('*').order('stage_order')
            ]);
            
            if (quoteRes.error || !quoteRes.data) throw quoteRes.error || new Error('Orçamento não encontrado.');
            if (servicesRes.error) throw servicesRes.error;
            if (cardapioItemsRes.error) throw cardapioItemsRes.error;
            if (stagesRes.error) throw stagesRes.error;

            currentQuote = quoteRes.data;
            currentClient = currentQuote.clients;
            services = servicesRes.data;
            cardapioItems = cardapioItemsRes.data;
            productionStagesTemplate = stagesRes.data;
            
            // Inicializa estruturas de dados se não existirem
            if (!currentQuote.quote_data.selected_cardapio) currentQuote.quote_data.selected_cardapio = {};
            if (!currentQuote.quote_data.production_data) currentQuote.quote_data.production_data = {};

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
        renderProductionFunnel();
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

    function createDateSelect(selectedDate, availableDates, itemIdentifier) {
        if (!availableDates || availableDates.length === 0) return 'N/A';
        
        const options = availableDates.map(d => {
            const formattedDate = new Date(d.date + 'T12:00:00Z').toLocaleDateString('pt-BR');
            return `<option value="${d.date}" ${d.date === selectedDate ? 'selected' : ''}>${formattedDate}</option>`;
        }).join('');

        return `<select class="service-date-select" data-id="${itemIdentifier}">${options}</select>`;
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
            if (service) {
                const category = service.category || 'Outros';
                if (!acc[category]) acc[category] = [];
                acc[category].push({ ...item, service_name: service.name });
            }
            return acc;
        }, {});
        
        let tableHtml = `<div class="table-container">
            <table class="services-table">
                <thead>
                    <tr>
                        <th>Serviço / Item</th>
                        <th class="quantity-column">Qtde.</th>
                        <th>Data</th>
                        <th>Início</th>
                        <th>Término</th>
                        <th>Ações</th>
                    </tr>
                </thead>
                <tbody>`;
        
        const categoryOrder = ['Espaço', 'Gastronomia', 'Equipamentos', 'Serviços e Outros'];

        categoryOrder.forEach(category => {
            if (itemsByCategory[category]) {
                tableHtml += `<tr class="category-divider-row"><td colspan="6">${category}</td></tr>`;
                
                itemsByCategory[category].forEach((item, index) => {
                    const itemIdentifier = `${item.service_id}-${index}`; // Usar o índice para um ID único na tela
                    const eventDateInfo = currentQuote.quote_data.event_dates.find(d => d.date === item.event_date);
                    
                    const startTime = item.start_time || eventDateInfo?.start || '';
                    const endTime = item.end_time || eventDateInfo?.end || '';

                    let actionButton = '';
                    if (category === 'Gastronomia') {
                        actionButton = `<button class="btn define-cardapio-btn" data-service-id="${item.service_id}">Definir Cardápio</button>`;
                    }

                    tableHtml += `
                        <tr>
                            <td>${item.service_name}</td>
                            <td class="quantity-column">${item.quantity}</td>
                            <td>${createDateSelect(item.event_date, currentQuote.quote_data.event_dates, itemIdentifier)}</td>
                            <td><input type="time" class="service-time-input" data-id="${itemIdentifier}" data-field="start_time" value="${startTime}"></td>
                            <td><input type="time" class="service-time-input" data-id="${itemIdentifier}" data-field="end_time" value="${endTime}"></td>
                            <td class="actions">${actionButton}</td>
                        </tr>
                    `;
                });
            }
        });

        tableHtml += '</tbody></table></div>';
        container.innerHTML = tableHtml;
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

        const selectedItemIds = new Set((currentQuote.quote_data.selected_cardapio[serviceId] || []).map(String));

        if (cardapioItems.length > 0) {
            checklistContainer.innerHTML = cardapioItems.map(item => `
                <div class="checkbox-item">
                    <input type="checkbox" id="item-${item.id}" value="${item.id}" ${selectedItemIds.has(String(item.id)) ? 'checked' : ''}>
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
        const selectedItemIds = Array.from(selectedInputs).map(input => parseInt(input.value));
        
        currentQuote.quote_data.selected_cardapio[selectedCardapioServiceId] = selectedItemIds;
        
        await saveQuoteData('Cardápio salvo com sucesso!');
        closeCardapioModal();
        renderProductionFunnel(); // Re-renderiza o funil para atualizar o status da etapa do cardápio
    }

    function closeCardapioModal() {
        document.getElementById('cardapioModal').style.display = 'none';
        selectedCardapioServiceId = null;
    }
    
    // =================================================================
    // FUNIL DE PRODUÇÃO (KANBAN)
    // =================================================================

    function renderProductionFunnel() {
        const container = document.getElementById('production-funnel-container');
        if (!container) return;
        container.innerHTML = '';

        currentQuote.quote_data.event_dates.forEach(eventDate => {
            const date = eventDate.date;
            if (!currentQuote.quote_data.production_data[date]) {
                initializeProductionDataForDate(date);
            }
            
            const dateData = currentQuote.quote_data.production_data[date];
            const formattedDate = new Date(date + 'T12:00:00Z').toLocaleDateString('pt-BR');
            
            const dateCard = document.createElement('details');
            dateCard.className = 'data-accordion';
            dateCard.open = true;

            let columnsHtml = productionStagesTemplate.map(stage => {
                let stageContentHtml = '';
                const stageData = dateData.stages[stage.id] || { tasks: [], deadline_days: stage.default_deadline_days };
                const observations = stageData.observations || '';
                
                // Lógica para a etapa de cardápio (exemplo, pode ser um tipo de etapa no futuro)
                if (stage.stage_name === 'Definição de Cardápio') {
                     const menuServices = currentQuote.quote_data.items.filter(i => {
                        const s = services.find(s => s.id === i.service_id);
                        return s && s.category === 'Gastronomia';
                    });
                    const allMenusDefined = menuServices.length > 0 && menuServices.every(ms => 
                        currentQuote.quote_data.selected_cardapio[ms.service_id]?.length > 0
                    );
                    stageData.completed = allMenusDefined;
                    stageContentHtml = `<div class="stage-status ${allMenusDefined ? 'status-completed' : 'status-pending'}">
                        ${allMenusDefined ? '✔ Cardápio Definido' : '❗ Cardápio Pendente'}
                    </div>`;
                } else { // Lógica para etapas de checklist
                    const tasks = stageData.tasks || [];
                    stageContentHtml = `<ul class="checklist">`;
                    tasks.forEach((task, taskIndex) => {
                        stageContentHtml += `
                            <li class="checklist-item">
                                <input type="checkbox" id="task-${date}-${stage.id}-${taskIndex}" 
                                       data-date="${date}" data-stage-id="${stage.id}" data-task-index="${taskIndex}" 
                                       ${task.completed ? 'checked' : ''}>
                                <label for="task-${date}-${stage.id}-${taskIndex}">${task.text}</label>
                                <button class="btn-remove-inline remove-task-btn" 
                                        data-date="${date}" data-stage-id="${stage.id}" data-task-index="${taskIndex}">&times;</button>
                            </li>`;
                    });
                    stageContentHtml += `</ul>`;
                }
                
                const { alertClass, deadlineText } = getDeadlineInfo(date, stageData.deadline_days);

                return `
                    <div class="production-stage-column ${alertClass}">
                        <div class="stage-header">
                            <h5>${stage.stage_name}</h5>
                            <div class="stage-deadline">
                                <span>Prazo: ${deadlineText}</span>
                                <input type="number" class="deadline-input" value="${stageData.deadline_days}" 
                                       data-date="${date}" data-stage-id="${stage.id}" title="Dias antes do evento">
                            </div>
                        </div>
                        <div class="stage-content">
                            <textarea class="stage-observations" placeholder="Observações da etapa..."
                                      data-date="${date}" data-stage-id="${stage.id}">${observations}</textarea>
                            ${stageContentHtml}
                        </div>
                        ${stage.stage_name !== 'Definição de Cardápio' ? `
                        <form class="inline-form add-task-form" data-date="${date}" data-stage-id="${stage.id}">
                            <input type="text" placeholder="Adicionar nova tarefa..." required>
                            <button type="submit" class="btn">Adicionar</button>
                        </form>` : ''}
                    </div>
                `;
            }).join('');

            dateCard.innerHTML = `
                <summary class="card-summary-header">
                    <h3>Produção para ${formattedDate}</h3>
                </summary>
                <div class="card-content">
                    <div class="kanban-board">${columnsHtml}</div>
                </div>
            `;
            container.appendChild(dateCard);
        });
    }

    function initializeProductionDataForDate(date) {
        const newProductionData = { stages: {} };
        productionStagesTemplate.forEach(stage => {
            newProductionData.stages[stage.id] = {
                deadline_days: stage.default_deadline_days,
                tasks: (stage.default_tasks || []).map(taskText => ({ text: taskText, completed: false })),
                observations: ''
            };
        });
        currentQuote.quote_data.production_data[date] = newProductionData;
    }
    
    function getDeadlineInfo(eventDateStr, deadlineDays) {
        const eventDate = new Date(eventDateStr + 'T23:59:59Z');
        const deadlineDate = new Date(eventDate);
        deadlineDate.setDate(eventDate.getDate() - deadlineDays);
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const oneWeekFromNow = new Date(today);
        oneWeekFromNow.setDate(today.getDate() + 7);

        let alertClass = '';
        if (deadlineDate < today) {
            alertClass = 'deadline-overdue'; // Atrasado
        } else if (deadlineDate <= oneWeekFromNow) {
            alertClass = 'deadline-soon'; // Vencendo
        }

        return {
            alertClass,
            deadlineText: deadlineDate.toLocaleDateString('pt-BR')
        };
    }
    
    // =================================================================
    // EVENT LISTENERS
    // =================================================================

    function setupEventListeners() {
        document.getElementById('client-details-form').addEventListener('submit', handleClientFormSubmit);
        document.getElementById('add-payment-btn').addEventListener('click', handleAddPayment);
        
        document.getElementById('payments-table').addEventListener('change', handlePaymentChange);
        document.getElementById('payments-table').addEventListener('click', handlePaymentClick);
        
        document.body.addEventListener('click', handleBodyClick);

        document.getElementById('services-summary-container').addEventListener('change', (e) => {
            handleServiceTimeChange(e);
            handleServiceDateChange(e);
        });

        document.getElementById('close-cardapio-modal-btn').addEventListener('click', closeCardapioModal);
        document.getElementById('save-cardapio-btn').addEventListener('click', handleCardapioSave);
        
        // Listeners para o Funil de Produção
        const funnelContainer = document.getElementById('production-funnel-container');
        funnelContainer.addEventListener('change', handleFunnelChange);
        funnelContainer.addEventListener('submit', handleFunnelSubmit);
        funnelContainer.addEventListener('click', handleFunnelClick);
        
        const printMenu = document.getElementById('print-menu');
        document.getElementById('print-btn')?.addEventListener('click', (e) => {
            e.stopPropagation();
            printMenu.classList.toggle('show');
        });
        printMenu?.addEventListener('click', (e) => {
            const action = e.target.dataset.action;
            if (action === 'print-summary') generateEventSummaryPrint();
            if (action === 'print-menu') generateMenuPrint();
            printMenu.classList.remove('show');
        });
    }

    function handleBodyClick(e) {
        // Colapsar cards
        const header = e.target.closest('.collapsible-card > .card-header, .collapsible-card > summary');
        if (header) {
            header.closest('.collapsible-card')?.classList.toggle('collapsed');
        }
        // Abrir modal de cardápio
        const defineCardapioBtn = e.target.closest('.define-cardapio-btn');
        if (defineCardapioBtn) {
            const serviceId = parseInt(defineCardapioBtn.dataset.serviceId);
            openCardapioModal(serviceId);
        }
        // Fechar menu de impressão
        const printMenu = document.getElementById('print-menu');
        if (printMenu && !e.target.closest('#print-btn')) {
            printMenu.classList.remove('show');
        }
    }
    
    // =================================================================
    // HANDLERS
    // =================================================================
    
    function handleFunnelChange(e) {
        const target = e.target;
        const date = target.dataset.date;
        const stageId = target.dataset.stageId;
        
        if (target.matches('.deadline-input')) {
            currentQuote.quote_data.production_data[date].stages[stageId].deadline_days = parseInt(target.value) || 0;
            renderProductionFunnel();
        } else if (target.matches('.checklist-item input[type="checkbox"]')) {
            const taskIndex = target.dataset.taskIndex;
            currentQuote.quote_data.production_data[date].stages[stageId].tasks[taskIndex].completed = target.checked;
        } else if (target.matches('.stage-observations')) {
            currentQuote.quote_data.production_data[date].stages[stageId].observations = target.value;
        }else {
            return;
        }
        saveQuoteData('Dados de produção salvos.');
    }

    function handleFunnelSubmit(e) {
        e.preventDefault();
        if (e.target.matches('.add-task-form')) {
            const form = e.target;
            const input = form.querySelector('input');
            const taskText = input.value.trim();
            if (!taskText) return;
            
            const date = form.dataset.date;
            const stageId = form.dataset.stageId;
            
            const stageData = currentQuote.quote_data.production_data[date].stages[stageId];
            if (!stageData.tasks) stageData.tasks = [];
            
            stageData.tasks.push({ text: taskText, completed: false });
            
            renderProductionFunnel();
            saveQuoteData('Tarefa adicionada.');
        }
    }

    function handleFunnelClick(e) {
        if (e.target.matches('.remove-task-btn')) {
            const button = e.target;
            const date = button.dataset.date;
            const stageId = button.dataset.stageId;
            const taskIndex = parseInt(button.dataset.taskIndex);
            
            currentQuote.quote_data.production_data[date].stages[stageId].tasks.splice(taskIndex, 1);
            renderProductionFunnel();
            saveQuoteData('Tarefa removida.');
        }
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

            const [serviceId, itemIndex] = itemIdentifier.split('-');
            
            if (currentQuote.quote_data.items[itemIndex]) {
                currentQuote.quote_data.items[itemIndex][field] = value;
                
                clearTimeout(saveTimeout);
                saveTimeout = setTimeout(() => {
                    saveQuoteData('Horário salvo.');
                }, 1000);
            }
        }
    }
    
    async function handleServiceDateChange(e) {
        if (e.target.classList.contains('service-date-select')) {
            const itemIdentifier = e.target.dataset.id;
            const newDate = e.target.value;

            const [serviceId, itemIndex] = itemIdentifier.split('-');

            if (currentQuote.quote_data.items[itemIndex]) {
                currentQuote.quote_data.items[itemIndex].event_date = newDate;
                
                delete currentQuote.quote_data.items[itemIndex].start_time;
                delete currentQuote.quote_data.items[itemIndex].end_time;

                await saveQuoteData('Data do serviço atualizada.');
                renderServicesSummary();
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

    // =================================================================
    // FUNÇÕES DE IMPRESSÃO
    // =================================================================
    function generateEventSummaryPrint() {
        const output = document.getElementById('print-output-evento');
        const firstDate = currentQuote.quote_data.event_dates[0];
        const formattedDate = firstDate ? new Date(firstDate.date + 'T12:00:00Z').toLocaleDateString('pt-BR') : 'N/A';

        let html = `
            <div class="print-header"><h1>Resumo do Evento</h1></div>
            <div class="print-client-info">
                <p><strong>Cliente:</strong> ${currentQuote.client_name}</p>
                <p><strong>Data:</strong> ${formattedDate}</p>
                <p><strong>Convidados:</strong> ${currentQuote.quote_data.guest_count}</p>
                <p><strong>Valor Total:</strong> ${formatCurrency(currentQuote.total_value)}</p>
            </div>
            <h2 class="print-category-title">Serviços Contratados</h2>
        `;

        const itemsByCategory = currentQuote.quote_data.items.reduce((acc, item) => {
            const service = services.find(s => s.id === item.service_id);
            if (service) {
                const category = service.category || 'Outros';
                if (!acc[category]) acc[category] = [];
                acc[category].push({ ...item, service_name: service.name });
            }
            return acc;
        }, {});

        Object.entries(itemsByCategory).forEach(([category, items]) => {
            html += `<h3 class="print-subcategory-title">${category}</h3>
                     <table class="print-table">
                        <thead><tr><th>Item</th><th>Qtde.</th><th>Data</th><th>Horário</th></tr></thead>
                        <tbody>`;
            items.forEach(item => {
                const eventDateInfo = currentQuote.quote_data.event_dates.find(d => d.date === item.event_date);
                const startTime = item.start_time || eventDateInfo?.start || '';
                const endTime = item.end_time || eventDateInfo?.end || '';
                const itemDate = new Date(item.event_date + 'T12:00:00Z').toLocaleDateString('pt-BR');
                html += `<tr>
                            <td>${item.service_name}</td>
                            <td>${item.quantity}</td>
                            <td>${itemDate}</td>
                            <td>${startTime} - ${endTime}</td>
                         </tr>`;
            });
            html += `</tbody></table>`;
        });

        output.innerHTML = html;
        window.print();
    }
    
    function generateMenuPrint() {
        const output = document.getElementById('print-output-evento');
        let html = `
            <div class="print-header"><h1>Cardápio do Evento</h1><p>${currentQuote.client_name}</p></div>
        `;
        
        const menuServices = currentQuote.quote_data.items.filter(i => {
            const s = services.find(s => s.id === i.service_id);
            return s && s.category === 'Gastronomia';
        });

        if (menuServices.length === 0) {
            html += '<p>Nenhum serviço de gastronomia contratado.</p>';
            output.innerHTML = html;
            window.print();
            return;
        }

        menuServices.forEach(menuService => {
            const serviceInfo = services.find(s => s.id === menuService.service_id);
            html += `<h2 class="print-category-title">${serviceInfo.name}</h2>`;
            
            const selectedItemIds = new Set((currentQuote.quote_data.selected_cardapio[menuService.service_id] || []).map(String));
            if (selectedItemIds.size === 0) {
                html += '<p>Nenhum item definido para este cardápio.</p>';
                return;
            }

            const itemsToPrint = cardapioItems.filter(item => selectedItemIds.has(String(item.id)));
            html += `<ul class="print-menu-list">`;
            itemsToPrint.forEach(item => {
                html += `<li>${item.name}</li>`;
            });
            html += `</ul>`;
        });
        
        output.innerHTML = html;
        window.print();
    }


    // =================================================================
    // SALVAMENTO E UTILITÁRIOS
    // =================================================================

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
