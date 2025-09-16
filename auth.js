import { supabase, getSession } from './supabase-client.js';

document.addEventListener('DOMContentLoaded', async () => {
    if (!document.querySelector('.tabs-nav')) return;

    const { role } = await getSession();
    if (role !== 'admin') {
        window.location.href = 'login.html';
        return;
    }

    // ESTADO GLOBAL
    let services = [], priceTables = [], quotes = [], paymentMethods = [], cardapioItems = [], cardapioComposition = [];
    let selectedCardapioId = null;

    // SELETORES DO DOM
    const notification = document.getElementById('save-notification');
    const adminCatalogContainer = document.getElementById('admin-catalog-container');
    const cardapioItemsTbody = document.getElementById('cardapio-items-table')?.querySelector('tbody');
    const selectCardapioToEdit = document.getElementById('select-cardapio-to-edit');
    const compositionSection = document.getElementById('composition-section');
    const editingCardapioName = document.getElementById('editing-cardapio-name');
    const compositionTbody = document.getElementById('composition-table')?.querySelector('tbody');
    const selectItemToAdd = document.getElementById('select-item-to-add');

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
            supabase.from('quotes').select('*, clients(*)').order('created_at', { ascending: false }),
            supabase.from('payment_methods').select('*').order('name'),
            supabase.from('cardapio_items').select('*').order('name'),
            supabase.from('cardapio_composition').select('*, item:item_id(id, name)')
        ]);

        const [servicesRes, tablesRes, quotesRes, paymentsRes, itemsRes, compositionRes] = results;

        services = (servicesRes.status === 'fulfilled') ? servicesRes.value.data : [];
        priceTables = (tablesRes.status === 'fulfilled') ? tablesRes.value.data : [];
        quotes = (quotesRes.status === 'fulfilled') ? quotesRes.value.data : [];
        paymentMethods = (paymentsRes.status === 'fulfilled') ? paymentsRes.value.data : [];
        cardapioItems = (itemsRes.status === 'fulfilled') ? itemsRes.value.data : [];
        cardapioComposition = (compositionRes.status === 'fulfilled') ? compositionRes.value.data : [];

        if (itemsRes.status === 'rejected') console.warn("Aviso: Tabela 'cardapio_items' não encontrada.", itemsRes.reason);
        if (compositionRes.status === 'rejected') console.warn("Aviso: Tabela 'cardapio_composition' não encontrada.", compositionRes.reason);
        
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
        renderAdminCatalog();
        renderAnalytics();
        renderCompositionView();
    }
    
    function renderSimpleTable(tableEl, data, rowCreator) {
        const tbody = tableEl?.querySelector('tbody');
        if (!tbody || !data) return;
        tbody.innerHTML = '';
        data.forEach(item => tbody.appendChild(rowCreator(item)));
    }

    function createQuoteRow(quote) {
        const row = document.createElement('tr');
        const statusOptions = ['Rascunho', 'Em analise', 'Ganho', 'Perdido'];
        const selectHTML = `<select class="status-select" data-id="${quote.id}">${statusOptions.map(opt => `<option value="${opt}" ${quote.status === opt ? 'selected' : ''}>${opt}</option>`).join('')}</select>`;
        row.innerHTML = `<td>${quote.client_name || 'Rascunho sem nome'}</td><td>${new Date(quote.created_at).toLocaleDateString('pt-BR')}</td><td>${selectHTML}</td><td class="actions"><a href="index.html?quote_id=${quote.id}" class="btn">Editar</a><a href="evento.html?quote_id=${quote.id}" class="btn" style="${quote.status === 'Ganho' ? '' : 'display:none;'}">Gerenciar</a><button class="btn-remove" data-action="delete-quote" data-id="${quote.id}">&times;</button></td>`;
        return row;
    }

    function createEventRow(event) {
        const row = document.createElement('tr');
        const eventDate = event.quote_data?.event_dates?.[0]?.date ? new Date(event.quote_data.event_dates[0].date + 'T12:00:00Z').toLocaleDateString('pt-BR') : 'Data não definida';
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

    // FUNÇÃO CORRIGIDA
    function renderAdminCatalog() {
        if (!adminCatalogContainer) return;
        adminCatalogContainer.innerHTML = '';
        
        // CORREÇÃO: Usa todos os serviços, sem filtrar 'Gastronomia'
        const servicesByCategory = services.reduce((acc, service) => {
            if (!acc[service.category]) acc[service.category] = [];
            acc[service.category].push(service);
            return acc;
        }, {});
        
        // CORREÇÃO: Adiciona 'Gastronomia' de volta à lista de categorias
        const orderedCategories = ['Gastronomia', 'Espaço', 'Equipamentos', 'Serviços / Outros'];
        
        orderedCategories.forEach(category => {
            if (!servicesByCategory[category]) return;
            const categoryWrapper = document.createElement('div');
            categoryWrapper.innerHTML = `<details class="category-accordion" open><summary class="category-header"><h3 class="category-title">${category}</h3></summary><div class="table-container"><table class="editable-table"><thead><tr><th>Nome</th><th>Unidade</th><th class="actions">Ações</th></tr></thead><tbody>${servicesByCategory[category].map(service => `<tr data-id="${service.id}"><td><input type="text" class="editable-input" data-field="name" value="${service.name}"></td><td><input type="text" class="editable-input" data-field="unit" value="${service.unit}"></td><td class="actions"><button class="btn-remove" data-action="delete-service" data-id="${service.id}">&times;</button></td></tr>`).join('')}</tbody></table></div></details>`;
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
    
    function renderAnalytics() { /* ... Lógica de Analytics ... */ }

    // =================================================================
    // EVENT LISTENERS E AÇÕES
    // =================================================================
    function addEventListeners() {
        document.querySelector('.tabs-nav')?.addEventListener('click', (e) => {
            const clickedTab = e.target.closest('.tab-btn');
            if (!clickedTab) return;
            const tabId = clickedTab.dataset.tab;
            document.querySelector('.tabs-nav').querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
            clickedTab.classList.add('active');
            document.getElementById(`tab-content-${tabId}`).classList.add('active');
        });
        document.body.addEventListener('click', (e) => {
            const header = e.target.closest('.collapsible-card > .card-header');
            if (header) header.closest('.collapsible-card')?.classList.toggle('collapsed');
        });
        
        document.getElementById('add-cardapio-item-form')?.addEventListener('submit', handleFormSubmit);
        document.getElementById('addServiceForm')?.addEventListener('submit', handleFormSubmit);
        document.getElementById('addPriceTableForm')?.addEventListener('submit', handleFormSubmit);
        document.getElementById('addPaymentMethodForm')?.addEventListener('submit', handleFormSubmit);
        document.getElementById('add-item-to-cardapio-form')?.addEventListener('submit', handleFormSubmit);

        document.body.addEventListener('click', handleTableActions);
        document.body.addEventListener('change', handleTableEdits);
        selectCardapioToEdit?.addEventListener('change', (e) => { selectedCardapioId = e.target.value; renderCompositionDetails(); });
    }

    async function handleFormSubmit(e) {
        e.preventDefault();
        const formId = e.target.id;
        let result;
        let successMessage = 'Registro salvo com sucesso!';

        try {
            if (formId === 'add-cardapio-item-form') {
                const name = document.getElementById('cardapioItemName').value;
                const description = document.getElementById('cardapioItemDescription').value;
                if (!name) return;
                result = await supabase.from('cardapio_items').insert([{ name, description }]);
            } else if (formId === 'addServiceForm') {
                const name = document.getElementById('serviceName').value;
                const category = document.getElementById('serviceCategory').value;
                const unit = document.getElementById('serviceUnit').value;
                if (!name) return;
                result = await supabase.from('services').insert([{ name, category, unit }]);
            } else if (formId === 'addPriceTableForm') {
                const name = document.getElementById('tableName').value;
                const consumable_credit = document.getElementById('tableConsumable').value;
                result = await supabase.from('price_tables').insert([{ name, consumable_credit }]);
            } else if (formId === 'addPaymentMethodForm') {
                 const name = document.getElementById('paymentMethodName').value;
                 result = await supabase.from('payment_methods').insert([{ name }]);
            } else if (formId === 'add-item-to-cardapio-form') {
                if (!selectedCardapioId) return;
                const item_id = selectItemToAdd.value;
                result = await supabase.from('cardapio_composition').insert([{ cardapio_service_id: selectedCardapioId, item_id }]);
                successMessage = 'Item adicionado ao cardápio!';
            }

            if (result && result.error) throw result.error;
            
            showNotification(successMessage);
            if(e.target.tagName === 'FORM') e.target.reset();
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
            'delete-quote': 'quotes',
            'delete-service': 'services',
            'delete-table': 'price_tables',
            'delete-payment-method': 'payment_methods',
            'delete-cardapio-item': 'cardapio_items',
            'delete-composition-item': 'cardapio_composition'
        };

        if (tables[action]) {
            if (!confirm('Tem certeza?')) return;
            const { error } = await supabase.from(tables[action]).delete().eq('id', id);
            if (error) { showNotification(`Erro: ${error.message}`, true); }
            else { showNotification('Registro excluído.'); fetchData(); }
        }
    }
    
    async function handleTableEdits(e) {
        const input = e.target;
        if (!input.classList.contains('editable-input') && !input.classList.contains('status-select')) return;
        
        const row = input.closest('tr');
        const id = row.dataset.id;
        if(!id) return; // Se a linha não tiver ID, ignora
        
        const { field } = input.dataset;
        const value = input.value;
        let tableName;

        const table = row.closest('table');
        if (!table) return;

        // Mapeia o ID da tabela para o nome da tabela no Supabase
        const tableMap = {
            'cardapio-items-table': 'cardapio_items',
            'payment-methods-table': 'payment_methods',
            'price-tables-list': 'price_tables',
            'quotes-table': 'quotes',
        };
        tableName = tableMap[table.id];

        // Caso especial para o catálogo de serviços, que é mais complexo
        if (table.closest('#admin-catalog-container')) {
            tableName = 'services';
        }

        if (tableName) {
            const { error } = await supabase.from(tableName).update({ [field]: value }).eq('id', id);
            if (error) { showNotification(`Erro: ${error.message}`, true); fetchData(); }
            else { showFlash(input); }
        }
    }
    
    initialize();
});
