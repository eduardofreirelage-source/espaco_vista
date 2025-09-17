import { supabase, getSession } from './supabase-client.js';

document.addEventListener('DOMContentLoaded', async () => {
    // ... (outras declarações de variáveis)
    let services = [], priceTables = [], servicePrices = [], quotes = [], paymentMethods = [], menuItems = [], menuSubitems = [], menuComposition = [], units = [];
    
    // ... (outras declarações de seletores)
    const compositionManager = document.getElementById('composition-manager');

    async function fetchData() {
        const results = await Promise.allSettled([
            // ... (outras chamadas supabase)
            supabase.from('menu_items').select('*').order('name'),
            supabase.from('menu_subitems').select('*').order('name'),
            supabase.from('menu_composition').select('*, item:item_id(*), subitem:subitem_id(*)'),
            // ...
        ]);

        const [servicesRes, tablesRes, pricesRes, quotesRes, paymentsRes, itemsRes, subitemsRes, compositionRes, unitsRes] = results;
        services = (servicesRes.status === 'fulfilled') ? servicesRes.value.data : [];
        // ... (atribuição de outras variáveis)
        menuItems = (itemsRes.status === 'fulfilled') ? itemsRes.value.data : [];
        menuSubitems = (subitemsRes.status === 'fulfilled') ? subitemsRes.value.data : [];
        menuComposition = (compositionRes.status === 'fulfilled') ? compositionRes.value.data : [];
        // ...
        
        renderAll();
    }

    function renderAll() {
        // ... (outras funções de renderização)
        renderSimpleTable(document.getElementById('menu-items-table'), menuItems, createMenuItemRow);
        renderSimpleTable(document.getElementById('menu-subitems-table'), menuSubitems, createMenuSubitemRow);
        renderCompositionManager();
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
        const itemsInService = [...new Set(compositionForService.map(c => c.item_id))].map(id => menuItems.find(mi => mi.id === id));

        let html = `
            <hr class="section-divider">
            <h4>2. Adicione Itens (Seções) ao Cardápio</h4>
            <form id="add-item-to-service-form" class="inline-form" data-service-id="${serviceId}">
                <div class="form-group">
                    <label>Selecione um Item</label>
                    <select name="item_id" required>
                        ${menuItems.map(item => `<option value="${item.id}">${item.name}</option>`).join('')}
                    </select>
                </div>
                <button type="submit" class="btn btn-primary">Adicionar Item ao Cardápio</button>
            </form>
            <div id="items-and-subitems-container">`;

        itemsInService.forEach(item => {
            const subitemsInItem = compositionForService.filter(c => c.item_id === item.id);
            html += `
                <div class="sub-section item-composition-group">
                    <div class="composition-header">
                        <h5>${item.name}</h5>
                        <button class="btn-remove" data-action="remove-item-from-service" data-service-id="${serviceId}" data-item-id="${item.id}">&times;</button>
                    </div>
                    <ul class="subitem-list">
                        ${subitemsInItem.map(comp => `
                            <li>${comp.subitem.name} <button class="btn-remove-inline" data-action="remove-subitem-from-item" data-composition-id="${comp.id}">&times;</button></li>
                        `).join('') || '<li>Nenhum subitem adicionado.</li>'}
                    </ul>
                    <form class="inline-form" data-action="add-subitem-to-item" data-service-id="${serviceId}" data-item-id="${item.id}">
                         <div class="form-group">
                            <select name="subitem_id" required>
                                ${menuSubitems.map(sub => `<option value="${sub.id}">${sub.name}</option>`).join('')}
                            </select>
                        </div>
                        <button type="submit" class="btn">Adicionar Subitem</button>
                    </form>
                </div>`;
        });
        
        html += `</div>`;
        container.innerHTML = html;
    }

    // EVENT LISTENERS E AÇÕES (funções handle... modificadas)
    function addEventListeners() {
        // ...
        document.getElementById('add-menu-item-form')?.addEventListener('submit', handleFormSubmit);
        document.getElementById('add-menu-subitem-form')?.addEventListener('submit', handleFormSubmit);
        
        compositionManager?.addEventListener('change', e => {
            if (e.target.id === 'select-main-cardapio') {
                const serviceId = e.target.value;
                if (serviceId) {
                    renderCompositionDetails(serviceId);
                    document.getElementById('composition-details').style.display = 'block';
                } else {
                    document.getElementById('composition-details').style.display = 'none';
                }
            }
        });

        compositionManager?.addEventListener('submit', async e => {
            e.preventDefault();
            const form = e.target;
            if (form.id === 'add-item-to-service-form') {
                const serviceId = form.dataset.serviceId;
                const itemId = new FormData(form).get('item_id');
                // Adiciona um placeholder, o item real precisa de um subitem para aparecer
                // Uma melhoria futura seria adicionar o item e depois os subitens
                showNotification("Selecione um subitem para adicionar a este item.", true);
            } else if (form.dataset.action === 'add-subitem-to-item') {
                const { serviceId, itemId } = form.dataset;
                const subitemId = new FormData(form).get('subitem_id');
                const { error } = await supabase.from('menu_composition').insert({ service_id: serviceId, item_id: itemId, subitem_id: subitemId });
                if (error) {
                    showNotification("Erro ao adicionar subitem.", true);
                } else {
                    showNotification("Subitem adicionado com sucesso.");
                    fetchData();
                }
            }
        });
        
        compositionManager?.addEventListener('click', async e => {
            const button = e.target.closest('button[data-action]');
            if (!button) return;
            
            if (button.dataset.action === 'remove-subitem-from-item') {
                if (!confirm("Remover subitem?")) return;
                const { error } = await supabase.from('menu_composition').delete().eq('id', button.dataset.compositionId);
                if (!error) { showNotification("Subitem removido."); fetchData(); }
            }
            if (button.dataset.action === 'remove-item-from-service') {
                if (!confirm("Remover este item e todos os seus subitens do cardápio?")) return;
                const { serviceId, itemId } = button.dataset;
                const { error } = await supabase.from('menu_composition').delete().match({ service_id: serviceId, item_id: itemId });
                 if (!error) { showNotification("Item removido."); fetchData(); }
            }
        });
    }

    async function handleFormSubmit(e) {
        // ...
        switch (form.id) {
            case 'add-menu-item-form':
                result = await supabase.from('menu_items').insert([{ name: form.querySelector('#itemName').value, description: form.querySelector('#itemDescription').value }]);
                break;
            case 'add-menu-subitem-form':
                result = await supabase.from('menu_subitems').insert([{ name: form.querySelector('#subitemName').value, description: form.querySelector('#subitemDescription').value }]);
                break;
            // ...
        }
    }
    
    async function handleTableActions(e) {
        // ...
        const tables = {
            'delete-menu-item': 'menu_items',
            'delete-menu-subitem': 'menu_subitems',
            // ...
        };
    }

    // ... (restante do arquivo)
});
