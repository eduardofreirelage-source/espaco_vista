
import { supabase, getSession } from './supabase-client.js';

document.addEventListener('DOMContentLoaded', async () => {
    // =================================================================
    // VERIFICAÇÃO DE ACESSO
    // =================================================================
    const { role } = await getSession();
    if (role !== 'admin') {
        console.warn("Acesso negado ao painel administrativo. Redirecionando para login.");
        window.location.href = 'login.html';
        return;
    }

    // =================================================================
    // ESTADO E ELEMENTOS DO DOM
    // =================================================================
    let services = [], priceTables = [], servicePrices = [], quotes = [], events = [];
    
    const adminCatalogContainer = document.getElementById('admin-catalog-container');
    const priceTablesTbody = document.getElementById('price-tables-list')?.querySelector('tbody');
    const quotesTbody = document.getElementById('quotes-table')?.querySelector('tbody');
    const eventsTbody = document.getElementById('events-table')?.querySelector('tbody');
    const analyticsContainer = document.getElementById('analytics-container');
    const addServiceForm = document.getElementById('addServiceForm');
    const addPriceTableForm = document.getElementById('addPriceTableForm');
    const notification = document.getElementById('save-notification');
    
    let debounceTimers = {};
    let calendarInstance = null; // Para garantir que o calendário seja renderizado apenas uma vez

    // --- INICIALIZAÇÃO ---
    async function initialize() {
        await fetchData();
        addEventListeners();
    }

    async function fetchData() {
        try {
            const [servicesRes, tablesRes, pricesRes, quotesRes] = await Promise.all([
                supabase.from('services').select('*').order('category').order('name'),
                supabase.from('price_tables').select('*').order('name'),
                supabase.from('service_prices').select('*'),
                supabase.from('quotes').select('*, clients(*)').order('created_at', { ascending: false })
            ]);

            if (servicesRes.error) throw servicesRes.error;
            if (tablesRes.error) throw tablesRes.error;
            if (pricesRes.error) throw pricesRes.error;
            if (quotesRes.error) throw quotesRes.error;

            services = servicesRes.data || [];
            priceTables = tablesRes.data || [];
            servicePrices = pricesRes.data || [];
            quotes = quotesRes.data || [];
            events = quotes.filter(q => q.status === 'Ganho');

            renderAll();
        } catch (error) {
            showNotification(`Erro ao carregar dados: ${error.message}`, true);
        }
    }

    // --- RENDERIZAÇÃO ---
    function renderAll() {
        renderPriceTablesList();
        renderAdminCatalog();
        renderQuotesTable();
        renderEventsTable();
        renderAnalytics();
    }
    
    function formatCurrency(value) {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(parseFloat(value) || 0);
    }

    function renderQuotesTable() {
        if (!quotesTbody) return;
        quotesTbody.innerHTML = '';
        const statusOptions = ['Rascunho', 'Em analise', 'Ganho', 'Perdido'];

        quotes.forEach(quote => {
            const row = document.createElement('tr');
            row.dataset.quoteId = quote.id;
            const createdAt = new Date(quote.created_at).toLocaleDateString('pt-BR');

            const selectHTML = `
                <select class="status-select" data-id="${quote.id}">
                    ${statusOptions.map(opt => `<option value="${opt}" ${quote.status === opt ? 'selected' : ''}>${opt}</option>`).join('')}
                </select>
            `;

            row.innerHTML = `
                <td>${quote.client_name || 'Rascunho sem nome'}</td>
                <td>${createdAt}</td>
                <td>${selectHTML}</td>
                <td class="actions">
                    <a href="index.html?quote_id=${quote.id}" class="btn" title="Editar Orçamento">Editar</a>
                    <a href="index.html?quote_id=${quote.id}&print=true" target="_blank" class="btn" title="Exportar PDF">PDF</a>
                    <button class="btn-remove" data-action="delete-quote" data-id="${quote.id}" title="Excluir Orçamento">&times;</button>
                </td>
            `;
            quotesTbody.appendChild(row);
        });
    }

    // NOVA FUNÇÃO para renderizar a tabela de eventos ganhos
    function renderEventsTable() {
        if (!eventsTbody) return;
        eventsTbody.innerHTML = '';

        events.forEach(event => {
            const row = document.createElement('tr');
            const eventDate = event.quote_data?.event_dates?.[0]?.date 
                ? new Date(event.quote_data.event_dates[0].date + 'T12:00:00Z').toLocaleDateString('pt-BR') 
                : 'Data não definida';
            
            row.innerHTML = `
                <td>${event.client_name}</td>
                <td>${eventDate}</td>
                <td>${formatCurrency(event.total_value)}</td>
                <td class="actions">
                    <a href="evento.html?quote_id=${event.id}" class="btn" title="Gerenciar Evento">Gerenciar</a>
                </td>
            `;
            eventsTbody.appendChild(row);
        });
    }

    function renderAnalytics() {
        if (!analyticsContainer) return;
        
        const now = new Date();
        const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const startOfPreviousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const endOfPreviousMonth = new Date(now.getFullYear(), now.getMonth(), 0);

        const currentMonthQuotes = quotes.filter(q => new Date(q.created_at) >= startOfCurrentMonth);
        const previousMonthQuotes = quotes.filter(q => {
            const createdAt = new Date(q.created_at);
            return createdAt >= startOfPreviousMonth && createdAt <= endOfPreviousMonth;
        });

        const currentMetrics = aggregateQuoteMetrics(currentMonthQuotes);
        const previousMetrics = aggregateQuoteMetrics(previousMonthQuotes);

        analyticsContainer.innerHTML = `
            ${createKpiCard('Ganhos', currentMetrics.Ganho, previousMetrics.Ganho)}
            ${createKpiCard('Perdidos', currentMetrics.Perdido, previousMetrics.Perdido)}
            ${createKpiCard('Em Análise', currentMetrics['Em analise'], previousMetrics['Em analise'])}
        `;
    }

    function aggregateQuoteMetrics(quoteArray) {
        const initialMetrics = {
            'Ganho': { count: 0, value: 0 },
            'Perdido': { count: 0, value: 0 },
            'Em analise': { count: 0, value: 0 },
            'Rascunho': { count: 0, value: 0 }
        };
        return quoteArray.reduce((acc, quote) => {
            if (acc[quote.status]) {
                acc[quote.status].count++;
                acc[quote.status].value += parseFloat(quote.total_value || 0);
            }
            return acc;
        }, initialMetrics);
    }

    function createKpiCard(title, current, previous) {
        const percentageChange = calculatePercentageChange(current.value, previous.value);
        const trendClass = percentageChange.startsWith('+') && parseFloat(percentageChange) > 0 ? 'increase' : percentageChange.startsWith('-') ? 'decrease' : '';
        const trendIndicator = trendClass ? `<span class="percentage ${trendClass}">${percentageChange}</span>` : '';

        return `
            <div class="kpi-card">
                <div class="kpi-title">${title} (Mês Atual)</div>
                <div class="kpi-value">${formatCurrency(current.value)}</div>
                <div class="kpi-sub-value">${current.count} propostas</div>
                <div class="kpi-comparison">
                    ${trendIndicator}
                    <span>em relação ao mês anterior (${formatCurrency(previous.value)})</span>
                </div>
            </div>
        `;
    }
    
    function calculatePercentageChange(current, previous) {
        if (previous === 0) {
            return current > 0 ? '+∞%' : '0%';
        }
        const change = ((current - previous) / previous) * 100;
        return `${change > 0 ? '+' : ''}${change.toFixed(0)}%`;
    }

    function renderPriceTablesList() {
        if (!priceTablesTbody) return;
        priceTablesTbody.innerHTML = '';
        priceTables.forEach(table => {
            const row = document.createElement('tr');
            row.dataset.tableId = table.id;
            const consumable = parseFloat(table.consumable_credit || 0).toFixed(2);
            row.innerHTML = `
                <td><input type="text" class="price-table-input" data-field="name" value="${table.name}"></td>
                <td class="price-column"><input type="number" step="0.01" min="0" class="price-table-input" data-field="consumable_credit" value="${consumable}"></td>
                <td class="actions"><button class="btn-remove" data-action="delete-table" data-id="${table.id}" title="Excluir Lista">&times;</button></td>
            `;
            priceTablesTbody.appendChild(row);
        });
    }
    
    function renderAdminCatalog() {
        if (!adminCatalogContainer) return;
        adminCatalogContainer.innerHTML = '';
        const servicesByCategory = services.reduce((acc, service) => {
            if (!acc[service.category]) { acc[service.category] = []; }
            acc[service.category].push(service);
            return acc;
        }, {});
        const orderedCategories = Object.keys(servicesByCategory).sort((a, b) => {
             const order = ['Espaço', 'Gastronomia', 'Equipamentos', 'Serviços / Outros'];
             return order.indexOf(a) - order.indexOf(b);
        });

        orderedCategories.forEach(category => {
            const categoryWrapper = document.createElement('div');
            categoryWrapper.innerHTML = `
                <details class="category-accordion" open>
                    <summary class="category-header">
                        <h3 class="category-title">${category}</h3>
                    </summary>
                    <div class="table-container">
                        <table class="editable-table">
                            <colgroup>
                                <col style="width: 38%;">
                                <col style="width: 14%;">
                                ${priceTables.map(() => `<col style="width: ${ (100-38-14-8) / (priceTables.length || 1)}%;">`).join('')}
                                <col style="width: 8%;">
                            </colgroup>
                            <thead>
                                <tr>
                                    <th>Nome</th>
                                    <th>Unidade</th>
                                    ${priceTables.map(pt => `<th class="price-column">${pt.name}</th>`).join('')}
                                    <th>Ações</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${servicesByCategory[category].map(service => `
                                    <tr data-service-id="${service.id}">
                                        <td><input type="text" class="service-detail-input" data-field="name" value="${service.name}"></td>
                                        <td>${createUnitSelect(service.unit)}</td>
                                        ${priceTables.map(table => {
                                            const priceRecord = servicePrices.find(p => p.service_id === service.id && p.price_table_id === table.id);
                                            const price = priceRecord ? parseFloat(priceRecord.price).toFixed(2) : '0.00';
                                            return `<td class="price-column"><input type="number" step="0.01" min="0" class="service-price-input" data-table-id="${table.id}" value="${price}"></td>`;
                                        }).join('')}
                                        <td class="actions">
                                            <button class="btn-remove" data-action="delete-service" data-id="${service.id}" title="Excluir Serviço">&times;</button>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </details>
            `;
            adminCatalogContainer.appendChild(categoryWrapper);
        });
    }

    function createUnitSelect(currentUnit) {
        const units = ['unidade', 'diaria', 'por_pessoa'];
        return `<select class="service-detail-input" data-field="unit">
            ${units.map(unit => `<option value="${unit}" ${unit === currentUnit ? 'selected' : ''}>${unit}</option>`).join('')}
        </select>`;
    }

    // --- LÓGICA DO CALENDÁRIO ---
    async function initializeCalendar() {
        const calendarEl = document.getElementById('calendar');
        if (!calendarEl || calendarInstance) return;

        const calendarEvents = [];
        events.forEach(quote => {
            if (quote.quote_data && quote.quote_data.event_dates) {
                quote.quote_data.event_dates.forEach(eventDate => {
                    calendarEvents.push({
                        title: quote.client_name,
                        start: eventDate.date, 
                        allDay: true
                    });
                });
            }
        });

        calendarInstance = new FullCalendar.Calendar(calendarEl, {
            locale: 'pt-br',
            initialView: 'dayGridMonth',
            headerToolbar: {
                left: 'prev,next today',
                center: 'title',
                right: 'dayGridMonth,timeGridWeek,listWeek'
            },
            events: calendarEvents,
            eventColor: '#8B0000'
        });

        calendarInstance.render();
    }
    
    // --- EVENT LISTENERS ---
    function setupTabEvents() {
        const tabsNav = document.querySelector('.tabs-nav');
        if (!tabsNav) return;
        tabsNav.addEventListener('click', (e) => {
            const clickedTab = e.target.closest('.tab-btn');
            if (!clickedTab) return;

            const tabId = clickedTab.dataset.tab;
            tabsNav.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
            
            clickedTab.classList.add('active');
            document.getElementById(`tab-content-${tabId}`).classList.add('active');

            // Inicializa o calendário SE for a aba de calendário e ainda não foi inicializado
            if (tabId === 'calendar') {
                initializeCalendar();
            }
        });
    }

    function setupCollapsibleEvents() {
        document.body.addEventListener('click', e => {
            const header = e.target.closest('.collapsible-card > .card-header');
            if (header) {
                const card = header.closest('.collapsible-card');
                if (card) card.classList.toggle('collapsed');
            }
        });
    }
    
    function addEventListeners() {
        setupTabEvents();
        setupCollapsibleEvents();

        addServiceForm?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const newService = { name: document.getElementById('serviceName').value, category: document.getElementById('serviceCategory').value, unit: document.getElementById('serviceUnit').value };
            const { error } = await supabase.from('services').insert([newService]);
            if(error) { showNotification(`Erro: ${error.message}`, true); } 
            else { showNotification('Serviço adicionado!'); e.target.reset(); fetchData(); }
        });
        
        addPriceTableForm?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const newTable = { name: document.getElementById('tableName').value, consumable_credit: parseFloat(document.getElementById('tableConsumable').value) || 0 };
            const { error } = await supabase.from('price_tables').insert([newTable]);
            if(error) { showNotification(`Erro: ${error.message}`, true); } 
            else { showNotification('Lista de preços adicionada!'); e.target.reset(); fetchData(); }
        });

        document.body.addEventListener('click', e => {
            const button = e.target.closest('button');
            if (!button) return;
            const { action, id } = button.dataset;
            if (action === 'delete-service') deleteService(id);
            if (action === 'delete-table') deletePriceTable(id);
            if (action === 'delete-quote') deleteQuote(id);
        });
        
        adminCatalogContainer?.addEventListener('input', (e) => {
            if (e.target.matches('.service-detail-input[type="text"]')) { handleServiceEdit(e.target, true); }
        });
        adminCatalogContainer?.addEventListener('change', (e) => {
            if (e.target.matches('.service-detail-input:not([type="text"])') || e.target.matches('.service-price-input')) { handleServiceEdit(e.target, false); }
        });

        priceTablesTbody?.addEventListener('input', (e) => {
            if (e.target.matches('.price-table-input[data-field="name"]')) { handlePriceTableEdit(e.target, true); }
        });
        priceTablesTbody?.addEventListener('change', (e) => {
            if (e.target.matches('.price-table-input[data-field="consumable_credit"]')) { handlePriceTableEdit(e.target, false); }
        });

        quotesTbody?.addEventListener('change', async (e) => {
            if (e.target.classList.contains('status-select')) {
                const quoteId = e.target.dataset.id;
                const newStatus = e.target.value;
                await updateQuoteStatus(quoteId, newStatus);
            }
        });
    }

    // --- FUNÇÕES DE LÓGICA E CRUD (sem alterações significativas, mantidas como estavam) ---
    // ... (O restante das funções como handleServiceEdit, handlePriceTableEdit, updateQuoteStatus, etc., permanecem as mesmas)
    function handleServiceEdit(inputElement, useDebounce) {
        const row = inputElement.closest('tr');
        if (!row) return;
        const serviceId = row.dataset.serviceId;
        const timerKey = `service-${serviceId}-${inputElement.dataset.field || inputElement.dataset.tableId}`;
        if (debounceTimers[timerKey]) { clearTimeout(debounceTimers[timerKey]); }
        const action = () => {
            if (inputElement.classList.contains('service-detail-input')) {
                updateServiceDetail(serviceId, inputElement.dataset.field, inputElement.value, inputElement);
            } else if (inputElement.classList.contains('service-price-input')) {
                const price = parseFloat(inputElement.value) || 0;
                if (!useDebounce) { inputElement.value = price.toFixed(2); }
                updateServicePrice(serviceId, inputElement.dataset.tableId, price, inputElement);
            }
        };
        if (useDebounce) { debounceTimers[timerKey] = setTimeout(action, 500); } else { action(); }
    }

    function handlePriceTableEdit(inputElement, useDebounce) {
        const row = inputElement.closest('tr');
        if (!row) return;
        const tableId = row.dataset.tableId;
        const field = inputElement.dataset.field;
        const timerKey = `table-${tableId}-${field}`;
        if (debounceTimers[timerKey]) { clearTimeout(debounceTimers[timerKey]); }
        const action = () => {
            let value = inputElement.value;
            if (field === 'consumable_credit') {
                value = parseFloat(value) || 0;
                if (!useDebounce) { inputElement.value = value.toFixed(2); }
            }
            updatePriceTableDetail(tableId, field, value, inputElement);
        };
        if (useDebounce) { debounceTimers[timerKey] = setTimeout(action, 500); } else { action(); }
    }

    async function updateQuoteStatus(id, status) {
        const { error } = await supabase.from('quotes').update({ status: status }).eq('id', id);
        if (error) {
            showNotification(`Erro ao atualizar status: ${error.message}`, true);
        } else {
            showNotification('Status atualizado com sucesso!');
            // Recarrega os dados para garantir consistência em todas as abas
            fetchData();
        }
    }
    
    async function updatePriceTableDetail(tableId, field, value, inputElement) {
        if (!tableId || !field) return;
        if (field === 'name' && !value.trim()) {
            showNotification('O nome da lista não pode ficar vazio.', true);
            fetchData(); return;
        }
        const { error } = await supabase.from('price_tables').update({ [field]: value }).eq('id', tableId);
        if (error) {
            showNotification(`Erro ao atualizar: ${error.message}`, true);
            fetchData();
        } else {
            showFlash(inputElement);
            if (field === 'name') { renderAdminCatalog(); }
        }
    }

    async function updateServiceDetail(serviceId, field, value, inputElement) {
        if (!serviceId || !field) return;
        if (field === 'name' && !value.trim()) {
            showNotification('O nome do serviço não pode ficar vazio.', true);
            fetchData(); return;
        }
        const { error } = await supabase.from('services').update({ [field]: value }).eq('id', serviceId);
        if (error) {
            showNotification(`Erro ao atualizar: ${error.message}`, true);
            fetchData();
        } else {
            showFlash(inputElement);
        }
    }

    async function updateServicePrice(serviceId, tableId, price, inputElement) {
        if (!serviceId || !tableId) return;
        const recordToUpsert = { service_id: serviceId, price_table_id: tableId, price: price };
        const { error } = await supabase.from('service_prices').upsert(recordToUpsert, { onConflict: 'service_id, price_table_id' });
        if (error) {
            showNotification(`Erro ao atualizar preço: ${error.message}`, true);
            fetchData();
        } else {
            showFlash(inputElement);
        }
    }

    async function deleteService(id) {
        if (!confirm('Tem certeza? Isso excluirá o serviço e todos os seus preços.')) return;
        const { error } = await supabase.from('services').delete().eq('id', id);
        if(error) { showNotification(`Erro: ${error.message}`, true); } else { showNotification('Serviço excluído.'); fetchData(); }
    }
    
    async function deletePriceTable(id) {
        if (!confirm('Tem certeza? Isso excluirá a lista e todos os preços associados a ela.')) return;
        const { error } = await supabase.from('price_tables').delete().eq('id', id);
        if(error) { showNotification(`Erro: ${error.message}`, true); } else { showNotification('Lista de preços excluída.'); fetchData(); }
    }
    
    async function deleteQuote(id) {
        if (!confirm('Tem certeza que deseja excluir este orçamento?')) return;
        const { error } = await supabase.from('quotes').delete().eq('id', id);
        if(error) { showNotification(`Erro: ${error.message}`, true); } else { showNotification('Orçamento excluído.'); fetchData(); }
    }

    function showFlash(inputElement) {
        inputElement.classList.add('success-flash');
        setTimeout(() => inputElement.classList.remove('success-flash'), 1500);
    }

    function showNotification(message, isError = false) {
        if (!notification) return;
        notification.textContent = message;
        notification.style.backgroundColor = isError ? 'var(--danger-color)' : 'var(--success-color)';
        notification.classList.add('show');
        setTimeout(() => notification.classList.remove('show'), 5000);
    }

    initialize();
});
