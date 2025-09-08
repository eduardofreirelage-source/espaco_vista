import { supabase } from './supabase-client.js';

document.addEventListener('DOMContentLoaded', () => {
    // --- ESTADO DA APLICAÇÃO ---
    let appData = { services: [], tabelas: {} };
    let quote = {
        general: { guestCount: 100, priceTable: '', discount: 0, dates: [] },
        items: []
    };

    // --- ELEMENTOS DO DOM ---
    const guestCountInput = document.getElementById('guestCount');
    const priceTableSelect = document.getElementById('priceTableSelect');
    const discountInput = document.getElementById('discountValue');
    const addDateBtn = document.getElementById('add-date-btn');
    const addItemModal = document.getElementById('addItemModal');

    // --- INICIALIZAÇÃO ---
    async function initialize() {
        try {
            await loadDataFromSupabase();
            populatePriceTables();
            addEventListeners();
            render();
        } catch (error) {
            console.error("Falha crítica na inicialização:", error);
            alert("Não foi possível carregar os dados do banco de dados. Verifique sua conexão ou as configurações do Supabase.");
        }
    }

    async function loadDataFromSupabase() {
        const { data: servicesData, error: servicesError } = await supabase.from('services').select('*');
        if (servicesError) throw servicesError; // Lança o erro para o bloco catch

        const { data: tablesData, error: tablesError } = await supabase.from('price_tables').select('*');
        if (tablesError) throw tablesError; // Lança o erro para o bloco catch

        appData.services = servicesData || [];
        appData.tabelas = (tablesData || []).reduce((acc, table) => {
            acc[table.name] = { modificador: table.modifier };
            return acc;
        }, {});
    }

    function populatePriceTables() {
        priceTableSelect.innerHTML = Object.keys(appData.tabelas).map(name => `<option value="${name}">${name}</option>`).join('');
        if (priceTableSelect.options.length > 0) {
            quote.general.priceTable = priceTableSelect.value;
        }
    }

    // --- LÓGICA DE RENDERIZAÇÃO ---
    function render() {
        renderDateInputs();
        renderQuoteTables();
        calculateTotal();
    }
    
    function renderDateInputs() {
        const container = document.getElementById('event-dates-container');
        container.innerHTML = '';
        quote.general.dates.forEach((date, index) => {
            const div = document.createElement('div');
            div.className = 'date-entry';
            div.innerHTML = `
                <input type="date" value="${date}" data-index="${index}" data-action="updateDate">
                <button class="btn-remove" data-index="${index}" data-action="removeDate">&times;</button>
            `;
            container.appendChild(div);
        });
    }

    function renderQuoteTables() {
        const tables = {
            'Espaço': document.getElementById('espaco-table-body'),
            'Gastronomia': document.getElementById('gastronomia-table-body'),
            'Equipamentos': document.getElementById('equipamentos-table-body'),
            'Serviços / Outros': document.getElementById('servicos-outros-table-body')
        };
        Object.values(tables).forEach(tbody => tbody.innerHTML = '');

        const prices = getCalculatedPrices();
        quote.items.forEach((item, index) => {
            const service = appData.services.find(s => s.id === item.id);
            if (!service || !tables[service.category]) return;

            const tableBody = tables[service.category];
            const unitPrice = prices[item.id] || 0;
            const isPerPerson = service.unit === 'por_pessoa';
            const quantity = isPerPerson ? quote.general.guestCount : item.quantity;
            const total = unitPrice * quantity;
            const dateOptions = quote.general.dates.map((d, i) => `<option value="${d}" ${d === item.assignedDate ? 'selected' : ''}>Data ${i + 1} (${d || 'N/D'})</option>`).join('');

            const row = document.createElement('tr');
            row.innerHTML = `
                <td>
                    <strong>${service.name}</strong>
                    <div class="item-details">
                        <div class="form-group"><label>Data do Serviço:</label><select data-index="${index}" data-field="assignedDate"><option value="">Selecione</option>${dateOptions}</select></div>
                        <div class="form-group"><label>Observações:</label><textarea data-index="${index}" data-field="observacoes" rows="2">${item.observacoes || ''}</textarea></div>
                    </div>
                </td>
                <td>R$ ${unitPrice.toFixed(2)}</td>
                <td><input type="number" value="${quantity}" min="1" ${isPerPerson ? 'disabled' : ''} data-index="${index}" data-field="quantity"></td>
                <td>R$ ${total.toFixed(2)}</td>
                <td class="item-actions">
                    <button class="btn-duplicate" title="Duplicar Item" data-index="${index}">📋</button>
                    <button class="btn-remove" title="Remover Item" data-index="${index}">&times;</button>
                </td>
            `;
            tableBody.appendChild(row);
        });
    }
    
    // --- LÓGICA DE CÁLCULO ---
    function calculateTotal() {
        const prices = getCalculatedPrices();
        let subtotal = 0;
        let gastronomySubtotal = 0;

        quote.items.forEach(item => {
            const service = appData.services.find(s => s.id === item.id);
            if (!service) return;
            const unitPrice = prices[item.id] || 0;
            const quantity = service.unit === 'por_pessoa' ? quote.general.guestCount : (item.quantity || 1);
            const itemTotal = unitPrice * quantity;
            subtotal += itemTotal;
            if (service.category === 'Gastronomia') gastronomySubtotal += itemTotal;
        });

        const serviceFee = gastronomySubtotal * 0.10;
        const discount = parseFloat(discountInput.value) || 0;
        const total = subtotal + serviceFee - discount;

        document.getElementById('subtotalValue').textContent = `R$ ${subtotal.toFixed(2)}`;
        document.getElementById('serviceFeeValue').textContent = `R$ ${serviceFee.toFixed(2)}`;
        document.getElementById('totalValue').textContent = `R$ ${total.toFixed(2)}`;
    }

    // --- MANIPULADORES DE EVENTOS ---
    function addEventListeners() {
        addDateBtn.addEventListener('click', () => {
            quote.general.dates.push(new Date().toISOString().split('T')[0]);
            render();
        });

        document.querySelectorAll('.btn-add').forEach(btn => {
            btn.addEventListener('click', () => openAddItemModal(btn.dataset.category));
        });
        
        guestCountInput.addEventListener('input', e => { quote.general.guestCount = parseInt(e.target.value) || 0; render(); });
        priceTableSelect.addEventListener('change', e => { quote.general.priceTable = e.target.value; render(); });
        discountInput.addEventListener('input', calculateTotal);
        
        document.body.addEventListener('change', e => {
            const { index, field, action } = e.target.dataset;
            if (index && field) updateItem(index, field, e.target.value);
            if (index && action === 'updateDate') updateDate(index, e.target.value);
        });
        document.body.addEventListener('click', e => {
            const { index, action } = e.target.dataset;
            if (action === 'removeDate') removeDate(index);
            if (e.target.classList.contains('btn-remove') && index) removeItem(index);
            if (e.target.classList.contains('btn-duplicate') && index) duplicateItem(index);
        });
    }
    
    // --- LÓGICA DO MODAL ---
    function openAddItemModal(category) {
        document.getElementById('modalCategoryTitle').textContent = `Adicionar Item de ${category}`;
        const itemList = document.getElementById('modalItemList');
        itemList.innerHTML = '';
        appData.services
            .filter(s => s.category === category)
            .forEach(service => {
                const itemDiv = document.createElement('div');
                itemDiv.className = 'modal-item';
                itemDiv.textContent = service.name;
                itemDiv.onclick = () => {
                    quote.items.push({ id: service.id, quantity: 1, assignedDate: '', observacoes: '' });
                    addItemModal.style.display = 'none';
                    render();
                };
                itemList.appendChild(itemDiv);
            });
        addItemModal.style.display = 'block';
    }
    document.querySelector('#addItemModal .close-button').onclick = () => addItemModal.style.display = 'none';
    
    // --- FUNÇÕES DE MANIPULAÇÃO DO ORÇAMENTO ---
    function updateDate(index, value) { quote.general.dates[index] = value; render(); }
    function removeDate(index) { quote.general.dates.splice(index, 1); render(); }
    function removeItem(index) { quote.items.splice(parseInt(index), 1); render(); }
    function duplicateItem(index) {
        const itemToDuplicate = quote.items[parseInt(index)];
        if (itemToDuplicate) {
            const newItem = JSON.parse(JSON.stringify(itemToDuplicate));
            quote.items.splice(parseInt(index) + 1, 0, newItem);
            render();
        }
    }
    function updateItem(index, key, value) {
        const item = quote.items[parseInt(index)];
        if (item) {
            item[key] = (key === 'quantity') ? parseInt(value) : value;
            render();
        }
    }

    // --- FUNÇÕES AUXILIARES ---
    function getCalculatedPrices() {
        const tableName = priceTableSelect.value;
        const table = appData.tabelas[tableName];
        if (!table) return {};
        const prices = {};
        appData.services.forEach(service => {
            prices[service.id] = (service.base_price || 0) * (table.modificador || 1);
        });
        return prices;
    }
    
    initialize();
});
