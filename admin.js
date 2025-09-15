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
    let services = [], priceTables = [], servicePrices = [], quotes = [];
    
    const adminCatalogContainer = document.getElementById('admin-catalog-container');
    const priceTablesTbody = document.getElementById('price-tables-list')?.querySelector('tbody');
    const quotesTbody = document.getElementById('quotes-table')?.querySelector('tbody');
    const eventsTbody = document.getElementById('events-table')?.querySelector('tbody');
    const analyticsContainer = document.getElementById('analytics-container');
    const addServiceForm = document.getElementById('addServiceForm');
    const addPriceTableForm = document.getElementById('addPriceTableForm');
    const notification = document.getElementById('save-notification');
    let debounceTimers = {};

    // =================================================================
    // INICIALIZAÇÃO
    // =================================================================
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
                supabase.from('quotes').select('id, client_name, created_at, status, total_value, quote_data').order('created_at', { ascending: false })
            ]);

            if (servicesRes.error) throw servicesRes.error;
            if (tablesRes.error) throw tablesRes.error;
            if (pricesRes.error) throw pricesRes.error;
            if (quotesRes.error) throw quotesRes.error;

            services = servicesRes.data || [];
            priceTables = tablesRes.data || [];
            servicePrices = pricesRes.data || [];
            quotes = quotesRes.data || [];

            renderAll();
        } catch (error) {
            showNotification(`Erro ao carregar dados: ${error.message}`, true);
        }
    }

    // =================================================================
    // FUNÇÕES DE RENDERIZAÇÃO
    // =================================================================
    function renderAll() {
        renderPriceTablesList();
        renderAdminCatalog();
        renderQuotesTable();
        renderEventsTable();
        renderAnalytics();
    }

    function createCategorySelect(currentCategory) {
        const categories = ['Espaço', 'Gastronomia', 'Equipamentos', 'Serviços / Outros'];
        return `<select class="service-detail-input" data-field="category">${categories.map(cat => `<option value="${cat}" ${cat === currentCategory ? 'selected' : ''}>${cat}</option>`).join('')}</select>`;
    }

    function createUnitSelect(currentUnit) {
        const units = ['unidade', 'diaria', 'por_pessoa'];
        return `<select class="service-detail-input" data-field="unit">${units.map(unit => `<option value="${unit}" ${unit === currentUnit ? 'selected' : ''}>${unit}</option>`).join('')}</select>`;
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
            const selectHTML = `<select class="status-select" data-id="${quote.id}">${statusOptions.map(opt => `<option value="${opt}" ${quote.status === opt ? 'selected' : ''}>${opt}</option>`).join('')}</select>`;
            
            let actionsHTML = `
                <a href="index.html?quote_id=${quote.id}" class="btn" title="Editar Orçamento">Editar</a>
                <a href="index.html?quote_id=${quote.id}&print=true" target="_blank" class="btn" title="Exportar PDF">Exportar</a>
                <button class="btn-remove" data-action="delete-quote" data-id="${quote.id}" title="Excluir Orçamento">&times;</button>
            `;

            if (quote.status && quote.status.toLowerCase() === 'ganho') {
                actionsHTML += `<a href="evento.html?quote_id=${quote.id}" class="btn btn-primary">Gerenciar Evento</a>`;
            }

            row.innerHTML = `
                <td>${quote.client_name || 'Rascunho sem nome'}</td>
                <td>${createdAt}</td>
                <td>${selectHTML}</td>
                <td class="actions">${actionsHTML}</td>
            `;
            quotesTbody.appendChild(row);
        });
    }

    function renderEventsTable() {
        if (!eventsTbody) return;
        eventsTbody.innerHTML = '';

        const wonQuotes = quotes.filter(q => q.status && q.status.toLowerCase() === 'ganho');

        wonQuotes.forEach(quote => {
            const row = document.createElement('tr');
            const createdAt = new Date(quote.created_at).toLocaleDateString('pt-BR');
            const statusHTML = `<span class="status-pill won">${quote.status}</span>`;
            const actionsHTML = `<a href="evento.html?quote_id=${quote.id}" class="btn btn-primary">Gerenciar Evento</a>`;

            row.innerHTML = `
                <td>${quote.client_name}</td>
                <td>${createdAt}</td>
                <td>${statusHTML}</td>
                <td class="actions">${actionsHTML}</td>
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
        const previousMonthQuotes = quotes.filter(q => new Date(q.created_at) >= startOfPreviousMonth && new Date(q.created_at) <= endOfPreviousMonth);
        const currentMetrics = aggregateQuoteMetrics(currentMonthQuotes);
        const previousMetrics = aggregateQuoteMetrics(previousMonthQuotes);
        analyticsContainer.innerHTML = `
            ${createKpiCard('Ganhos', currentMetrics.Ganho, previousMetrics.Ganho)}
            ${createKpiCard('Perdidos', currentMetrics.Perdido, previousMetrics.Perdido)}
            ${createKpiCard('Em Análise', currentMetrics['Em analise'], previousMetrics['Em analise'])}
        `;
    }

    function aggregateQuoteMetrics(quoteArray) {
        const initialMetrics = { 'Ganho': { count: 0, value: 0 }, 'Perdido': { count: 0, value: 0 }, 'Em analise': { count: 0, value: 0 }, 'Rascunho': { count: 0, value: 0 } };
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
        const trendClass = percentageChange.startsWith('+') && percentageChange.length > 2 ? 'increase' : percentageChange.startsWith('-') ? 'decrease' : '';
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
        if (previous === 0) return current > 0 ? '+∞%' : '0%';
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
            const details = document.createElement('details');
            details.className = 'category-accordion';
            details.open = true;
            const summary = document.createElement('summary');
            summary.className = 'category-header';
            summary.innerHTML = `<h3 class="category-title">${category}</h3>`;
            const table = document.createElement('table');
            table.className = 'editable-table';
            const colgroup = document.createElement('colgroup');
            const priceColumnCount = priceTables.length;
            const nameWidth = 38, unitWidth = 14, actionsWidth = 8;
            const availableWidthForPrices = 100 - nameWidth - unitWidth - actionsWidth;
            const priceColumnWidth = priceColumnCount > 0 ? availableWidthForPrices / priceColumnCount : 0;
            let colgroupHTML = `<col style="width: ${nameWidth}%;"><col style="width: ${unitWidth}%;">`;
            priceTables.forEach(() => { colgroupHTML += `<col style="width: ${priceColumnWidth}%;">`; });
            colgroupHTML += `<col style="width: ${actionsWidth}%;">`;
            colgroup.innerHTML = colgroupHTML;
            table.appendChild(colgroup);
            const thead = document.createElement('thead');
            const headerRow = document.createElement('tr');
            headerRow.innerHTML = `<th>Nome</th><th>Unidade</th>`;
            priceTables.forEach(pt => headerRow.innerHTML += `<th class="price-column">${pt.name}</th>`);
            headerRow.innerHTML += `<th>Ações</th>`;
            thead.appendChild(headerRow);
            const tbody = document.createElement('tbody');
            servicesByCategory[category].forEach(service => {
                const row = document.createElement('tr');
                row.dataset.serviceId = service.id;
                let priceColumns = '';
                priceTables.forEach(table => {
                    const priceRecord = servicePrices.find(p => p.service_id === service.id && p.price_table_id === table.id);
                    const price = priceRecord ? parseFloat(priceRecord.price).toFixed(2) : '0.00';
                    priceColumns += `<td class="price-column"><input type="number" step="0.01" min="0" class="service-price-input" data-table-id="${table.id}" value="${price}"></td>`;
                });
                row.innerHTML = `<td><input type="text" class="service-detail-input" data-field="name" value="${service.name}"></td><td>${createUnitSelect(service.unit)}</td>${priceColumns}<td class="actions"><button class="btn-remove" data-action="delete-service" data-id="${service.id}" title="Excluir Serviço">&times;</button></td>`;
                tbody.appendChild(row);
            });
            table.appendChild(thead);
            table.appendChild(tbody);
            details.appendChild(summary);
            details.appendChild(table);
            adminCatalogContainer.appendChild(details);
        });
    }
    
    // --- EVENT LISTENERS ---
    function addEventListeners() {
        const tabsNav = document.querySelector('.tabs-nav');
        tabsNav?.addEventListener('click', (e) => {
            const clickedTab = e.target.closest('.tab-btn');
            if (!clickedTab) return;
            const tabId = clickedTab.dataset.tab;
            const targetContent = document.getElementById(`tab-content-${tabId}`);
            tabsNav.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
            clickedTab.classList.add('active');
            if (targetContent) {
                targetContent.classList.add('active');
            }
        });

        document.body.addEventListener('click', e => {
            const header = e.target.closest('.collapsible-card > .card-header');
            if (header) {
                header.closest('.collapsible-card')?.classList.toggle('collapsed');
                return;
            }
            const button = e.target.closest('button[data-action]');
            if (button) {
                const { action, id } = button.dataset;
                if (action === 'delete-service') deleteService(id);
                if (action === 'delete-table') deletePriceTable(id);
                if (action === 'delete-quote') deleteQuote(id);
            }
        });

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

    function handleServiceEdit(inputElement, useDebounce) {
        const row = inputElement.closest('tr');
        if (!row) return;
        const serviceId = row.dataset.serviceId;
        const timerKey = `service-${serviceId}-${inputElement.dataset.field || inputElement.dataset.tableId}`;
        if (debounceTimers[timerKey]) { clearTimeout(debounceTimers[timerKey]); }
        const action = () => {
            if (inputElement.classList.contains('service-detail-input')) {
                updateServiceDetail(serviceId, inputElement.dataset.field, inputElement.value);
            } else if (inputElement.classList.contains('service-price-input')) {
                const price = parseFloat(inputElement.value) || 0;
                if (!useDebounce) { inputElement.value = price.toFixed(2); }
                updateServicePrice(serviceId, inputElement.dataset.tableId, price);
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
            updatePriceTableDetail(tableId, field, value);
        };
        if (useDebounce) { debounceTimers[timerKey] = setTimeout(action, 500); } else { action(); }
    }

    // --- FUNÇÕES DE AÇÃO (CRUD) ---
    async function updateQuoteStatus(id, status) {
        const { error } = await supabase.from('quotes').update({ status: status }).eq('id', id);
        if (error) {
            showNotification(`Erro ao atualizar status: ${error.message}`, true);
        } else {
            showNotification('Status atualizado com sucesso!');
            const quote = quotes.find(q => q.id == id);
            if(quote) quote.status = status;
            if (status.toLowerCase() === 'ganho') {
                await createBookingsForQuote(id);
            }
            renderAnalytics();
            renderQuotesTable();
            renderEventsTable();
        }
    }
    
    async function createBookingsForQuote(quoteId) {
        await supabase.from('bookings').delete().eq('quote_id', quoteId);
        const quote = quotes.find(q => q.id === quoteId);
        if (!quote || !quote.quote_data) return;
        const { items, event_dates } = quote.quote_data;
        if (!items || !event_dates) return;
        const spaceItems = items.filter(item => {
            const service = services.find(s => s.id === item.service_id);
            return service && service.category === 'Espaço';
        });
        const newBookings = [];
        spaceItems.forEach(item => {
            const eventDate = event_dates.find(d => d.date === item.event_date);
            if (eventDate) {
                const service = services.find(s => s.id === item.service_id);
                newBookings.push({
                    quote_id: quoteId,
                    resource_id: item.service_id,
                    start_date: `${eventDate.date}T${eventDate.start}`,
                    end_date: `${eventDate.date}T${eventDate.end}`,
                    title: `${quote.client_name} (${service.name})`
                });
            }
        });
        if (newBookings.length > 0) {
            const { error } = await supabase.from('bookings').insert(newBookings);
            if (error) {
                showNotification('Erro ao criar reserva no calendário.', true);
                console.error(error);
            }
        }
    }
    
    async function updatePriceTableDetail(tableId, field, value) {
        const { error } = await supabase.from('price_tables').update({ [field]: value }).eq('id', tableId);
        if (error) {
            showNotification(`Erro ao atualizar ${field}: ${error.message}`, true);
            fetchData();
        } else {
            const table = priceTables.find(t => t.id == tableId);
            const oldName = table ? table.name : null;
            if (table) { table[field] = value; }
            if (field === 'name' && oldName !== value) { renderAdminCatalog(); }
        }
    }

    async function updateServiceDetail(serviceId, field, value) {
        const { error } = await supabase.from('services').update({ [field]: value }).eq('id', serviceId);
        if (error) {
            showNotification(`Erro ao atualizar ${field}: ${error.message}`, true);
            fetchData();
        } else {
            const service = services.find(s => s.id == serviceId);
            if (service) { service[field] = value; }
        }
    }

    async function updateServicePrice(serviceId, tableId, price) {
        const recordToUpsert = { service_id: serviceId, price_table_id: tableId, price: price };
        const { data, error } = await supabase.from('service_prices').upsert(recordToUpsert, { onConflict: 'service_id, price_table_id' }).select().single();
        if (error) {
            showNotification(`Erro ao atualizar preço: ${error.message}`, true);
        } else {
            const existingIndex = servicePrices.findIndex(p => p.service_id == serviceId && p.price_table_id == tableId);
            if (existingIndex > -1) { servicePrices[existingIndex] = data; } else { servicePrices.push(data); }
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

    // --- FUNÇÕES UTILITÁRIAS ---
    function showNotification(message, isError = false) {
        if (!notification) return;
        notification.textContent = message;
        notification.style.backgroundColor = isError ? 'var(--danger-color)' : 'var(--success-color)';
        notification.classList.add('show');
        setTimeout(() => notification.classList.remove('show'), 5000);
    }

    initialize();
});
