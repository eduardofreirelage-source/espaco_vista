import { supabase, getSession } from './supabase-client.js';

document.addEventListener('DOMContentLoaded', async () => {
    // =================================================================
    // VERIFICAÇÃO DE ACESSO (Permanece igual)
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

    // Variável para o Debounce (Otimização)
    let debounceTimers = {};

    // --- INICIALIZAÇÃO (Permanece igual) ---
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
        // Renderiza as listas primeiro, depois o catálogo que depende dos nomes das listas.
        if (priceTablesTbody) renderPriceTablesList();
        if (servicesTbody && servicesThead) renderServicesTable();
        if (quotesTbody) renderQuotesTable();
    }

    // Funções auxiliares (Permanece igual)
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


    // Renderiza a tabela como uma matriz editável (Permanece igual)
    function renderServicesTable() {
        servicesTbody.innerHTML = '';
        servicesThead.innerHTML = '';

        // 1. Construir o Cabeçalho
        const headerRow = document.createElement('tr');
        headerRow.innerHTML = `
            <th style="min-width: 250px;">Nome</th>
            <th style="min-width: 150px;">Categoria</th>
            <th style="min-width: 120px;">Unidade</th>
        `;
        // Adicionar colunas para cada tabela de preço
        priceTables.forEach(table => {
            const th = document.createElement('th');
            th.textContent = table.name;
            th.classList.add('price-column');
            th.style.minWidth = '120px';
            headerRow.appendChild(th);
        });
        headerRow.innerHTML += `<th>Ações</th>`;
        servicesThead.appendChild(headerRow);

        // 2. Construir o Corpo
        services.forEach(service => {
            const row = document.createElement('tr');
            row.dataset.serviceId = service.id;

            // Colunas para detalhes do serviço (editáveis)
            row.innerHTML = `
                <td><input type="text" class="service-detail-input" data-field="name" value="${service.name}"></td>
                <td>${createCategorySelect(service.category)}</td>
                <td>${createUnitSelect(service.unit)}</td>
            `;

            // Colunas para preços (editáveis)
            priceTables.forEach(table => {
                const priceRecord = servicePrices.find(p => p.service_id === service.id && p.price_table_id === table.id);
                const price = priceRecord ? parseFloat(priceRecord.price).toFixed(2) : '0.00';
                const td = document.createElement('td');
                td.classList.add('price-column');
                td.innerHTML = `<input type="number" step="0.01" min="0" class="service-price-input" data-table-id="${table.id}" value="${price}">`;
                row.appendChild(td);
            });

            // Coluna de Ações
            const actionsTd = document.createElement('td');
            actionsTd.className = 'actions';
            actionsTd.innerHTML = `
                <button class="btn-remove" data-action="delete-service" data-id="${service.id}" title="Excluir Serviço">&times;</button>
            `;
            row.appendChild(actionsTd);

            servicesTbody.appendChild(row);
        });
    }
    
    // (MODIFICADO) Renderiza a lista de preços com inputs editáveis
    function renderPriceTablesList() {
        priceTablesTbody.innerHTML = '';
        priceTables.forEach(table => {
            const row = document.createElement('tr');
            // Adicionado data-table-id na linha
            row.dataset.tableId = table.id;

            const consumable = parseFloat(table.consumable_credit || 0).toFixed(2);
            
            // Transformado em inputs editáveis com classe específica e data-field
            // Adicionado price-column ao TD para alinhamento correto do input numérico (definido no CSS)
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

    // (MODIFICADO) Atualiza as ações (Editar, Exportar, Excluir)
    function renderQuotesTable() {
        quotesTbody.innerHTML = '';
        quotes.forEach(quote => {
            const row = document.createElement('tr');
            const createdAt = new Date(quote.created_at).toLocaleDateString('pt-BR');

            // Usamos links (<a>) para Editar e Exportar. Exportar abre em nova aba com parâmetro print=true.
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

    function addEventListeners() {
        // Formulários de adição (permanecem iguais)
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
            // Quando uma nova lista é adicionada, precisamos recarregar para mostrar a nova coluna.
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

        // (NOVO) Listeners para edições inline na tabela de LISTAS DE PREÇO
        if (priceTablesList) {
            // 'input' para o nome (com debounce)
            priceTablesList.addEventListener('input', (e) => {
                if (e.target.matches('.price-table-input[data-field="name"]')) {
                    handlePriceTableEdit(e.target, true);
                }
            });

            // 'change' para a consumação (imediato)
            priceTablesList.addEventListener('change', (e) => {
                if (e.target.matches('.price-table-input[data-field="consumable_credit"]')) {
                    handlePriceTableEdit(e.target, false);
                }
            });
        }
    }

    // (Renomeado de handleInlineEdit para handleServiceEdit)
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

    // (NOVO) Função para lidar com a edição inline das Listas de Preço
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
                // Formatação imediata para campos numéricos no evento 'change'
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

    // (NOVO) Função para atualizar detalhes da Lista de Preço (Nome, Consumação)
    async function updatePriceTableDetail(tableId, field, value, inputElement) {
        if (!tableId || !field) return;

        // Validação básica para nome
        if (field === 'name' && !value.trim()) {
            showNotification('O nome da lista não pode ficar vazio.', true);
            const table = priceTables.find(t => t.id === tableId);
            if (table) inputElement.value = table[field];
            return;
        }

        // Atualização otimista (estado local)
        const table = priceTables.find(t => t.id === tableId);
        // Guardar o nome antigo para verificar se precisamos re-renderizar o catálogo
        const oldName = table ? table.name : null;
        if (table) {
            table[field] = value;
        }

        // Atualizar Supabase
        const { error } = await supabase
            .from('price_tables')
            .update({ [field]: value })
            .eq('id', tableId);

        if (error) {
            console.error(`Error updating price table detail ${field}:`, error.message);
            showNotification(`Erro ao atualizar ${field}: ${error.message}`, true);
            // Se der erro, re-busca os dados para garantir consistência
            fetchData(); 
        } else {
            // Indicar sucesso no input brevemente (CSS Flash)
            showFlash(inputElement);

            // IMPORTANTE: Se o nome mudou, precisamos re-renderizar a tabela de serviços
            // pois os cabeçalhos das colunas usam esse nome.
            if (field === 'name' && oldName !== value) {
                renderServicesTable();
            }
        }
    }


    // (Permanece igual, mas usa showFlash)
    async function updateServiceDetail(serviceId, field, value, inputElement) {
        if (!serviceId || !field) return;

        // Validação básica para nome
        if (field === 'name' && !value.trim()) {
            showNotification('O nome do serviço não pode ficar vazio.', true);
            // Reverte o input para o valor anterior usando o estado local
            const service = services.find(s => s.id === serviceId);
            if (service) inputElement.value = service[field];
            return;
        }

        // Atualização otimista (estado local)
        const service = services.find(s => s.id === serviceId);
        if (service) {
            service[field] = value;
        }

        // Atualizar Supabase
        const { error } = await supabase
            .from('services')
            .update({ [field]: value })
            .eq('id', serviceId);

        if (error) {
            console.error(`Error updating service detail ${field}:`, error.message);
            showNotification(`Erro ao atualizar ${field}: ${error.message}`, true);
            // Se der erro, re-busca os dados para reverter a atualização otimista
            fetchData(); 
        } else {
            showFlash(inputElement);
        }
    }

    // (Permanece igual, mas usa showFlash)
    async function updateServicePrice(serviceId, tableId, price, inputElement) {
        if (!serviceId || !tableId) return;

        const recordToUpsert = {
            service_id: serviceId,
            price_table_id: tableId,
            price: price
        };

        // Atualizar Supabase (Upsert lida com inserção e atualização)
        const { data, error } = await supabase
            .from('service_prices')
            .upsert(recordToUpsert)
            .select()
            .single();

        if (error) {
            console.error("Error updating service price:", error.message);
            showNotification(`Erro ao atualizar preço: ${error.message}`, true);
            // Reverte o input em caso de erro (buscando do estado local anterior)
            const priceRecord = servicePrices.find(p => p.service_id === serviceId && p.price_table_id === tableId);
            inputElement.value = priceRecord ? parseFloat(priceRecord.price).toFixed(2) : '0.00';
        } else {
            // Atualizar estado local (servicePrices) com os dados retornados do banco
            const existingIndex = servicePrices.findIndex(p => p.service_id === serviceId && p.price_table_id === tableId);
            if (existingIndex > -1) {
                // Atualizar registro existente no cache local
                servicePrices[existingIndex] = data;
            } else {
                // Adicionar novo registro ao cache local
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

    // (NOVO) Função auxiliar para feedback visual
    function showFlash(inputElement) {
        inputElement.classList.add('success-flash');
        setTimeout(() => inputElement.classList.remove('success-flash'), 1500);
    }

    // --- FUNÇÃO DE NOTIFICAÇÃO (Permanece igual) ---
    function showNotification(message, isError = false) {
        if (!notification) return;
        notification.textContent = message;
        notification.style.backgroundColor = isError ? 'var(--danger-color, #dc3545)' : 'var(--success-color, #28a745)';
        notification.classList.add('show');
        setTimeout(() => notification.classList.remove('show'), 5000);
    }

    initialize();
});
