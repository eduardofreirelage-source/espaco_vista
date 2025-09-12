import { supabase, getSession } from './supabase-client.js';

document.addEventListener('DOMContentLoaded', async () => {
    // =================================================================
    // VERIFICAÇÃO DE ACESSO
    // =================================================================
    const { role } = await getSession();
    if (role !== 'admin') {
        // Se não for admin, redireciona para a página de login.
        console.warn("Acesso negado ao painel administrativo. Redirecionando para login.");
        window.location.href = 'login.html';
        return; // Interrompe a execução do restante do script admin
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
    const priceTablesTbody = document.getElementById('price-tables-list')?.querySelector('tbody');
    const quotesTbody = document.getElementById('quotes-table')?.querySelector('tbody');
    const addServiceForm = document.getElementById('addServiceForm');
    const addPriceTableForm = document.getElementById('addPriceTableForm');
    // Referências ao modal foram removidas.
    const notification = document.getElementById('save-notification');

    // Variável para o Debounce (Otimização)
    let debounceTimers = {};

    // --- INICIALIZAÇÃO ---
    async function initialize() {
        await fetchData();
        addEventListeners();
    }

    async function fetchData() {
        try {
            const [servicesRes, tablesRes, pricesRes, quotesRes] = await Promise.all([
                // Ordena por categoria e nome para melhor organização na nova tabela
                supabase.from('services').select('*').order('category').order('name'),
                supabase.from('price_tables').select('*').order('name'),
                supabase.from('service_prices').select('*'),
                // Busca os dados essenciais dos orçamentos para a listagem
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
        if (servicesTbody && servicesThead) renderServicesTable();
        if (priceTablesTbody) renderPriceTablesList();
        if (quotesTbody) renderQuotesTable();
    }

    // (NOVO) Funções auxiliares para criar selects editáveis
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


    // (REFORMULADO) Renderiza a tabela como uma matriz editável
    function renderServicesTable() {
        servicesTbody.innerHTML = '';
        servicesThead.innerHTML = '';

        // 1. Construir o Cabeçalho
        const headerRow = document.createElement('tr');
        // Definindo larguras mínimas para garantir usabilidade na rolagem horizontal
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
                // Classes específicas e data-table-id para identificar a edição
                td.innerHTML = `<input type="number" step="0.01" min="0" class="service-price-input" data-table-id="${table.id}" value="${price}">`;
                row.appendChild(td);
            });

            // Coluna de Ações
            const actionsTd = document.createElement('td');
            actionsTd.className = 'actions';
            // O botão "Editar Preços" foi removido.
            actionsTd.innerHTML = `
                <button class="btn-remove" data-action="delete-service" data-id="${service.id}" title="Excluir Serviço">&times;</button>
            `;
            row.appendChild(actionsTd);

            servicesTbody.appendChild(row);
        });
    }
    
    // Permanece igual
    function renderPriceTablesList() {
        priceTablesTbody.innerHTML = '';
        priceTables.forEach(table => {
            const row = document.createElement('tr');
            const consumable = table.consumable_credit || 0;
            const formattedConsumable = parseFloat(consumable).toFixed(2).replace('.', ',');
            row.innerHTML = `
                <td>${table.name}</td>
                <td>R$ ${formattedConsumable}</td>
                <td class="actions">
                    <button class="btn-remove" data-action="delete-table" data-id="${table.id}" title="Excluir Lista">&times;</button>
                </td>
            `;
            priceTablesTbody.appendChild(row);
        });
    }

    // Permanece igual
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
                    <a href="index.html?quote_id=${quote.id}" class="btn">Carregar</a>
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
            // Ação 'edit-prices' foi removida
            if (action === 'delete-service') deleteService(id);
            if (action === 'delete-table') deletePriceTable(id);
            if (action === 'delete-quote') deleteQuote(id);
        });

        // (NOVO) Listener para edições inline na tabela de serviços
        // Usamos 'input' para campos de texto (com debounce) e 'change' para selects/números.
        
        // 'input' event listener for text fields (debounced)
        servicesTable.addEventListener('input', (e) => {
            if (e.target.matches('.service-detail-input[type="text"]')) {
                handleInlineEdit(e.target, true); // true para aplicar debounce
            }
        });

        // 'change' event listener for selects and number inputs (immediate)
        servicesTable.addEventListener('change', (e) => {
            if (e.target.matches('.service-detail-input:not([type="text"])') || e.target.matches('.service-price-input')) {
                handleInlineEdit(e.target, false); // false para salvar imediatamente
            }
        });
    }

    // (NOVO) Função unificada para lidar com a edição inline
    function handleInlineEdit(inputElement, useDebounce) {
        const row = inputElement.closest('tr');
        if (!row) return;
        const serviceId = row.dataset.serviceId;
        
        // Cria uma chave única para o timer baseado no ID do serviço e no campo/tabela
        const timerKey = `${serviceId}-${inputElement.dataset.field || inputElement.dataset.tableId}`;

        // Limpa o timer anterior se existir (para o debounce)
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
                // Garantir que o input reflita o valor formatado (ex: 5 -> 5.00)
                // Apenas se for imediato (change event), pois o input event pode interferir na digitação
                if (!useDebounce) {
                    inputElement.value = price.toFixed(2);
                }
                updateServicePrice(serviceId, tableId, price, inputElement);
            }
        };

        if (useDebounce) {
            // Define um novo timer (500ms)
            debounceTimers[timerKey] = setTimeout(action, 500);
        } else {
            action();
        }
    }


    // --- FUNÇÕES DE AÇÃO (CRUD) ---

    // (NOVO) Função para atualizar detalhes do serviço (Nome, Categoria, Unidade)
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
            // Indicar sucesso no input brevemente (CSS Flash)
            inputElement.classList.add('success-flash');
            setTimeout(() => inputElement.classList.remove('success-flash'), 1500);
        }
    }

    // (NOVO) Função para atualizar preços dos serviços
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

            // Indicar sucesso no input brevemente (CSS Flash)
            inputElement.classList.add('success-flash');
            setTimeout(() => inputElement.classList.remove('success-flash'), 1500);
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

    // --- FUNÇÃO DE NOTIFICAÇÃO ---
    function showNotification(message, isError = false) {
        if (!notification) return;
        notification.textContent = message;
        // Usa as variáveis CSS definidas no admin.css
        notification.style.backgroundColor = isError ? 'var(--danger-color, #dc3545)' : 'var(--success-color, #28a745)';
        notification.classList.add('show');
        setTimeout(() => notification.classList.remove('show'), 5000);
    }

    initialize();
});
