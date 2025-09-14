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
    const servicesTable = document.getElementById('services-table');
    const servicesTbody = servicesTable?.querySelector('tbody');
    const servicesThead = servicesTable?.querySelector('thead');
    
    const priceTablesList = document.getElementById('price-tables-list');
    const priceTablesTbody = priceTablesList?.querySelector('tbody');

    const quotesTbody = document.getElementById('quotes-table')?.querySelector('tbody');
    const addServiceForm = document.getElementById('addServiceForm');
    const addPriceTableForm = document.getElementById('addPriceTableForm');
    const notification = document.getElementById('save-notification');

    // Variável para o Debounce
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
        if (servicesTbody && servicesThead) renderServicesTable();
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

    function renderServicesTable() {
        servicesTbody.innerHTML = '';
        servicesThead.innerHTML = '';

        const headerRow = document.createElement('tr');
        headerRow.innerHTML = `
            <th style="min-width: 250px;">Nome</th>
            <th style="min-width: 150px;">Categoria</th>
            <th style="min-width: 120px;">Unidade</th>
        `;
        priceTables.forEach(table => {
            const th = document.createElement('th');
            th.textContent = table.name;
            th.classList.add('price-column');
            th.style.minWidth = '120px';
            headerRow.appendChild(th);
        });
        headerRow.innerHTML += `<th>Ações</th>`;
        servicesThead.appendChild(headerRow);

        let currentCategory = null;
        const colspan = headerRow.children.length;

        services.forEach(service => {
            if (service.category !== currentCategory) {
                currentCategory = service.category;
                const categoryRow = document.createElement('tr');
                categoryRow.className = 'category-header';
                categoryRow.innerHTML = `<th colspan="${colspan}">${currentCategory}</th>`;
                servicesTbody.appendChild(categoryRow);
            }

            const row = document.createElement('tr');
            row.dataset.serviceId = service.id;

            row.innerHTML = `
                <td><input type="text" class="service-detail-input" data-field="name" value="${service.name}"></td>
                <td>${createCategorySelect(service.category)}</td>
                <td>${createUnitSelect(service.unit)}</td>
            `;

            priceTables.forEach(table => {
                const priceRecord = servicePrices.find(p => p.service_id === service.id && p.price_table_id === table.id);
                const price = priceRecord ? parseFloat(priceRecord.price).toFixed(2) : '0.00';
                const td = document.createElement('td');
                td.classList.add('price-column');
                td.innerHTML = `<input type="number" step="0.01" min="0" class="service-price-input" data-table-id="${table.id}" value="${price}">`;
                row.appendChild(td);
            });

            const actionsTd = document.createElement('td');
            actionsTd.className = 'actions';
            actionsTd.innerHTML = `<button class="btn-remove" data-action="delete-service" data-id="${service.id}" title="Excluir Serviço">&times;</button>`;
            row.appendChild(actionsTd);

            servicesTbody.appendChild(row);
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
                <td class="price-column">
                    <input type="number" step="0.01" min="0" class="price-table-input" data-field="consumable_credit" value="${consumable}">
                </td>
                <td class="actions">
                    <button class="btn-remove" data-action="delete-table" data-id="${table.id}" title="Excluir Lista">&times;</button>
                </td>
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

    // NOVO: Função para controlar as abas
    function setupTabEvents() {
        const tabsNav = document.querySelector('.tabs-nav');
        if (!tabsNav) return;

        tabsNav.addEventListener('click', (e) => {
            const clickedTab = e.target.closest('.tab-btn');
            if (!clickedTab) return;

            const tabId = clickedTab.dataset.tab;
            const targetContent = document.getElementById(`tab-content-${tabId}`);

            // Remove a classe 'active' de todos
            tabsNav.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

            // Adiciona a classe 'active' ao alvo
            clickedTab.classList.add('active');
            if (targetContent) {
                targetContent.classList.add('active');
            }
        });
    }

    function addEventListeners() {
        setupTabEvents(); // NOVO: Adiciona os listeners das abas

        // Formulários de adição
        addServiceForm?.addEventListener('submit', async (e) => {
             e.preventDefault();
            const newService = {
                name: document.getElementById('serviceName').value,
                category: document.getElementById('serviceCategory').value,
                unit: document.getElementById('serviceUnit').value,
            };
            const { error } = await supabase.from('services').insert([newService]);
            if(error) { showNotification(`Erro: ${error.message}`, true); } 
            else { showNotification('Serviço adicionado!'); e.target.reset(); fetchData(); }
        });
        
        addPriceTableForm?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const newTable = { 
                name: document.getElementById('tableName').value,
                consumable_credit: parseFloat(document.getElementById('tableConsumable').value) || 0
            };
            const { error } = await supabase.from('price_tables').insert([newTable]);
            if(error) { showNotification(`Erro: ${error.message}`, true); } 
            else { showNotification('Lista de preços adicionada!'); e.target.reset(); fetchData(); }
        });

        // Listener para cliques (Ações de exclusão)
        document.body.addEventListener('click', e => {
            const button = e.target.closest('button');
            if (!button) return;

            const { action, id } = button.dataset;
            if (action === 'delete-service') deleteService(id);
            if (action === 'delete-table') deletePriceTable(id);
            if (action === 'delete-quote') deleteQuote(id);
        });

        // Listeners para edições inline na tabela de SERVIÇOS
        if (servicesTable) {
            servicesTable.addEventListener('input', (e) => {
                if (e.target.matches('.service-detail-input[type="text"]')) {
                    handleServiceEdit(e.target, true);
                }
            });

            servicesTable.addEventListener('change', (e) => {
                if (e.target.matches('.service-detail-input:not([type="text"])') || e.target.matches('.service-price-input')) {
                    handleServiceEdit(e.target, false);
                }
            });
        }

        // Listeners para edições inline na tabela de LISTAS DE PREÇO
        if (priceTablesList) {
            priceTablesList.addEventListener('input', (e) => {
                if (e.target.matches('.price-table-input[data-field="name"]')) {
                    handlePriceTableEdit(e.target, true);
                }
            });

            priceTablesList.addEventListener('change', (e) => {
                if (e.target.matches('.price-table-input[data-field="consumable_credit"]')) {
                    handlePriceTableEdit(e.target, false);
                }
            });
        }
    }

    function handleServiceEdit(inputElement, useDebounce) {
        const row = inputElement.closest('tr');
        if (!row) return;
        const serviceId = row.dataset.serviceId;
        
        const timerKey = `service-${serviceId}-${inputElement.dataset.field || inputElement.dataset.tableId}`;

        if (debounceTimers[timerKey]) {
            clearTimeout(debounceTimers[timerKey]);
        }

        const action = () => {
            if (inputElement.classList.contains('service-detail-input')) {
                const field = inputElement.dataset.field;
                const value = inputElement.value;
                updateServiceDetail(serviceId, field, value, inputElement);
            } else if (inputElement.classList.contains('service-price-input')) {
                const tableId = inputElement.dataset.tableId;
                const price = parseFloat(inputElement.value) || 0;
                if (!useDebounce) {
                    inputElement.value = price.toFixed(2);
                }
                updateServicePrice(serviceId, tableId, price, inputElement);
            }
        };

        if (useDebounce) {
            debounceTimers[timerKey] = setTimeout(action, 500);
        } else {
            action();
        }
    }

    function handlePriceTableEdit(inputElement, useDebounce) {
        const row = inputElement.closest('tr');
        if (!row) return;
        const tableId = row.dataset.tableId;
        const field = inputElement.dataset.field;
        
        const timerKey = `table-${tableId}-${field}`;

        if (debounceTimers[timerKey]) {
            clearTimeout(debounceTimers[timerKey]);
        }

        const action = () => {
            let value = inputElement.value;

            if (field === 'consumable_credit') {
                value = parseFloat(value) || 0;
                if (!useDebounce) {
                    inputElement.value = value.toFixed(2);
                }
            }
            
            updatePriceTableDetail(tableId, field, value, inputElement);
        };

        if (useDebounce) {
            debounceTimers[timerKey] = setTimeout(action, 500);
        } else {
            action();
        }
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
        if (table) {
            table[field] = value;
        }

        const { error } = await supabase
            .from('price_tables')
            .update({ [field]: value })
            .eq('id', tableId);

        if (error) {
            console.error(`Error updating price table detail ${field}:`, error.message);
            showNotification(`Erro ao atualizar ${field}: ${error.message}`, true);
            fetchData(); 
        } else {
            showFlash(inputElement);
            if (field === 'name' && oldName !== value) {
                renderServicesTable();
            }
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
        if (service) {
            service[field] = value;
        }

        const { error } = await supabase
            .from('services')
            .update({ [field]: value })
            .eq('id', serviceId);

        if (error) {
            console.error(`Error updating service detail ${field}:`, error.message);
            showNotification(`Erro ao atualizar ${field}: ${error.message}`, true);
            fetchData(); 
        } else {
            showFlash(inputElement);
        }
    }

    async function updateServicePrice(serviceId, tableId, price, inputElement) {
        if (!serviceId || !tableId) return;

        const recordToUpsert = {
            service_id: serviceId,
            price_table_id: tableId,
            price: price
        };

        const { data, error } = await supabase
            .from('service_prices')
            .upsert(recordToUpsert)
            .select()
            .single();

        if (error) {
            console.error("Error updating service price:", error.message);
            showNotification(`Erro ao atualizar preço: ${error.message}`, true);
            const priceRecord = servicePrices.find(p => p.service_id === serviceId && p.price_table_id === tableId);
            inputElement.value = priceRecord ? parseFloat(priceRecord.price).toFixed(2) : '0.00';
        } else {
            const existingIndex = servicePrices.findIndex(p => p.service_id === serviceId && p.price_table_id === tableId);
            if (existingIndex > -1) {
                servicePrices[existingIndex] = data;
            } else {
                servicePrices.push(data);
            }

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
