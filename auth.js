import { supabase, getSession } from './supabase-client.js';

document.addEventListener('DOMContentLoaded', async () => {
    if (!document.querySelector('.tabs-nav')) return;
    
    const { role } = await getSession();
    if (role !== 'admin') {
        window.location.href = 'login.html';
        return;
    }

    // ESTADO GLOBAL
    let services = [], priceTables = [], quotes = [], paymentMethods = [], cardapioItems = [], cardapioComposition = [], units = [];
    let selectedCardapioId = null;

    // SELETORES DO DOM
    const notification = document.getElementById('save-notification');
    const adminCatalogContainer = document.getElementById('admin-catalog-container');
    const cardapioItemsTbody = document.getElementById('cardapio-items-table')?.querySelector('tbody');
    const selectCardapioToEdit = document.getElementById('select-cardapio-to-edit');
    const compositionSection = document.getElementById('composition-section');
    const editingCardapioName = document.getElementById('editing-cardapio-name');
    const selectItemToAdd = document.getElementById('select-item-to-add');
    const serviceUnitSelect = document.getElementById('serviceUnit');

    // =================================================================
    // INICIALIZAÇÃO
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
            supabase.from('cardapio_composition').select('*, item:item_id(id, name)'),
            supabase.from('units').select('name').order('name')
        ]);

        const [servicesRes, tablesRes, quotesRes, paymentsRes, itemsRes, compositionRes, unitsRes] = results;

        services = (servicesRes.status === 'fulfilled') ? servicesRes.value.data : [];
        priceTables = (tablesRes.status === 'fulfilled') ? tablesRes.value.data : [];
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
    }
    
    function renderSimpleTable(tableEl, data, rowCreator) {
        const tbody = tableEl?.querySelector('tbody');
        if (!tbody || !data) return;
        tbody.innerHTML = '';
        data.forEach(item => tbody.appendChild(rowCreator(item)));
    }

    function createQuoteRow(quote) {
        const row = document.createElement('tr');
        row.innerHTML = `<td>${quote.client_name || 'Rascunho'}</td><td>${new Date(quote.created_at).toLocaleDateString('pt-BR')}</td><td>...</td><td class="actions"><a href="index.html?quote_id=${quote.id}" class="btn">Editar</a></td>`;
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
        row.dataset.id = unit.name; // Usa o nome como ID para deleção
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
            let rowsHtml = servicesByCategory[category].map(service => {
                const duplicateButton = category === 'Gastronomia' ? `<button class="btn btn-slim" data-action="duplicate-cardapio" data-id="${service.id}" title="Duplicar Cardápio">⧉</button>` : '';
                return `<tr data-id="${service.id}">
                    <td><input type="text" class="editable-input" data-field="name" value="${service.name}"></td>
                    <td>${createUnitSelect(service.unit)}</td>
                    <td class="actions">${duplicateButton}<button class="btn-remove" data-action="delete-service" data-id="${service.id}">&times;</button></td>
                </tr>`;
            }).join('');
            categoryWrapper.innerHTML = `<details class="category-accordion" open><summary class="category-header"><h3 class="category-title">${category}</h3></summary><div class="table-container"><table class="editable-table"><thead><tr><th>Nome</th><th>Unidade</th><th class="actions">Ações</th></tr></thead><tbody>${rowsHtml}</tbody></table></div></details>`;
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
    
    function createUnitSelect(currentUnit) {
        return `<select class="editable-input" data-field="unit">${units.map(unit => `<option value="${unit.name}" ${unit.name === currentUnit ? 'selected' : ''}>${unit.name}</option>`).join('')}</select>`;
    }
    
    function renderAnalytics() { /* ... */ }

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
        const formId = form.id;
        let result, successMessage = 'Salvo com sucesso!';
        try {
            if (formId === 'add-cardapio-item-form') {
                const name = form.querySelector('#cardapioItemName').value;
                const description = form.querySelector('#cardapioItemDescription').value;
                result = await supabase.from('cardapio_items').insert([{ name, description }]);
            } else if (formId === 'addServiceForm') {
                const name = form.querySelector('#serviceName').value;
                const category = form.querySelector('#serviceCategory').value;
                const unit = form.querySelector('#serviceUnit').value;
                result = await supabase.from('services').insert([{ name, category, unit }]);
            } else if (formId === 'addPriceTableForm') {
                const name = form.querySelector('#tableName').value;
                const consumable_credit = form.querySelector('#tableConsumable').value;
                result = await supabase.from('price_tables').insert([{ name, consumable_credit }]);
            } else if (formId === 'addPaymentMethodForm') {
                 const name = form.querySelector('#paymentMethodName').value;
                 result = await supabase.from('payment_methods').insert([{ name }]);
            } else if (formId === 'addUnitForm') {
                 const name = form.querySelector('#unitName').value;
                 result = await supabase.from('units').insert([{ name }]);
            } else if (formId === 'add-item-to-cardapio-form') {
                if (!selectedCardapioId) return;
                const item_id = selectItemToAdd.value;
                result = await supabase.from('cardapio_composition').insert([{ cardapio_service_id: selectedCardapioId, item_id }]);
                successMessage = 'Item adicionado ao cardápio!';
            }

            if (result && result.error) throw result.error;
            showNotification(successMessage);
            form.reset();
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
            'delete-service': 'services', 'delete-table': 'price_tables', 'delete-payment-method': 'payment_methods',
            'delete-cardapio-item': 'cardapio_items', 'delete-composition-item': 'cardapio_composition', 'delete-unit': 'units'
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
        if (!input.classList.contains('editable-input')) return;
        const row = input.closest('tr');
        const id = row.dataset.id;
        if(!id) return;
        const { field } = input.dataset;
        const value = input.value;
        const tableId = row.closest('table')?.id;
        const tableMap = {
            'cardapio-items-table': 'cardapio_items', 'payment-methods-table': 'payment_methods',
            'price-tables-list': 'price_tables', 'units-table': 'units'
        };
        let tableName = tableMap[tableId];
        if (row.closest('#admin-catalog-container')) tableName = 'services';
        if (tableName) {
            const { error } = await supabase.from(tableName).update({ [field]: value }).eq(tableName === 'units' ? 'name' : 'id', id);
            if (error) { showNotification(`Erro: ${error.message}`, true); fetchData(); }
            else { showFlash(input); }
        }
    }
    
    async function duplicateCardapio(serviceId) {
        showNotification('Duplicando cardápio, por favor aguarde...');
        try {
            // 1. Pega dados originais
            const { data: originalService, error: serviceError } = await supabase.from('services').select('*').eq('id', serviceId).single();
            if (serviceError) throw serviceError;
            
            const { data: originalComposition, error: compositionError } = await supabase.from('cardapio_composition').select('item_id').eq('cardapio_service_id', serviceId);
            if (compositionError) throw compositionError;
            
            const { data: originalPrices, error: pricesError } = await supabase.from('service_prices').select('price_table_id, price').eq('service_id', serviceId);
            if (pricesError) throw pricesError;

            // 2. Cria o novo serviço (cardápio)
            const { data: newService, error: newServiceError } = await supabase.from('services').insert({
                name: `${originalService.name} Cópia`,
                category: originalService.category,
                unit: originalService.unit
            }).select().single();
            if (newServiceError) throw newServiceError;

            // 3. Duplica a composição
            if (originalComposition && originalComposition.length > 0) {
                const newComposition = originalComposition.map(item => ({
                    cardapio_service_id: newService.id,
                    item_id: item.item_id
                }));
                const { error: newCompositionError } = await supabase.from('cardapio_composition').insert(newComposition);
                if (newCompositionError) throw newCompositionError;
            }

            // 4. Duplica os preços
            if (originalPrices && originalPrices.length > 0) {
                const newPrices = originalPrices.map(price => ({
                    service_id: newService.id,
                    price_table_id: price.price_table_id,
                    price: price.price
                }));
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
