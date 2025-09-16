import { supabase, getSession } from './supabase-client.js';

document.addEventListener('DOMContentLoaded', async () => {
    if (!document.querySelector('.tabs-nav')) return;

    const { role } = await getSession();
    if (role !== 'admin') {
        window.location.href = 'login.html';
        return;
    }

    // ESTADO GLOBAL
    let services = [], priceTables = [], servicePrices = [], quotes = [], paymentMethods = [], cardapioItems = [], cardapioComposition = [], units = [];
    let selectedCardapioId = null;
    let calendarInstance = null;

    // SELETORES DO DOM
    const notification = document.getElementById('save-notification');
    const adminCatalogContainer = document.getElementById('admin-catalog-container');
    const selectCardapioToEdit = document.getElementById('select-cardapio-to-edit');
    const compositionSection = document.getElementById('composition-section');
    const editingCardapioName = document.getElementById('editing-cardapio-name');
    const selectItemToAdd = document.getElementById('select-item-to-add');
    const serviceUnitSelect = document.getElementById('serviceUnit');
    const analyticsContainer = document.getElementById('analytics-container');
    const analyticsNotice = document.getElementById('analytics-notice');
    const calendarEl = document.getElementById('calendar');

    // =================================================================
    // FUNÇÕES UTILITÁRIAS
    // =================================================================
    function showNotification(message, isError = false) {
        if (!notification) return;
        notification.textContent = message;
        notification.style.backgroundColor = isError ? 'var(--danger-color)' : 'var(--success-color)';
        notification.classList.add('show');
        setTimeout(() => notification.classList.remove('show'), 5000);
    }
    
    function showFlash(inputElement) {
        if (inputElement) {
            inputElement.classList.add('success-flash');
            setTimeout(() => inputElement.classList.remove('success-flash'), 1500);
        }
    }

    function createUnitSelect(currentUnit) {
        if (!units || units.length === 0) return `<input type="text" class="editable-input" data-field="unit" value="${currentUnit || ''}">`;
        return `<select class="editable-input" data-field="unit">${units.map(unit => `<option value="${unit.name}" ${unit.name === currentUnit ? 'selected' : ''}>${unit.name}</option>`).join('')}</select>`;
    }

    function aggregateQuoteMetrics(quoteArray) {
        const initialMetrics = { 'Ganho': { count: 0, value: 0 }, 'Perdido': { count: 0, value: 0 }, 'Em analise': { count: 0, value: 0 }, 'Rascunho': { count: 0, value: 0 } };
        return quoteArray.reduce((acc, quote) => { if (acc[quote.status]) { acc[quote.status].count++; acc[quote.status].value += parseFloat(quote.total_value || 0); } return acc; }, initialMetrics);
    }

    function createKpiCard(title, current, previous) {
        const calculatePercentageChange = (current, previous) => {
            if (previous === 0) { return current > 0 ? '+∞%' : '0%'; }
            const change = ((current - previous) / previous) * 100;
            return `${change > 0 ? '+' : ''}${change.toFixed(0)}%`;
        };
        const percentageChange = calculatePercentageChange(current.value, previous.value);
        const trendClass = percentageChange.startsWith('+') && parseFloat(percentageChange) > 0 ? 'increase' : percentageChange.startsWith('-') ? 'decrease' : '';
        const trendIndicator = trendClass ? `<span class="percentage ${trendClass}">${percentageChange}</span>` : '';
        const formatCurrency = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
        return `<div class="kpi-card"><div class="kpi-title">${title} (Mês Atual)</div><div class="kpi-value">${formatCurrency(current.value)}</div><div class="kpi-sub-value">${current.count} propostas</div><div class="kpi-comparison">${trendIndicator}<span>em relação ao mês anterior (${formatCurrency(previous.value)})</span></div></div>`;
    }

    // =================================================================
    // INICIALIZAÇÃO E DADOS
    // =================================================================
    async function initialize() {
        addEventListeners();
        await fetchData();
    }

    async function fetchData() {
        const results = await Promise.allSettled([
            supabase.from('services').select('*').order('category').order('name'),
            supabase.from('price_tables').select('*').order('name'),
            supabase.from('service_prices').select('*'),
            supabase.from('quotes').select('*, clients(*)').order('created_at', { ascending: false }),
            supabase.from('payment_methods').select('*').order('name'),
            supabase.from('cardapio_items').select('*').order('name'),
            supabase.from('cardapio_composition').select('*, item:item_id(id, name)'),
            supabase.from('units').select('name').order('name')
        ]);

        const [servicesRes, tablesRes, pricesRes, quotesRes, paymentsRes, itemsRes, compositionRes, unitsRes] = results;
        services = (servicesRes.status === 'fulfilled') ? servicesRes.value.data : [];
        priceTables = (tablesRes.status === 'fulfilled') ? tablesRes.value.data : [];
        servicePrices = (pricesRes.status === 'fulfilled') ? pricesRes.value.data : [];
        quotes = (quotesRes.status === 'fulfilled') ? quotesRes.value.data : [];
        paymentMethods = (paymentsRes.status === 'fulfilled') ? paymentsRes.value.data : [];
        cardapioItems = (itemsRes.status === 'fulfilled') ? itemsRes.value.data : [];
        cardapioComposition = (compositionRes.status === 'fulfilled') ? compositionRes.value.data : [];
        units = (unitsRes.status === 'fulfilled') ? unitsRes.value.data : [];
        
        renderAll();
    }
// =================================================================
    // RENDERIZAÇÃO
    // =================================================================
    function renderAll() {
        renderSimpleTable(document.getElementById('quotes-table'), quotes, createQuoteRow);
        renderSimpleTable(document.getElementById('events-table'), quotes.filter(q => q.status === 'Ganho'), createEventRow);
        renderSimpleTable(document.getElementById('price-tables-list'), priceTables, createPriceTableRow);
        renderSimpleTable(document.getElementById('payment-methods-table'), paymentMethods, createPaymentMethodRow);
        renderSimpleTable(document.getElementById('cardapio-items-table'), cardapioItems, createCardapioItemRow);
        renderSimpleTable(document.getElementById('units-table'), units, createUnitRow);
        renderAdminCatalog();
        renderCompositionView();
        populateUnitSelects();
        renderAnalytics();
    }
    
    function renderSimpleTable(tableEl, data, rowCreator) {
        const tbody = tableEl?.querySelector('tbody');
        if (!tbody || !data) return;
        tbody.innerHTML = '';
        data.forEach(item => tbody.appendChild(rowCreator(item)));
    }

    function createQuoteRow(quote) {
        const row = document.createElement('tr');
        row.dataset.id = quote.id;
        const statusOptions = ['Rascunho', 'Em analise', 'Ganho', 'Perdido'];
        const selectHTML = `<select class="status-select editable-input" data-field="status">${statusOptions.map(opt => `<option value="${opt}" ${quote.status === opt ? 'selected' : ''}>${opt}</option>`).join('')}</select>`;
        row.innerHTML = `<td>${quote.client_name || 'Rascunho'}</td><td>${new Date(quote.created_at).toLocaleDateString('pt-BR')}</td><td>${selectHTML}</td><td class="actions"><a href="index.html?quote_id=${quote.id}" class="btn">Editar</a><a href="evento.html?quote_id=${quote.id}" class="btn" style="${quote.status === 'Ganho' ? '' : 'display:none;'}">Gerenciar</a><button class="btn-remove" data-action="delete-quote" data-id="${quote.id}">&times;</button></td>`;
        return row;
    }

    function createEventRow(event) {
        const row = document.createElement('tr');
        const eventDate = event.quote_data?.event_dates?.[0]?.date ? new Date(event.quote_data.event_dates[0].date + 'T12:00:00Z').toLocaleDateString('pt-BR') : 'N/D';
        row.innerHTML = `<td>${event.client_name}</td><td>${eventDate}</td><td>${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(event.total_value)}</td><td class="actions"><a href="evento.html?quote_id=${event.id}" class="btn">Gerenciar</a></td>`;
        return row;
    }
    
    function createPriceTableRow(table) {
        const row = document.createElement('tr');
        row.dataset.id = table.id;
        row.innerHTML = `<td><input type="text" class="editable-input" data-field="name" value="${table.name}"></td><td class="price-column"><input type="number" step="0.01" min="0" class="editable-input" data-field="consumable_credit" value="${parseFloat(table.consumable_credit || 0).toFixed(2)}"></td><td class="actions"><button class="btn-remove" data-action="delete-table" data-id="${table.id}">&times;</button></td>`;
        return row;
    }

    function createPaymentMethodRow(method) {
        const row = document.createElement('tr');
        row.dataset.id = method.id;
        row.innerHTML = `<td><input type="text" class="editable-input" data-field="name" value="${method.name}"></td><td class="actions"><button class="btn-remove" data-action="delete-payment-method" data-id="${method.id}">&times;</button></td>`;
        return row;
    }
    
    function createCardapioItemRow(item) {
        const row = document.createElement('tr');
        row.dataset.id = item.id;
        row.innerHTML = `<td><input type="text" class="editable-input" data-field="name" value="${item.name}"></td><td><input type="text" class="editable-input" data-field="description" value="${item.description || ''}"></td><td class="actions"><button class="btn-remove" data-action="delete-cardapio-item" data-id="${item.id}">&times;</button></td>`;
        return row;
    }
    
    function createUnitRow(unit) {
        const row = document.createElement('tr');
        row.dataset.id = unit.name;
        row.innerHTML = `<td><input type="text" class="editable-input" data-field="name" value="${unit.name}"></td><td class="actions"><button class="btn-remove" data-action="delete-unit" data-id="${unit.name}">&times;</button></td>`;
        return row;
    }

    function renderAdminCatalog() {
        if (!adminCatalogContainer) return;
        adminCatalogContainer.innerHTML = '';
        const servicesByCategory = services.reduce((acc, service) => { if (!acc[service.category]) acc[service.category] = []; acc[service.category].push(service); return acc; }, {});
        const orderedCategories = ['Espaço', 'Gastronomia', 'Equipamentos', 'Serviços / Outros'];
        
        orderedCategories.forEach(category => {
            if (!servicesByCategory[category]) return;
            const categoryWrapper = document.createElement('div');
            let tableHeaders = `<th>Nome</th><th>Unidade</th>`;
            priceTables.forEach(pt => tableHeaders += `<th class="price-column">${pt.name}</th>`);
            tableHeaders += `<th class="actions">Ações</th>`;
            let rowsHtml = servicesByCategory[category].map(service => {
                let priceColumns = priceTables.map(table => {
                    const priceRecord = servicePrices.find(p => p.service_id === service.id && p.price_table_id === table.id);
                    const price = priceRecord ? parseFloat(priceRecord.price).toFixed(2) : '0.00';
                    return `<td class="price-column"><input type="number" step="0.01" min="0" class="service-price-input" data-service-id="${service.id}" data-table-id="${table.id}" value="${price}"></td>`;
                }).join('');
                const duplicateButton = category === 'Gastronomia' ? `<button class="btn btn-slim" data-action="duplicate-cardapio" data-id="${service.id}" title="Duplicar Cardápio">⧉</button>` : '';
                return `<tr data-id="${service.id}">
                    <td><input type="text" class="editable-input" data-field="name" value="${service.name}"></td>
                    <td>${createUnitSelect(service.unit)}</td>
                    ${priceColumns}
                    <td class="actions">${duplicateButton}<button class="btn-remove" data-action="delete-service" data-id="${service.id}">&times;</button></td>
                </tr>`;
            }).join('');
            categoryWrapper.innerHTML = `<details class="category-accordion" open><summary class="category-header"><h3 class="category-title">${category}</h3></summary><div class="table-container"><table class="editable-table"><thead><tr>${tableHeaders}</tr></thead><tbody>${rowsHtml}</tbody></table></div></details>`;
            adminCatalogContainer.appendChild(categoryWrapper);
        });
    }

    function renderCompositionView() {
        if (!selectCardapioToEdit) return;
        const cardapios = services.filter(s => s.category === 'Gastronomia');
        const currentVal = selectedCardapioId || selectCardapioToEdit.value;
        selectCardapioToEdit.innerHTML = '<option value="">-- Selecione --</option>';
        cardapios.forEach(cardapio => selectCardapioToEdit.add(new Option(cardapio.name, cardapio.id)));
        selectCardapioToEdit.value = currentVal;
        renderCompositionDetails();
    }

    function renderCompositionDetails() {
        if (!selectedCardapioId) {
            compositionSection.style.display = 'none';
            return;
        }
        const cardapio = services.find(s => s.id === selectedCardapioId);
        if (!cardapio) return;
        compositionSection.style.display = 'block';
        editingCardapioName.textContent = cardapio.name;
        const itemsInComposition = cardapioComposition.filter(c => c.cardapio_service_id === selectedCardapioId);
        renderSimpleTable(document.getElementById('composition-table'), itemsInComposition, item => {
            const row = document.createElement('tr');
            row.innerHTML = `<td>${item.item.name}</td><td class="actions"><button class="btn-remove" data-action="delete-composition-item" data-id="${item.id}">&times;</button></td>`;
            return row;
        });
        const itemIdsInComposition = itemsInComposition.map(c => c.item.id);
        const availableItems = cardapioItems.filter(item => !itemIdsInComposition.includes(item.id));
        selectItemToAdd.innerHTML = '';
        availableItems.forEach(item => selectItemToAdd.add(new Option(item.name, item.id)));
    }

    function populateUnitSelects() {
        if (!serviceUnitSelect) return;
        serviceUnitSelect.innerHTML = '';
        units.forEach(unit => serviceUnitSelect.add(new Option(unit.name, unit.name)));
    }
    
    function renderAnalytics() {
        if (!analyticsContainer || !analyticsNotice) return;
        analyticsContainer.innerHTML = '';
        if (quotes.length === 0) {
            analyticsNotice.textContent = 'Nenhuma proposta encontrada para gerar análises.';
            analyticsNotice.style.display = 'block';
            return;
        }
        const now = new Date();
        const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const currentMonthQuotes = quotes.filter(q => new Date(q.created_at) >= startOfCurrentMonth);
        if (currentMonthQuotes.length === 0) {
            analyticsNotice.textContent = 'Nenhuma proposta encontrada para o mês atual.';
            analyticsNotice.style.display = 'block';
            return;
        }
        analyticsNotice.style.display = 'none';
        const startOfPreviousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const endOfPreviousMonth = new Date(now.getFullYear(), now.getMonth(), 0);
        const previousMonthQuotes = quotes.filter(q => { const createdAt = new Date(q.created_at); return createdAt >= startOfPreviousMonth && createdAt <= endOfPreviousMonth; });
        const currentMetrics = aggregateQuoteMetrics(currentMonthQuotes);
        const previousMetrics = aggregateQuoteMetrics(previousMonthQuotes);
        analyticsContainer.innerHTML = `${createKpiCard('Ganhos', currentMetrics.Ganho, previousMetrics.Ganho)}${createKpiCard('Perdidos', currentMetrics.Perdido, previousMetrics.Perdido)}${createKpiCard('Em Análise', currentMetrics['Em analise'], previousMetrics['Em analise'])}`;
    }
    
    function initializeCalendar() {
        if (!calendarEl || calendarInstance) return;
        calendarInstance = new FullCalendar.Calendar(calendarEl, {
            locale: 'pt-br', initialView: 'dayGridMonth', headerToolbar: { left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek,listWeek' },
            eventClick: (info) => { const { quoteId } = info.event.extendedProps; window.location.href = `evento.html?quote_id=${quoteId}`; }
        });
        calendarInstance.render();
        updateCalendarEvents();
    }
    
    function updateCalendarEvents() {
        if (!calendarInstance) return;
        const events = quotes.filter(q => q.status === 'Ganho' && q.quote_data?.event_dates?.[0]?.date)
                             .map(q => ({ title: q.client_name, start: q.quote_data.event_dates[0].date, extendedProps: { quoteId: q.id } }));
        calendarInstance.removeAllEvents();
        calendarInstance.addEventSource(events);
    }

    // =================================================================
    // EVENT LISTENERS E AÇÕES
    // =================================================================
    function addEventListeners() {
        document.querySelector('.tabs-nav')?.addEventListener('click', (e) => {
            const clickedTab = e.target.closest('.tab-btn');
            if (!clickedTab) return;
            document.querySelector('.tabs-nav').querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
            clickedTab.classList.add('active');
            document.getElementById(`tab-content-${clickedTab.dataset.tab}`).classList.add('active');
            if (clickedTab.dataset.tab === 'calendar') initializeCalendar();
        });
        document.body.addEventListener('click', (e) => {
            const header = e.target.closest('.collapsible-card > .card-header');
            if (header) header.closest('.collapsible-card')?.classList.toggle('collapsed');
        });
        document.getElementById('add-cardapio-item-form')?.addEventListener('submit', handleFormSubmit);
        document.getElementById('addServiceForm')?.addEventListener('submit', handleFormSubmit);
        document.getElementById('addPriceTableForm')?.addEventListener('submit', handleFormSubmit);
        document.getElementById('addPaymentMethodForm')?.addEventListener('submit', handleFormSubmit);
        document.getElementById('addUnitForm')?.addEventListener('submit', handleFormSubmit);
        document.getElementById('add-item-to-cardapio-form')?.addEventListener('submit', handleFormSubmit);
        document.body.addEventListener('click', handleTableActions);
        document.body.addEventListener('change', handleTableEdits);
        selectCardapioToEdit?.addEventListener('change', (e) => { selectedCardapioId = e.target.value; renderCompositionDetails(); });
    }

    async function handleFormSubmit(e) {
        e.preventDefault();
        const form = e.target;
        let result, successMessage = 'Salvo com sucesso!';
        try {
            switch (form.id) {
                case 'add-cardapio-item-form':
                    result = await supabase.from('cardapio_items').insert([{ name: form.querySelector('#cardapioItemName').value, description: form.querySelector('#cardapioItemDescription').value }]);
                    break;
                case 'addServiceForm':
                    result = await supabase.from('services').insert([{ name: form.querySelector('#serviceName').value, category: form.querySelector('#serviceCategory').value, unit: form.querySelector('#serviceUnit').value }]);
                    break;
                case 'addPriceTableForm':
                    result = await supabase.from('price_tables').insert([{ name: form.querySelector('#tableName').value, consumable_credit: form.querySelector('#tableConsumable').value }]);
                    break;
                case 'addPaymentMethodForm':
                     result = await supabase.from('payment_methods').insert([{ name: form.querySelector('#paymentMethodName').value }]);
                     break;
                case 'addUnitForm':
                     result = await supabase.from('units').insert([{ name: form.querySelector('#unitName').value }]);
                     break;
                case 'add-item-to-cardapio-form':
                    if (!selectedCardapioId) return;
                    result = await supabase.from('cardapio_composition').insert([{ cardapio_service_id: selectedCardapioId, item_id: selectItemToAdd.value }]);
                    successMessage = 'Item adicionado ao cardápio!';
                    break;
            }
            if (result && result.error) throw result.error;
            showNotification(successMessage);
            if(form.tagName === 'FORM') form.reset();
            fetchData();
        } catch (error) {
            showNotification(`Erro: ${error.message}`, true);
        }
    }

    async function handleTableActions(e) {
        const button = e.target.closest('button[data-action]');
        if (!button) return;
        const { action, id } = button.dataset;
        if (action === 'duplicate-cardapio') {
            duplicateCardapio(id);
            return;
        }
        const tables = {
            'delete-quote': 'quotes', 'delete-service': 'services', 'delete-table': 'price_tables',
            'delete-payment-method': 'payment_methods', 'delete-cardapio-item': 'cardapio_items',
            'delete-composition-item': 'cardapio_composition', 'delete-unit': 'units'
        };
        if (tables[action]) {
            if (!confirm('Tem certeza?')) return;
            const { error } = await supabase.from(tables[action]).delete().eq(action === 'delete-unit' ? 'name' : 'id', id);
            if (error) { showNotification(`Erro: ${error.message}`, true); }
            else { showNotification('Registro excluído.'); fetchData(); }
        }
    }
    
    async function handleTableEdits(e) {
        const input = e.target;
        if (!input.matches('.editable-input, .status-select, .service-price-input')) return;
        const row = input.closest('tr');
        const id = row.dataset.id;
        if(!id) return;
        if (input.classList.contains('service-price-input')) {
            const { serviceId, tableId } = input.dataset;
            const { error } = await supabase.from('service_prices').upsert({ service_id: serviceId, price_table_id: tableId, price: input.value }, { onConflict: 'service_id, price_table_id' });
            if (error) { showNotification(`Erro: ${error.message}`, true); } else { showFlash(input); }
            return;
        }
        const { field } = input.dataset;
        const value = input.value;
        const table = row.closest('table');
        if (!table) return;
        const tableMap = {
            'cardapio-items-table': 'cardapio_items', 'payment-methods-table': 'payment_methods',
            'price-tables-list': 'price_tables', 'units-table': 'units', 'quotes-table': 'quotes',
        };
        let tableName = tableMap[table.id] || (table.closest('#admin-catalog-container') ? 'services' : null);
        if (tableName) {
            const { error } = await supabase.from(tableName).update({ [field]: value }).eq(tableName === 'units' ? 'name' : 'id', id);
            if (error) { showNotification(`Erro: ${error.message}`, true); fetchData(); }
            else { showFlash(input); }
        }
    }
    
    async function duplicateCardapio(serviceId) {
        showNotification('Duplicando cardápio, aguarde...');
        try {
            const { data: originalService, error: serviceError } = await supabase.from('services').select('*').eq('id', serviceId).single();
            if (serviceError) throw serviceError;
            const { data: originalComposition, error: compError } = await supabase.from('cardapio_composition').select('item_id').eq('cardapio_service_id', serviceId);
            if (compError) throw compError;
            const { data: originalPrices, error: pricesError } = await supabase.from('service_prices').select('price_table_id, price').eq('service_id', serviceId);
            if (pricesError) throw pricesError;
            const { data: newService, error: newServiceError } = await supabase.from('services').insert({ name: `${originalService.name} Cópia`, category: originalService.category, unit: originalService.unit }).select().single();
            if (newServiceError) throw newServiceError;
            if (originalComposition?.length > 0) {
                const newComposition = originalComposition.map(item => ({ cardapio_service_id: newService.id, item_id: item.item_id }));
                const { error: newCompError } = await supabase.from('cardapio_composition').insert(newComposition);
                if (newCompError) throw newCompError;
            }
            if (originalPrices?.length > 0) {
                const newPrices = originalPrices.map(p => ({ service_id: newService.id, price_table_id: p.price_table_id, price: p.price }));
                const { error: newPricesError } = await supabase.from('service_prices').insert(newPrices);
                if (newPricesError) throw newPricesError;
            }
            showNotification('Cardápio duplicado com sucesso!');
            fetchData();
        } catch (error) {
            showNotification(`Erro ao duplicar: ${error.message}`, true);
        }
    }

    initialize();
});
// FIM DO ARQUIVO auth.js
