import { supabase, getSession } from './supabase-client.js';

document.addEventListener('DOMContentLoaded', async () => {
    if (!document.querySelector('.tabs-nav')) return;

    const { role } = await getSession();
    if (role !== 'admin') {
        window.location.href = 'login.html';
        return;
    }

    // ESTADO GLOBAL
    let services = [], priceTables = [], servicePrices = [], quotes = [], paymentMethods = [], menuItems = [], menuSubitems = [], menuComposition = [], units = [];
    
    // SELETORES DO DOM
    const notification = document.getElementById('save-notification');
    const adminCatalogContainer = document.getElementById('admin-catalog-container');
    const serviceUnitSelect = document.getElementById('serviceUnit');
    const analyticsContainer = document.getElementById('analytics-container');
    const analyticsNotice = document.getElementById('analytics-notice');
    const calendarEl = document.getElementById('calendar');
    const calendarStatusFilter = document.getElementById('calendar-status-filter');
    const compositionManager = document.getElementById('composition-manager');

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
            supabase.from('menu_items').select('*').order('name'),
            supabase.from('menu_subitems').select('*').order('name'),
            supabase.from('menu_composition').select('*, item:item_id(*), subitem:subitem_id(*)'),
            supabase.from('units').select('name').order('name')
        ]);

        const [servicesRes, tablesRes, pricesRes, quotesRes, paymentsRes, itemsRes, subitemsRes, compositionRes, unitsRes] = results;
        
        services = (servicesRes.status === 'fulfilled') ? servicesRes.value.data : [];
        priceTables = (tablesRes.status === 'fulfilled') ? tablesRes.value.data : [];
        servicePrices = (pricesRes.status === 'fulfilled') ? pricesRes.value.data : [];
        quotes = (quotesRes.status === 'fulfilled') ? quotesRes.value.data : [];
        paymentMethods = (paymentsRes.status === 'fulfilled') ? paymentsRes.value.data : [];
        menuItems = (itemsRes.status === 'fulfilled') ? itemsRes.value.data : [];
        menuSubitems = (subitemsRes.status === 'fulfilled') ? subitemsRes.value.data : [];
        menuComposition = (compositionRes.status === 'fulfilled') ? compositionRes.value.data : [];
        units = (unitsRes.status === 'fulfilled') ? unitsRes.value.data : [];
        
        renderAll();
    }
    
    // =================================================================
    // RENDERIZAÇÃO
    // =================================================================
    function renderAll() {
        renderSimpleTable(document.getElementById('quotes-table'), quotes, createQuoteRow);
        renderSimpleTable(document.getElementById('events-table'), quotes.filter(q => q.status === 'Ganho'), createEventRow);
        renderSimpleTable(document.getElementById('price-tables-table'), priceTables, createPriceTableRow);
        renderSimpleTable(document.getElementById('payment-methods-table'), paymentMethods, createPaymentMethodRow);
        renderSimpleTable(document.getElementById('menu-items-table'), menuItems, createMenuItemRow);
        renderSimpleTable(document.getElementById('menu-subitems-table'), menuSubitems, createMenuSubitemRow);
        renderAdminCatalog();
        renderCompositionManager();
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
        row.innerHTML = `<td>${quote.client_name || 'Rascunho'}</td><td>${new Date(quote.created_at).toLocaleDateString('pt-BR')}</td><td>${selectHTML}</td><td class="actions"><a href="evento.html?quote_id=${quote.id}" class="btn" style="${quote.status === 'Ganho' ? '' : 'visibility:hidden;'}">Gerenciar</a><a href="index.html?quote_id=${quote.id}" class="btn">Editar</a><button class="btn-remove" data-action="delete-quote" data-id="${quote.id}">&times;</button></td>`;
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
    
    function createMenuItemRow(item) {
        const row = document.createElement('tr');
        row.dataset.id = item.id;
        row.innerHTML = `<td><input type="text" class="editable-input" data-field="name" value="${item.name}"></td><td><input type="text" class="editable-input" data-field="description" value="${item.description || ''}"></td><td class="actions"><button class="btn-remove" data-action="delete-menu-item" data-id="${item.id}">&times;</button></td>`;
        return row;
    }
    
    function createMenuSubitemRow(subitem) {
        const row = document.createElement('tr');
        row.dataset.id = subitem.id;
        row.innerHTML = `<td><input type="text" class="editable-input" data-field="name" value="${subitem.name}"></td><td><input type="text" class="editable-input" data-field="description" value="${subitem.description || ''}"></td><td class="actions"><button class="btn-remove" data-action="delete-menu-subitem" data-id="${subitem.id}">&times;</button></td>`;
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
        const orderedCategories = ['Espaço', 'Gastronomia', 'Equipamentos', 'Serviços e Outros'];
        
        orderedCategories.forEach(category => {
            if (!servicesByCategory[category]) return;
            
            let tableHeaders = `<th>Nome</th><th>Unidade</th>`;
            priceTables.forEach(pt => tableHeaders += `<th class="price-column">${pt.name}</th>`);
            tableHeaders += `<th class="actions">Ações</th>`;
            
            let rowsHtml = servicesByCategory[category].map(service => {
                let priceColumns = priceTables.map(table => {
                    const priceRecord = servicePrices.find(p => p.service_id === service.id && p.price_table_id === table.id);
                    const price = priceRecord ? parseFloat(priceRecord.price).toFixed(2) : '0.00';
                    return `<td class="price-column"><input type="number" step="0.01" min="0" class="service-price-input" data-service-id="${service.id}" data-table-id="${table.id}" value="${price}"></td>`;
                }).join('');
                return `<tr data-id="${service.id}">
                    <td><input type="text" class="editable-input" data-field="name" value="${service.name}"></td>
                    <td>${createUnitSelect(service.unit)}</td>
                    ${priceColumns}
                    <td class="actions"><button class="btn-remove" data-action="delete-service" data-id="${service.id}">&times;</button></td>
                </tr>`;
            }).join('');

            const detailsHtml = `<details class="category-accordion" open>
                <summary class="category-header"><h3 class="category-title">${category}</h3></summary>
                <div class="table-container">
                    <table class="editable-table">
                        <thead><tr>${tableHeaders}</tr></thead>
                        <tbody>${rowsHtml}</tbody>
                    </table>
                </div>
            </details>`;
            adminCatalogContainer.insertAdjacentHTML('beforeend', detailsHtml);
        });
    }

    function renderCompositionManager() {
        if (!compositionManager) return;
        const cardapios = services.filter(s => s.category === 'Gastronomia');
        let html = `
            <div class="form-group">
                <label>1. Selecione o Cardápio Principal para Montagem:</label>
                <select id="select-main-cardapio">
                    <option value="">-- Selecione --</option>
                    ${cardapios.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
                </select>
            </div>
            <div id="composition-details" style="display:none;"></div>
        `;
        compositionManager.innerHTML = html;
    }
    
    function renderCompositionDetails(serviceId) {
        const container = document.getElementById('composition-details');
        if (!container) return;

        const compositionForService = menuComposition.filter(c => c.service_id === serviceId);
        const itemIdsInService = [...new Set(compositionForService.map(c => c.item_id))];
        const itemsInService = itemIdsInService.map(id => menuItems.find(mi => mi.id === id));

        let html = `
            <hr class="section-divider">
            <h4>2. Adicione Itens (Seções) ao Cardápio</h4>
            <form id="add-item-to-service-form" class="inline-form" data-service-id="${serviceId}">
                <div class="form-group">
                    <label>Selecione um Item para adicionar</label>
                    <select name="item_id" required>
                        <option value="">-- Selecione uma seção --</option>
                        ${menuItems.map(item => `<option value="${item.id}">${item.name}</option>`).join('')}
                    </select>
                </div>
                <button type="submit" class="btn btn-primary">Adicionar Seção ao Cardápio</button>
            </form>
            <div id="items-and-subitems-container">`;

        itemsInService.forEach(item => {
            if (!item) return;
            const subitemsInItem = compositionForService.filter(c => c.item_id === item.id);
            const subitemIdsInItem = subitemsInItem.map(comp => comp.subitem_id);
            const availableSubitems = menuSubitems.filter(sub => !subitemIdsInItem.includes(sub.id));

            html += `
                <div class="sub-section item-composition-group">
                    <div class="composition-header">
                        <h5>${item.name}</h5>
                        <button class="btn-remove" title="Remover seção '${item.name}' e todos os seus subitens deste cardápio" data-action="remove-item-from-service" data-service-id="${serviceId}" data-item-id="${item.id}">&times;</button>
                    </div>
                    <ul class="subitem-list">
                        ${subitemsInItem.map(comp => `
                            <li><span>${comp.subitem.name}</span><button class="btn-remove-inline" data-action="remove-subitem-from-item" data-composition-id="${comp.id}">&times;</button></li>
                        `).join('') || '<li>Nenhum subitem adicionado.</li>'}
                    </ul>
                    <form class="add-subitem-form" data-action="add-subitem-to-item" data-service-id="${serviceId}" data-item-id="${item.id}">
                         <div class="form-group">
                            <select name="subitem_id" required>
                                 <option value="">-- Adicionar um subitem --</option>
                                ${availableSubitems.map(sub => `<option value="${sub.id}">${sub.name}</option>`).join('')}
                            </select>
                        </div>
                        <button type="submit" class="btn">Adicionar</button>
                    </form>
                </div>`;
        });
        
        html += `</div>`;
        container.innerHTML = html;
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
            locale: 'pt-br',
            initialView: 'dayGridMonth',
            headerToolbar: { left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek,listWeek' },
            buttonText: { today: 'Hoje', month: 'Mês', week: 'Semana', list: 'Lista' },
            eventClick: (info) => { const { quoteId } = info.event.extendedProps; window.location.href = `evento.html?quote_id=${quoteId}`; },
            height: 'parent',
        });
        calendarInstance.render();
        updateCalendarEvents();
    }
    
    function updateCalendarEvents() {
        if (!calendarInstance) return;
        const statusFilter = calendarStatusFilter.value;
        const statusColors = { 'Ganho': '#28a745', 'Em analise': '#ffc107', 'Rascunho': '#6c757d' };
        let filteredQuotes = quotes.filter(q => q.quote_data?.event_dates?.[0]?.date);
        if (statusFilter !== 'all') {
            filteredQuotes = filteredQuotes.filter(q => q.status === statusFilter);
        }
        const events = filteredQuotes.map(q => {
            const items = q.quote_data?.items || [];
            const spaceNames = items.map(item => {
                const service = services.find(s => s.id === item.service_id);
                return service && service.category === 'Espaço' ? service.name : null;
            }).filter(Boolean).join(' + ');
            let eventTitle = q.client_name;
            if (spaceNames) { eventTitle += ` - ${spaceNames}`; }
            return {
                title: eventTitle,
                start: q.quote_data.event_dates[0].date,
                extendedProps: { quoteId: q.id },
                color: statusColors[q.status] || '#0d6efd',
                borderColor: statusColors[q.status] || '#0d6efd'
            };
        });
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
            document.querySelectorAll('.tabs-nav .tab-btn, .tab-content').forEach(el => el.classList.remove('active'));
            clickedTab.classList.add('active');
            document.getElementById(`tab-content-${clickedTab.dataset.tab}`).classList.add('active');
            if (clickedTab.dataset.tab === 'calendar') initializeCalendar();
        });

        calendarStatusFilter?.addEventListener('change', updateCalendarEvents);
        document.body.addEventListener('click', (e) => {
            const header = e.target.closest('.collapsible-card > .card-header');
            if (header) header.closest('.collapsible-card')?.classList.toggle('collapsed');
        });
        document.getElementById('add-menu-item-form')?.addEventListener('submit', handleFormSubmit);
        document.getElementById('add-menu-subitem-form')?.addEventListener('submit', handleFormSubmit);
        document.getElementById('addServiceForm')?.addEventListener('submit', handleFormSubmit);
        document.getElementById('addPriceTableForm')?.addEventListener('submit', handleFormSubmit);
        document.getElementById('addPaymentMethodForm')?.addEventListener('submit', handleFormSubmit);
        document.getElementById('addUnitForm')?.addEventListener('submit', handleFormSubmit);
        document.body.addEventListener('click', handleTableActions);
        document.body.addEventListener('change', handleTableEdits);

        compositionManager?.addEventListener('change', e => {
            if (e.target.id === 'select-main-cardapio') {
                const serviceId = e.target.value;
                document.getElementById('composition-details').style.display = serviceId ? 'block' : 'none';
                if (serviceId) renderCompositionDetails(serviceId);
            }
        });

        compositionManager?.addEventListener('submit', async e => {
            e.preventDefault();
            const form = e.target;
            const serviceId = form.dataset.serviceId;
            const itemId = form.dataset.itemId || new FormData(form).get('item_id');
            
            if (form.id === 'add-item-to-service-form') {
                 if (!menuSubitems.length) {
                    showNotification("Cadastre ao menos um Subitem antes de montar um cardápio.", true);
                    return;
                }
                const { error } = await supabase.from('menu_composition').insert({ service_id: serviceId, item_id: itemId, subitem_id: menuSubitems[0].id });
                if (error) { showNotification(`Erro ao adicionar item: ${error.message}`, true); } 
                else { showNotification("Seção adicionada. Agora adicione ou troque os subitens."); await fetchData(); renderCompositionDetails(serviceId); }
            } else if (form.classList.contains('add-subitem-form')) {
                const subitemId = new FormData(form).get('subitem_id');
                if(!subitemId) { showNotification("Selecione um subitem para adicionar.", true); return; }
                const { error } = await supabase.from('menu_composition').insert({ service_id: serviceId, item_id: itemId, subitem_id: subitemId });
                if (error) { showNotification(`Erro ao adicionar subitem: ${error.message}`, true); } 
                else { showNotification("Subitem adicionado."); await fetchData(); renderCompositionDetails(serviceId); }
            }
        });
        
        compositionManager?.addEventListener('click', async e => {
            const button = e.target.closest('button[data-action]');
            if (!button) return;
            const serviceId = document.getElementById('select-main-cardapio').value;
            
            if (button.dataset.action === 'remove-subitem-from-item') {
                if (!confirm("Remover este subitem do cardápio?")) return;
                const { error } = await supabase.from('menu_composition').delete().eq('id', button.dataset.compositionId);
                if (error) { showNotification(error.message, true); } else { showNotification("Subitem removido."); await fetchData(); renderCompositionDetails(serviceId); }
            }
            if (button.dataset.action === 'remove-item-from-service') {
                if (!confirm("Remover esta seção e todos os seus subitens do cardápio?")) return;
                const { itemId } = button.dataset;
                const { error } = await supabase.from('menu_composition').delete().match({ service_id: serviceId, item_id: itemId });
                 if (error) { showNotification(error.message, true); } else { showNotification("Seção removida."); await fetchData(); renderCompositionDetails(serviceId); }
            }
        });
    }

    async function handleFormSubmit(e) {
        e.preventDefault();
        const form = e.target;
        let result, successMessage = 'Salvo com sucesso!';
        try {
            switch (form.id) {
                case 'add-menu-subitem-form':
                    result = await supabase.from('menu_subitems').insert([{ name: form.querySelector('#subitemName').value, description: form.querySelector('#subitemDescription').value }]);
                    break;
                case 'add-menu-item-form':
                    result = await supabase.from('menu_items').insert([{ name: form.querySelector('#itemName').value, description: form.querySelector('#itemDescription').value }]);
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
        const tables = {
            'delete-quote': 'quotes', 'delete-service': 'services', 'delete-table': 'price_tables',
            'delete-payment-method': 'payment_methods',
            'delete-menu-item': 'menu_items',
            'delete-menu-subitem': 'menu_subitems',
            'delete-unit': 'units'
        };
        if (tables[action]) {
            if (!confirm('Tem certeza que deseja excluir?')) return;
            const { error } = await supabase.from(tables[action]).delete().eq(action === 'delete-unit' ? 'name' : 'id', id);
            if (error) { showNotification(`Erro: ${error.message}`, true); }
            else { showNotification('Registro excluído.'); fetchData(); }
        }
    }
    
    async function handleTableEdits(e) {
        const input = e.target;
        if (!input.matches('.editable-input, .status-select, .service-price-input')) return;
        
        if (input.classList.contains('service-price-input')) {
            const { serviceId, tableId } = input.dataset;
            const { error } = await supabase.from('service_prices').upsert({ service_id: serviceId, price_table_id: tableId, price: input.value }, { onConflict: 'service_id, price_table_id' });
            if (error) { showNotification(`Erro: ${error.message}`, true); } else { showFlash(input); }
            return;
        }

        const row = input.closest('tr');
        const id = row.dataset.id;
        if(!id) return;

        const { field } = input.dataset;
        const value = input.value;
        const table = row.closest('table');
        if (!table) return;

        const tableMap = {
            'menu-subitems-table': 'menu_subitems',
            'menu-items-table': 'menu_items',
            'payment-methods-table': 'payment_methods',
            'price-tables-table': 'price_tables',
            'units-table': 'units',
            'quotes-table': 'quotes',
        };

        let tableName = tableMap[table.id] || (table.closest('#admin-catalog-container') ? 'services' : null);
        if (tableName) {
            const { error } = await supabase.from(tableName).update({ [field]: value }).eq(tableName === 'units' ? 'name' : 'id', id);
            if (error) { showNotification(`Erro: ${error.message}`, true); fetchData(); }
            else { showFlash(input); }
        }
    }
    
    initialize();
});
