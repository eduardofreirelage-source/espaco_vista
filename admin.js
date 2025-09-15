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
    // LÓGICA DO PAINEL ADMINISTRATIVO
    // =================================================================

    // ESTADO
    let services = [];
    let priceTables = [];
    let servicePrices = [];
    let quotes = [];

    // ELEMENTOS DO DOM
    const adminCatalogContainer = document.getElementById('admin-catalog-container');
    const priceTablesList = document.getElementById('price-tables-list');
    const priceTablesTbody = priceTablesList?.querySelector('tbody');

    const quotesTbody = document.getElementById('quotes-table')?.querySelector('tbody');
    const addServiceForm = document.getElementById('addServiceForm');
    const addPriceTableForm = document.getElementById('addPriceTableForm');
    const notification = document.getElementById('save-notification');

    let debounceTimers = {};

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
                supabase.from('quotes').select('id, client_name, created_at, status, total_value').order('created_at', { ascending: false })
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
            console.error("Erro ao carregar dados:", error.message);
            showNotification("Erro ao carregar dados. Verifique a conexão e as permissões.", true);
        }
    }

    // --- RENDERIZAÇÃO ---
    function renderAll() {
        if (priceTablesTbody) renderPriceTablesList();
        if (adminCatalogContainer) renderAdminCatalog();
        if (quotesTbody) renderQuotesTable();
    }

    function createCategorySelect(currentCategory) {
        const categories = ['Espaço', 'Gastronomia', 'Equipamentos', 'Serviços / Outros'];
        return `<select class="service-detail-input" data-field="category">
            ${categories.map(cat => `<option value="${cat}" ${cat === currentCategory ? 'selected' : ''}>${cat}</option>`).join('')}
        </select>`;
    }

    function createUnitSelect(currentUnit) {
        const units = ['unidade', 'diaria', 'por_pessoa'];
        return `<select class="service-detail-input" data-field="unit">
            ${units.map(unit => `<option value="${unit}" ${unit === currentUnit ? 'selected' : ''}>${unit}</option>`).join('')}
        </select>`;
    }

    // MODIFICADO: Adiciona <colgroup> para definir a largura das colunas
    function renderAdminCatalog() {
        adminCatalogContainer.innerHTML = '';

        const servicesByCategory = services.reduce((acc, service) => {
            if (!acc[service.category]) {
                acc[service.category] = [];
            }
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
            
            // NOVO: Define as larguras das colunas para manter a consistência
            const colgroup = document.createElement('colgroup');
            const priceColumnCount = priceTables.length;
            const nameWidth = 38;
            const unitWidth = 14;
            const actionsWidth = 8;
            const availableWidthForPrices = 100 - nameWidth - unitWidth - actionsWidth;
            const priceColumnWidth = priceColumnCount > 0 ? availableWidthForPrices / priceColumnCount : 0;

            let colgroupHTML = `
                <col style="width: ${nameWidth}%;">
                <col style="width: ${unitWidth}%;">
            `;
            priceTables.forEach(() => {
                colgroupHTML += `<col style="width: ${priceColumnWidth}%;">`;
            });
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

                row.innerHTML = `
                    <td><input type="text" class="service-detail-input" data-field="name" value="${service.name}"></td>
                    <td>${createUnitSelect(service.unit)}</td>
                    ${priceColumns}
                    <td class="actions"><button class="btn-remove" data-action="delete-service" data-id="${service.id}" title="Excluir Serviço">&times;</button></td>
                `;
                tbody.appendChild(row);
            });
            
            table.appendChild(thead);
            table.appendChild(tbody);
            details.appendChild(summary);
            details.appendChild(table);
            adminCatalogContainer.appendChild(details);
        });
    }
    
    function renderPriceTablesList() {
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

    function renderQuotesTable() {
        quotesTbody.innerHTML = '';
        quotes.forEach(quote => {
            const row = document.createElement('tr');
            const createdAt = new Date(quote.created_at).toLocaleDateString('pt-BR');
            row.innerHTML = `
                <td>${quote.client_name || 'Rascunho sem nome'}</td>
                <td>${createdAt}</td>
                <td><span class="status">${quote.status}</span></td>
                <td class="actions">
                    <a href="index.html?quote_id=${quote.id}" class="btn" title="Editar Orçamento">Editar</a>
                    <a href="index.html?quote_id=${quote.id}&print=true" target="_blank" class="btn" style="background-color: #6c757d;" title="Exportar PDF">Exportar</a>
                    <button class="btn-remove" data-action="delete-quote" data-id="${quote.id}" title="Excluir Orçamento">&times;</button>
                </td>
            `;
            quotesTbody.appendChild(row);
        });
    }

    // --- LÓGICA DE EVENT LISTENERS ---
    function setupTabEvents() {
        const tabsNav = document.querySelector('.tabs-nav');
        if (!tabsNav) return;
        tabsNav.addEventListener('click', (e) => {
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
    }

    function setupCollapsibleEvents() {
        const collapsibleHeaders = document.querySelectorAll('.collapsible-card .card-header');
        collapsibleHeaders.forEach(header => {
            header.addEventListener('click', () => {
                const card = header.closest('.collapsible-card');
                if (card) {
                    card.classList.toggle('collapsed');
                }
            });
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
        
        if (adminCatalogContainer) {
            adminCatalogContainer.addEventListener('input', (e) => {
                if (e.target.matches('.service-detail-input[type="text"]')) { handleServiceEdit(e.target, true); }
            });
            adminCatalogContainer.addEventListener('change', (e) => {
                if (e.target.matches('.service-detail-input:not([type="text"])') || e.target.matches('.service-price-input')) { handleServiceEdit(e.target, false); }
            });
        }

        if (priceTablesList) {
            priceTablesList.addEventListener('input', (e) => {
                if (e.target.matches('.price-table-input[data-field="name"]')) { handlePriceTableEdit(e.target, true); }
            });
            priceTablesList.addEventListener('change', (e) => {
                if (e.target.matches('.price-table-input[data-field="consumable_credit"]')) { handlePriceTableEdit(e.target, false); }
            });
        }
    }

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

    // --- FUNÇÕES DE AÇÃO (CRUD) ---
    async function updatePriceTableDetail(tableId, field, value, inputElement) {
        if (!tableId || !field) return;
        if (field === 'name' && !value.trim()) {
            showNotification('O nome da lista não pode ficar vazio.', true);
            const table = priceTables.find(t => t.id === tableId);
            if (table) inputElement.value = table[field];
            return;
        }
        const table = priceTables.find(t => t.id === tableId);
        const oldName = table ? table.name : null;
        if (table) { table[field] = value; }
        const { error } = await supabase.from('price_tables').update({ [field]: value }).eq('id', tableId);
        if (error) {
            showNotification(`Erro ao atualizar ${field}: ${error.message}`, true);
            fetchData(); 
        } else {
            showFlash(inputElement);
            if (field === 'name' && oldName !== value) { renderAdminCatalog(); }
        }
    }

    async function updateServiceDetail(serviceId, field, value, inputElement) {
        if (!serviceId || !field) return;
        if (field === 'name' && !value.trim()) {
            showNotification('O nome do serviço não pode ficar vazio.', true);
            const service = services.find(s => s.id === serviceId);
            if (service) inputElement.value = service[field];
            return;
        }
        const service = services.find(s => s.id === serviceId);
        if (service) { service[field] = value; }
        const { error } = await supabase.from('services').update({ [field]: value }).eq('id', serviceId);
        if (error) {
            showNotification(`Erro ao atualizar ${field}: ${error.message}`, true);
            fetchData(); 
        } else {
            showFlash(inputElement);
        }
    }

    async function updateServicePrice(serviceId, tableId, price, inputElement) {
        if (!serviceId || !tableId) return;
        const recordToUpsert = { service_id: serviceId, price_table_id: tableId, price: price };
        const { data, error } = await supabase.from('service_prices').upsert(recordToUpsert).select().single();
        if (error) {
            showNotification(`Erro ao atualizar preço: ${error.message}`, true);
            const priceRecord = servicePrices.find(p => p.service_id === serviceId && p.price_table_id === tableId);
            inputElement.value = priceRecord ? parseFloat(priceRecord.price).toFixed(2) : '0.00';
        } else {
            const existingIndex = servicePrices.findIndex(p => p.service_id === serviceId && p.price_table_id === tableId);
            if (existingIndex > -1) { servicePrices[existingIndex] = data; } else { servicePrices.push(data); }
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

    // --- FUNÇÕES UTILITÁRIAS ---
    function showFlash(inputElement) {
        inputElement.classList.add('success-flash');
        setTimeout(() => inputElement.classList.remove('success-flash'), 1500);
    }

    function showNotification(message, isError = false) {
        if (!notification) return;
        notification.textContent = message;
        notification.style.backgroundColor = isError ? 'var(--danger-color, #dc3545)' : 'var(--success-color, #28a745)';
        notification.classList.add('show');
        setTimeout(() => notification.classList.remove('show'), 5000);
    }

    initialize();
});
