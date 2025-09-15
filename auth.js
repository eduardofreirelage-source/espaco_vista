import { supabase, getSession } from './supabase-client.js';

document.addEventListener('DOMContentLoaded', async () => {
    // Garante que o script só execute na página de admin
    if (!document.querySelector('.tabs-nav')) {
        return;
    }
    
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
    let services = [], priceTables = [], servicePrices = [], quotes = [];
    let paymentMethods = [], menus = [], menuItems = [];
    
    const analyticsContainer = document.getElementById('analytics-container');
    const analyticsNotice = document.getElementById('analytics-notice');
    const calendarEl = document.getElementById('calendar');
    const calendarStatusFilter = document.getElementById('calendar-status-filter');
    const notification = document.getElementById('save-notification');
    const paymentMethodsTbody = document.getElementById('payment-methods-table')?.querySelector('tbody');
    const menusTbody = document.getElementById('menus-table')?.querySelector('tbody');
    const menuItemsTbody = document.getElementById('menu-items-table')?.querySelector('tbody');
    const selectMenuToEdit = document.getElementById('select-menu-to-edit');
    const menuItemsSection = document.getElementById('menu-items-section');
    const gastronomyItemSelect = document.getElementById('gastronomy-item-select');
    // NOVO: Seletor para a nova tabela de itens de gastronomia
    const gastronomyItemsTbody = document.getElementById('gastronomy-items-table')?.querySelector('tbody');
    
    let calendarInstance = null; 
    let debounceTimers = {};

    // --- INICIALIZAÇÃO ---
    async function initialize() {
        addEventListeners();
        await fetchData();
        if (document.querySelector('.tab-btn[data-tab="calendar"].active')) {
            initializeCalendar();
        }
    }

    async function fetchData() {
        try {
            const results = await Promise.allSettled([
                supabase.from('services').select('*').order('category').order('name'),
                supabase.from('price_tables').select('*').order('name'),
                supabase.from('service_prices').select('*'),
                supabase.from('quotes').select('*, clients(*)').order('created_at', { ascending: false }),
                supabase.from('payment_methods').select('*').order('name'),
                supabase.from('menus').select('*').order('name'),
                supabase.from('menu_items').select('*, services(name)')
            ]);

            const [servicesRes, tablesRes, pricesRes, quotesRes, paymentsRes, menusRes, menuItemsRes] = results;

            services = (servicesRes.status === 'fulfilled' && servicesRes.value.data) ? servicesRes.value.data : [];
            if (servicesRes.status === 'rejected') console.error("Erro ao buscar services:", servicesRes.reason);
            priceTables = (tablesRes.status === 'fulfilled' && tablesRes.value.data) ? tablesRes.value.data : [];
            if (tablesRes.status === 'rejected') console.error("Erro ao buscar price_tables:", tablesRes.reason);
            servicePrices = (pricesRes.status === 'fulfilled' && pricesRes.value.data) ? pricesRes.value.data : [];
            if (pricesRes.status === 'rejected') console.error("Erro ao buscar service_prices:", pricesRes.reason);
            quotes = (quotesRes.status === 'fulfilled' && quotesRes.value.data) ? quotesRes.value.data : [];
            if (quotesRes.status === 'rejected') console.error("Erro ao buscar quotes:", quotesRes.reason);
            paymentMethods = (paymentsRes.status === 'fulfilled' && paymentsRes.value.data) ? paymentsRes.value.data : [];
            if (paymentsRes.status === 'rejected') console.warn("Aviso: Não foi possível buscar 'payment_methods'.", paymentsRes.reason);
            menus = (menusRes.status === 'fulfilled' && menusRes.value.data) ? menusRes.value.data : [];
            if (menusRes.status === 'rejected') console.warn("Aviso: Não foi possível buscar 'menus'.", menusRes.reason);
            menuItems = (menuItemsRes.status === 'fulfilled' && menuItemsRes.value.data) ? menuItemsRes.value.data : [];
            if (menuItemsRes.status === 'rejected') console.warn("Aviso: Não foi possível buscar 'menu_items'.", menuItemsRes.reason);

            renderAll();
        } catch (error) {
            showNotification(`Um erro geral ocorreu ao carregar dados: ${error.message}`, true);
            console.error("Falha geral no fetchData:", error);
        }
    }

    // --- RENDERIZAÇÃO ---
    function renderAll() {
        renderQuotesTable();
        renderEventsTable();
        renderAnalytics();
        renderAdminCatalog();
        renderPriceTablesList();
        renderPaymentMethods();
        renderMenus();
        renderGastronomyItems(); // NOVO
        populateGastronomyItemsSelect();
    }
    
    // ... (funções de renderização existentes: renderQuotesTable, etc.) ...
    
    // NOVO: Renderiza a tabela dedicada a itens de gastronomia
    function renderGastronomyItems() {
        if (!gastronomyItemsTbody) return;
        gastronomyItemsTbody.innerHTML = '';
        const gastronomyServices = services.filter(s => s.category === 'Gastronomia');
        
        gastronomyServices.forEach(service => {
            const row = gastronomyItemsTbody.insertRow();
            row.dataset.serviceId = service.id; // Usa serviceId para consistência
            row.innerHTML = `
                <td><input type="text" class="service-detail-input" data-field="name" value="${service.name}"></td>
                <td>${createUnitSelect(service.unit)}</td>
                <td class="actions">
                    <button class="btn-remove" data-action="delete-service" data-id="${service.id}" title="Excluir Item">&times;</button>
                </td>
            `;
        });
    }

    // ... (restante das funções de renderização) ...

    // --- EVENT LISTENERS ---
    function addEventListeners() {
        // ... (listeners existentes) ...
        document.getElementById('addGastronomyItemForm')?.addEventListener('submit', addGastronomyItem);

        // Adiciona listener para a nova tabela (reutiliza o handler existente)
        gastronomyItemsTbody?.addEventListener('change', (e) => {
            if (e.target.classList.contains('service-detail-input')) {
                handleServiceEdit(e.target, false);
            }
        });
        
        // ... (restante dos listeners) ...
    }
    
    // --- FUNÇÕES DE CRUD PARA NOVAS SEÇÕES ---

    // NOVO: Adiciona um item de gastronomia (um serviço com categoria pré-definida)
    async function addGastronomyItem(e) {
        e.preventDefault();
        const nameInput = document.getElementById('gastronomyItemName');
        const unitSelect = document.getElementById('gastronomyItemUnit');
        const name = nameInput.value.trim();
        const unit = unitSelect.value;

        if (!name) return;

        const newService = {
            name: name,
            unit: unit,
            category: 'Gastronomia' // Categoria é fixa
        };

        const { error } = await supabase.from('services').insert([newService]);
        if (error) {
            showNotification(`Erro ao adicionar item: ${error.message}`, true);
        } else {
            showNotification('Item de cardápio adicionado com sucesso.');
            nameInput.value = '';
            await fetchData(); // Recarrega todos os dados para manter a consistência
        }
    }
    
    // ... (restante das funções de CRUD e outras funções auxiliares) ...
    
    // O restante do seu arquivo auth.js deve ser colado aqui para manter todas as funcionalidades.
    // Cole desde "formatCurrency" até o final.

    function formatCurrency(value) { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(parseFloat(value) || 0); }
    function renderQuotesTable() { const quotesTable = document.getElementById('quotes-table'); const tbody = quotesTable?.querySelector('tbody'); if (!tbody) return; tbody.innerHTML = ''; const statusOptions = ['Rascunho', 'Em analise', 'Ganho', 'Perdido']; quotes.forEach(quote => { const row = tbody.insertRow(); row.dataset.quoteId = quote.id; const createdAt = new Date(quote.created_at).toLocaleDateString('pt-BR'); const selectHTML = `<select class="status-select" data-id="${quote.id}">${statusOptions.map(opt => `<option value="${opt}" ${quote.status === opt ? 'selected' : ''}>${opt}</option>`).join('')}</select>`; row.innerHTML = `<td>${quote.client_name || 'Rascunho sem nome'}</td><td>${createdAt}</td><td>${selectHTML}</td><td class="actions"><a href="index.html?quote_id=${quote.id}" class="btn" title="Editar Orçamento">Editar</a><a href="evento.html?quote_id=${quote.id}" class="btn" title="Gerenciar Evento" style="${quote.status === 'Ganho' ? '' : 'display:none;'}">Gerenciar</a><button class="btn-remove" data-action="delete-quote" data-id="${quote.id}" title="Excluir Orçamento">&times;</button></td>`; }); }
    function renderEventsTable() { const eventsTable = document.getElementById('events-table'); const tbody = eventsTable?.querySelector('tbody'); if (!tbody) return; tbody.innerHTML = ''; const events = quotes.filter(q => q.status === 'Ganho'); events.forEach(event => { const row = tbody.insertRow(); const eventDate = event.quote_data?.event_dates?.[0]?.date ? new Date(event.quote_data.event_dates[0].date + 'T12:00:00Z').toLocaleDateString('pt-BR') : 'Data não definida'; row.innerHTML = `<td>${event.client_name}</td><td>${eventDate}</td><td>${formatCurrency(event.total_value)}</td><td class="actions"><a href="evento.html?quote_id=${event.id}" class="btn" title="Gerenciar Evento">Gerenciar</a></td>`; }); }
    function renderAnalytics() { if (!analyticsContainer || !analyticsNotice) return; analyticsContainer.innerHTML = ''; if (quotes.length === 0) { analyticsNotice.textContent = 'Nenhuma proposta encontrada no sistema para gerar análises.'; analyticsNotice.style.display = 'block'; return; } const now = new Date(); const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1); const currentMonthQuotes = quotes.filter(q => new Date(q.created_at) >= startOfCurrentMonth); if (currentMonthQuotes.length === 0) { analyticsNotice.textContent = 'Nenhuma proposta encontrada para o mês atual.'; analyticsNotice.style.display = 'block'; return; } analyticsNotice.style.display = 'none'; const startOfPreviousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1); const endOfPreviousMonth = new Date(now.getFullYear(), now.getMonth(), 0); const previousMonthQuotes = quotes.filter(q => { const createdAt = new Date(q.created_at); return createdAt >= startOfPreviousMonth && createdAt <= endOfPreviousMonth; }); const currentMetrics = aggregateQuoteMetrics(currentMonthQuotes); const previousMetrics = aggregateQuoteMetrics(previousMonthQuotes); analyticsContainer.innerHTML = `${createKpiCard('Ganhos', currentMetrics.Ganho, previousMetrics.Ganho)}${createKpiCard('Perdidos', currentMetrics.Perdido, previousMetrics.Perdido)}${createKpiCard('Em Análise', currentMetrics['Em analise'], previousMetrics['Em analise'])}`; }
    function aggregateQuoteMetrics(quoteArray) { const initialMetrics = { 'Ganho': { count: 0, value: 0 }, 'Perdido': { count: 0, value: 0 }, 'Em analise': { count: 0, value: 0 }, 'Rascunho': { count: 0, value: 0 } }; return quoteArray.reduce((acc, quote) => { if (acc[quote.status]) { acc[quote.status].count++; acc[quote.status].value += parseFloat(quote.total_value || 0); } return acc; }, initialMetrics); }
    function createKpiCard(title, current, previous) { const percentageChange = calculatePercentageChange(current.value, previous.value); const trendClass = percentageChange.startsWith('+') && parseFloat(percentageChange) > 0 ? 'increase' : percentageChange.startsWith('-') ? 'decrease' : ''; const trendIndicator = trendClass ? `<span class="percentage ${trendClass}">${percentageChange}</span>` : ''; return `<div class="kpi-card"><div class="kpi-title">${title} (Mês Atual)</div><div class="kpi-value">${formatCurrency(current.value)}</div><div class="kpi-sub-value">${current.count} propostas</div><div class="kpi-comparison">${trendIndicator}<span>em relação ao mês anterior (${formatCurrency(previous.value)})</span></div></div>`; }
    function calculatePercentageChange(current, previous) { if (previous === 0) { return current > 0 ? '+∞%' : '0%'; } const change = ((current - previous) / previous) * 100; return `${change > 0 ? '+' : ''}${change.toFixed(0)}%`; }
    function renderPriceTablesList() { const priceTablesTbody = document.getElementById('price-tables-list')?.querySelector('tbody'); if (!priceTablesTbody) return; priceTablesTbody.innerHTML = ''; priceTables.forEach(table => { const row = priceTablesTbody.insertRow(); row.dataset.tableId = table.id; const consumable = parseFloat(table.consumable_credit || 0).toFixed(2); row.innerHTML = `<td><input type="text" class="price-table-input" data-field="name" value="${table.name}"></td><td class="price-column"><input type="number" step="0.01" min="0" class="price-table-input" data-field="consumable_credit" value="${consumable}"></td><td class="actions"><button class="btn-remove" data-action="delete-table" data-id="${table.id}" title="Excluir Lista">&times;</button></td>`; }); }
    function renderAdminCatalog() { const adminCatalogContainer = document.getElementById('admin-catalog-container'); if (!adminCatalogContainer) return; adminCatalogContainer.innerHTML = ''; const servicesByCategory = services.reduce((acc, service) => { if (!acc[service.category]) { acc[service.category] = []; } acc[service.category].push(service); return acc; }, {}); const orderedCategories = ['Espaço', 'Gastronomia', 'Equipamentos', 'Serviços / Outros']; orderedCategories.forEach(category => { if (!servicesByCategory[category]) return; const categoryWrapper = document.createElement('div'); categoryWrapper.innerHTML = `<details class="category-accordion" open><summary class="category-header"><h3 class="category-title">${category}</h3></summary><div class="table-container"><table class="editable-table"><thead><tr><th>Nome</th><th>Unidade</th>${priceTables.map(pt => `<th class="price-column">${pt.name}</th>`).join('')}<th class="actions">Ações</th></tr></thead><tbody>${servicesByCategory[category].map(service => `<tr data-service-id="${service.id}"><td><input type="text" class="service-detail-input" data-field="name" value="${service.name}"></td><td>${createUnitSelect(service.unit)}</td>${priceTables.map(table => { const priceRecord = servicePrices.find(p => p.service_id === service.id && p.price_table_id === table.id); const price = priceRecord ? parseFloat(priceRecord.price).toFixed(2) : '0.00'; return `<td class="price-column"><input type="number" step="0.01" min="0" class="service-price-input" data-table-id="${table.id}" value="${price}"></td>`; }).join('')}<td class="actions"><button class="btn-remove" data-action="delete-service" data-id="${service.id}" title="Excluir Serviço">&times;</button></td></tr>`).join('')}</tbody></table></div></details>`; adminCatalogContainer.appendChild(categoryWrapper); }); }
    function createUnitSelect(currentUnit) { const units = ['unidade', 'diaria', 'por_pessoa']; return `<select class="service-detail-input" data-field="unit">${units.map(unit => `<option value="${unit}" ${unit === currentUnit ? 'selected' : ''}>${unit}</option>`).join('')}</select>`; }
    function renderPaymentMethods() { if (!paymentMethodsTbody) return; paymentMethodsTbody.innerHTML = ''; paymentMethods.forEach(method => { const row = paymentMethodsTbody.insertRow(); row.dataset.id = method.id; row.innerHTML = `<td><input type="text" class="editable-input" data-field="name" value="${method.name}"></td><td class="actions"><button class="btn-remove" data-action="delete-payment-method" data-id="${method.id}" title="Excluir">&times;</button></td>`; }); }
    function renderMenus() { if (!menusTbody || !selectMenuToEdit) return; menusTbody.innerHTML = ''; selectMenuToEdit.innerHTML = '<option value="">-- Selecione --</option>'; menus.forEach(menu => { const row = menusTbody.insertRow(); row.dataset.id = menu.id; row.innerHTML = `<td><input type="text" class="editable-input" data-field="name" value="${menu.name}"></td><td><input type="text" class="editable-input" data-field="description" value="${menu.description || ''}"></td><td class="actions"><button class="btn-remove" data-action="delete-menu" data-id="${menu.id}" title="Excluir">&times;</button></td>`; const option = new Option(menu.name, menu.id); selectMenuToEdit.add(option); }); }
    function populateGastronomyItemsSelect() { if (!gastronomyItemSelect) return; gastronomyItemSelect.innerHTML = ''; const gastronomyServices = services.filter(s => s.category === 'Gastronomia'); gastronomyServices.forEach(service => { const option = new Option(service.name, service.id); gastronomyItemSelect.add(option); }); }
    function renderMenuItems(menuId) { if (!menuItemsTbody) return; menuItemsTbody.innerHTML = ''; const items = menuItems.filter(item => item.menu_id == menuId); items.forEach(item => { const row = menuItemsTbody.insertRow(); row.dataset.id = item.id; row.innerHTML = `<td>${item.services?.name || 'Serviço não encontrado'}</td><td class="actions"><button class="btn-remove" data-action="delete-menu-item" data-id="${item.id}" title="Remover item">&times;</button></td>`; }); }
    function initializeCalendar() { if (!calendarEl || calendarInstance) return; let noticeEl = document.getElementById('calendar-notice'); if (!noticeEl) { noticeEl = document.createElement('div'); noticeEl.id = 'calendar-notice'; noticeEl.className = 'analytics-notice'; noticeEl.style.display = 'none'; calendarEl.parentNode.insertBefore(noticeEl, calendarEl); } calendarInstance = new FullCalendar.Calendar(calendarEl, { locale: 'pt-br', initialView: 'dayGridMonth', headerToolbar: { left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek,listWeek' }, events: [], eventColor: '#8B0000', eventClick: (info) => { const { quoteId, spaceName, clientName } = info.event.extendedProps; if (confirm(`Cliente: ${clientName}\nEspaço: ${spaceName}\n\nClique em OK para gerenciar este evento.`)) { window.location.href = `evento.html?quote_id=${quoteId}`; } } }); updateCalendarEvents(); calendarInstance.render(); }
    function updateCalendarEvents() { if (!calendarInstance) return; const selectedStatus = calendarStatusFilter.value; let filteredQuotes = quotes; if (selectedStatus !== 'Todos') { filteredQuotes = quotes.filter(q => q.status === selectedStatus); } const calendarEvents = []; filteredQuotes.forEach(quote => { if (quote.quote_data && quote.quote_data.items) { const spaceItems = quote.quote_data.items.filter(item => { const service = services.find(s => s.id === item.service_id); return service && service.category?.toLowerCase() === 'espaço'; }); spaceItems.forEach(item => { const service = services.find(s => s.id === item.service_id); if (item.event_date && service) { calendarEvents.push({ title: `${quote.client_name} (${service.name})`, start: item.event_date, allDay: true, extendedProps: { quoteId: quote.id, spaceName: service.name, clientName: quote.client_name } }); } }); } }); calendarInstance.removeAllEvents(); calendarInstance.addEventSource(calendarEvents); const noticeEl = document.getElementById('calendar-notice'); if (calendarEvents.length === 0) { noticeEl.innerHTML = `<strong>Nenhum evento encontrado para o filtro '${selectedStatus}'.</strong><br>Para um evento aparecer, a proposta deve ter o status correspondente, conter um serviço da categoria 'Espaço' e o serviço deve ter uma data de evento atribuída.`; noticeEl.style.display = 'block'; } else { noticeEl.style.display = 'none'; } }
    function setupTabEvents() { const tabsNav = document.querySelector('.tabs-nav'); if (!tabsNav) return; tabsNav.addEventListener('click', (e) => { const clickedTab = e.target.closest('.tab-btn'); if (!clickedTab) return; const tabId = clickedTab.dataset.tab; tabsNav.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active')); document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active')); clickedTab.classList.add('active'); document.getElementById(`tab-content-${tabId}`).classList.add('active'); if (tabId === 'calendar') { initializeCalendar(); } }); }
    function setupCollapsibleEvents() { document.body.addEventListener('click', e => { const header = e.target.closest('.collapsible-card > .card-header'); if (header) { const card = header.closest('.collapsible-card'); if (card) card.classList.toggle('collapsed'); } }); }
    function addEventListeners() { setupTabEvents(); setupCollapsibleEvents(); const addServiceForm = document.getElementById('addServiceForm'); const addPriceTableForm = document.getElementById('addPriceTableForm'); addServiceForm?.addEventListener('submit', async (e) => { e.preventDefault(); const newService = { name: document.getElementById('serviceName').value, category: document.getElementById('serviceCategory').value, unit: document.getElementById('serviceUnit').value }; const { error } = await supabase.from('services').insert([newService]); if (error) { showNotification(`Erro: ${error.message}`, true); } else { showNotification('Serviço adicionado!'); e.target.reset(); fetchData(); } }); addPriceTableForm?.addEventListener('submit', async (e) => { e.preventDefault(); const newTable = { name: document.getElementById('tableName').value, consumable_credit: parseFloat(document.getElementById('tableConsumable').value) || 0 }; const { error } = await supabase.from('price_tables').insert([newTable]); if (error) { showNotification(`Erro: ${error.message}`, true); } else { showNotification('Lista de preços adicionada!'); e.target.reset(); fetchData(); } }); const quotesTbody = document.getElementById('quotes-table')?.querySelector('tbody'); const adminCatalogContainer = document.getElementById('admin-catalog-container'); const priceTablesTbody = document.getElementById('price-tables-list')?.querySelector('tbody'); adminCatalogContainer?.addEventListener('input', (e) => { if (e.target.matches('.service-detail-input[type="text"]')) { handleServiceEdit(e.target, true); } }); adminCatalogContainer?.addEventListener('change', (e) => { if (e.target.matches('.service-detail-input:not([type="text"])') || e.target.matches('.service-price-input')) { handleServiceEdit(e.target, false); } }); priceTablesTbody?.addEventListener('input', (e) => { if (e.target.matches('.price-table-input[data-field="name"]')) { handlePriceTableEdit(e.target, true); } }); priceTablesTbody?.addEventListener('change', (e) => { if (e.target.matches('.price-table-input[data-field="consumable_credit"]')) { handlePriceTableEdit(e.target, false); } }); quotesTbody?.addEventListener('change', async (e) => { if (e.target.classList.contains('status-select')) { const quoteId = e.target.dataset.id; const newStatus = e.target.value; await updateQuoteStatus(quoteId, newStatus); } }); calendarStatusFilter?.addEventListener('change', updateCalendarEvents); document.getElementById('addPaymentMethodForm')?.addEventListener('submit', addPaymentMethod); document.getElementById('addMenuForm')?.addEventListener('submit', addMenu); document.getElementById('add-item-to-menu-form')?.addEventListener('submit', addItemToMenu); paymentMethodsTbody?.addEventListener('change', (e) => { if (e.target.classList.contains('editable-input')) { const id = e.target.closest('tr').dataset.id; updatePaymentMethod(id, e.target.dataset.field, e.target.value); } }); menusTbody?.addEventListener('change', (e) => { if (e.target.classList.contains('editable-input')) { const id = e.target.closest('tr').dataset.id; updateMenu(id, e.target.dataset.field, e.target.value); } }); selectMenuToEdit?.addEventListener('change', (e) => { if (e.target.value) { menuItemsSection.style.display = 'block'; renderMenuItems(e.target.value); } else { menuItemsSection.style.display = 'none'; } }); document.body.addEventListener('click', e => { const button = e.target.closest('button[data-action]'); if (!button) return; const { action, id } = button.dataset; if (action === 'delete-quote') deleteQuote(id); if (action === 'delete-service') deleteService(id); if (action === 'delete-table') deletePriceTable(id); if (action === 'delete-payment-method') deletePaymentMethod(id); if (action === 'delete-menu') deleteMenu(id); if (action === 'delete-menu-item') deleteMenuItem(id); }); document.getElementById('addGastronomyItemForm')?.addEventListener('submit', addGastronomyItem); gastronomyItemsTbody?.addEventListener('change', (e) => { if (e.target.classList.contains('service-detail-input')) { handleServiceEdit(e.target, false); } }); }
    function handleServiceEdit(inputElement, useDebounce) { const row = inputElement.closest('tr'); if (!row) return; const serviceId = row.dataset.serviceId; const timerKey = `service-${serviceId}-${inputElement.dataset.field || inputElement.dataset.tableId}`; if (debounceTimers[timerKey]) { clearTimeout(debounceTimers[timerKey]); } const action = () => { if (inputElement.classList.contains('service-detail-input')) { updateServiceDetail(serviceId, inputElement.dataset.field, inputElement.value, inputElement); } else if (inputElement.classList.contains('service-price-input')) { const price = parseFloat(inputElement.value) || 0; if (!useDebounce) { inputElement.value = price.toFixed(2); } updateServicePrice(serviceId, inputElement.dataset.tableId, price, inputElement); } }; if (useDebounce) { debounceTimers[timerKey] = setTimeout(action, 500); } else { action(); } }
    function handlePriceTableEdit(inputElement, useDebounce) { const row = inputElement.closest('tr'); if (!row) return; const tableId = row.dataset.tableId; const field = inputElement.dataset.field; const timerKey = `table-${tableId}-${field}`; if (debounceTimers[timerKey]) { clearTimeout(debounceTimers[timerKey]); } const action = () => { let value = inputElement.value; if (field === 'consumable_credit') { value = parseFloat(value) || 0; if (!useDebounce) { inputElement.value = value.toFixed(2); } } updatePriceTableDetail(tableId, field, value, inputElement); }; if (useDebounce) { debounceTimers[timerKey] = setTimeout(action, 500); } else { action(); } }
    async function updateQuoteStatus(id, status) { const { error } = await supabase.from('quotes').update({ status: status }).eq('id', id); if (error) { showNotification(`Erro ao atualizar status: ${error.message}`, true); } else { showNotification('Status atualizado com sucesso!'); await fetchData(); } }
    async function updatePriceTableDetail(tableId, field, value, inputElement) { if (!tableId || !field) return; if (field === 'name' && !value.trim()) { showNotification('O nome da lista não pode ficar vazio.', true); fetchData(); return; } const { error } = await supabase.from('price_tables').update({ [field]: value }).eq('id', tableId); if (error) { showNotification(`Erro ao atualizar: ${error.message}`, true); fetchData(); } else { showFlash(inputElement); if (field === 'name') { fetchData(); } } }
    async function updateServiceDetail(serviceId, field, value, inputElement) { if (!serviceId || !field) return; if (field === 'name' && !value.trim()) { showNotification('O nome do serviço não pode ficar vazio.', true); fetchData(); return; } const { error } = await supabase.from('services').update({ [field]: value }).eq('id', serviceId); if (error) { showNotification(`Erro ao atualizar: ${error.message}`, true); fetchData(); } else { showFlash(inputElement); } }
    async function updateServicePrice(serviceId, tableId, price, inputElement) { if (!serviceId || !tableId) return; const recordToUpsert = { service_id: serviceId, price_table_id: tableId, price: price }; const { error } = await supabase.from('service_prices').upsert(recordToUpsert, { onConflict: 'service_id, price_table_id' }); if (error) { showNotification(`Erro ao atualizar preço: ${error.message}`, true); fetchData(); } else { showFlash(inputElement); } }
    async function deleteService(id) { if (!confirm('Tem certeza? Isso excluirá o serviço e todos os seus preços.')) return; const { error } = await supabase.from('services').delete().eq('id', id); if (error) { showNotification(`Erro: ${error.message}`, true); } else { showNotification('Serviço excluído.'); fetchData(); } }
    async function deletePriceTable(id) { if (!confirm('Tem certeza? Isso excluirá a lista e todos os preços associados a ela.')) return; const { error } = await supabase.from('price_tables').delete().eq('id', id); if (error) { showNotification(`Erro: ${error.message}`, true); } else { showNotification('Lista de preços excluída.'); fetchData(); } }
    async function deleteQuote(id) { if (!confirm('Tem certeza que deseja excluir este orçamento?')) return; const { error } = await supabase.from('quotes').delete().eq('id', id); if (error) { showNotification(`Erro: ${error.message}`, true); } else { showNotification('Orçamento excluído.'); fetchData(); } }
    async function addPaymentMethod(e) { e.preventDefault(); const input = document.getElementById('paymentMethodName'); const name = input.value.trim(); if (!name) return; const { error } = await supabase.from('payment_methods').insert([{ name }]); if (error) { showNotification(`Erro: ${error.message}`, true); } else { showNotification('Forma de pagamento adicionada.'); input.value = ''; await fetchData(); } }
    async function updatePaymentMethod(id, field, value) { const { error } = await supabase.from('payment_methods').update({ [field]: value }).eq('id', id); if (error) { showNotification(`Erro ao atualizar.`, true); await fetchData(); } else { showFlash(document.querySelector(`#payment-methods-table [data-id="${id}"] [data-field="${field}"]`)); } }
    async function deletePaymentMethod(id) { if (!confirm('Tem certeza?')) return; const { error } = await supabase.from('payment_methods').delete().eq('id', id); if (error) { showNotification(`Erro: ${error.message}`, true); } else { showNotification('Forma de pagamento excluída.'); await fetchData(); } }
    async function addMenu(e) { e.preventDefault(); const nameInput = document.getElementById('menuName'); const descInput = document.getElementById('menuDescription'); const name = nameInput.value.trim(); const description = descInput.value.trim(); if (!name) return; const { error } = await supabase.from('menus').insert([{ name, description }]); if (error) { showNotification(`Erro: ${error.message}`, true); } else { showNotification('Cardápio adicionado.'); nameInput.value = ''; descInput.value = ''; await fetchData(); } }
    async function updateMenu(id, field, value) { const { error } = await supabase.from('menus').update({ [field]: value }).eq('id', id); if (error) { showNotification(`Erro ao atualizar.`, true); await fetchData(); } else { showFlash(document.querySelector(`#menus-table [data-id="${id}"] [data-field="${field}"]`)); } }
    async function deleteMenu(id) { if (!confirm('Tem certeza? Isso excluirá o cardápio e todos os seus itens.')) return; const { error } = await supabase.from('menus').delete().eq('id', id); if (error) { showNotification(`Erro: ${error.message}`, true); } else { showNotification('Cardápio excluído.'); await fetchData(); } }
    async function addItemToMenu(e) { e.preventDefault(); const menu_id = selectMenuToEdit.value; const service_id = gastronomyItemSelect.value; if (!menu_id || !service_id) return; const { error } = await supabase.from('menu_items').insert([{ menu_id, service_id }]); if (error) { showNotification(`Erro: ${error.message}. O item já pode estar no cardápio.`, true); } else { showNotification('Item adicionado ao cardápio.'); await fetchData(); renderMenuItems(menu_id); } }
    async function deleteMenuItem(id) { if (!confirm('Remover este item do cardápio?')) return; const menu_id = selectMenuToEdit.value; const { error } = await supabase.from('menu_items').delete().eq('id', id); if (error) { showNotification(`Erro: ${error.message}`, true); } else { showNotification('Item removido.'); await fetchData(); renderMenuItems(menu_id); } }
    function showFlash(inputElement) { if (inputElement) { inputElement.classList.add('success-flash'); setTimeout(() => inputElement.classList.remove('success-flash'), 1500); } }
    function showNotification(message, isError = false) { if (!notification) return; notification.textContent = message; notification.style.backgroundColor = isError ? 'var(--danger-color)' : 'var(--success-color)'; notification.classList.add('show'); setTimeout(() => notification.classList.remove('show'), 5000); }
    
    initialize();
});
