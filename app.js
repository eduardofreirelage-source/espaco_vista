import { supabase } from './supabase-client.js';

document.addEventListener('DOMContentLoaded', () => {
    let appData = {
        services: [],
        tabelas: {}
    };
    let quote = {
        general: { guestCount: 100, priceTable: '', discount: 0, dates: [] },
        items: []
    };

    // --- INICIALIZAÇÃO ---
    async function initialize() {
        await loadDataFromSupabase();
        populatePriceTables();
        addEventListeners();
        render();
    }

    async function loadDataFromSupabase() {
        const { data: servicesData, error: servicesError } = await supabase.from('services').select('*');
        if (servicesError) console.error('Erro ao buscar serviços:', servicesError.message);
        else appData.services = servicesData;

        const { data: tablesData, error: tablesError } = await supabase.from('price_tables').select('*');
        if (tablesError) console.error('Erro ao buscar tabelas:', tablesError.message);
        else {
            appData.tabelas = tablesData.reduce((acc, table) => {
                acc[table.name] = { modificador: table.modifier };
                return acc;
            }, {});
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
                <input type="date" value="${date}" onchange="updateDate(${index}, this.value)">
                <button class="btn-remove" onclick="removeDate(${index})">&times;</button>
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
                        <div class="form-group"><label>Data do Serviço:</label><select onchange="updateItem(${index}, 'assignedDate', this.value)"><option value="">Selecione</option>${dateOptions}</select></div>
                        <div class="form-group"><label>Observações:</label><textarea onchange="updateItem(${index}, 'observacoes', this.value)" rows="2">${item.observacoes || ''}</textarea></div>
                    </div>
                </td>
                ${ service.category === 'Espaço' ? 
                   `<td>R$ ${total.toFixed(2)}</td>` :
                   `<td>R$ ${unitPrice.toFixed(2)}</td>
                    <td><input type="number" value="${quantity}" min="1" ${isPerPerson ? 'disabled' : ''} onchange="updateItem(${index}, 'quantity', this.value)"></td>
                    <td>R$ ${total.toFixed(2)}</td>`
                }
                <td><button class="btn-remove" onclick="removeItem(${index})">&times;</button></td>
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
            const quantity = service.unit === 'por_pessoa' ? quote.general.guestCount : item.quantity;
            const itemTotal = unitPrice * quantity;
            subtotal += itemTotal;
            if (service.category === 'Gastronomia') gastronomySubtotal += itemTotal;
        });

        const serviceFee = gastronomySubtotal * 0.10;
        const discount = parseFloat(document.getElementById('discountValue').value) || 0;
        const total = subtotal + serviceFee - discount;

        document.getElementById('subtotalValue').textContent = `R$ ${subtotal.toFixed(2)}`;
        document.getElementById('serviceFeeValue').textContent = `R$ ${serviceFee.toFixed(2)}`;
        document.getElementById('totalValue').textContent = `R$ ${total.toFixed(2)}`;
    }

    // --- MANIPULADORES DE EVENTOS ---
    function addEventListeners() {
        document.getElementById('add-date-btn').addEventListener('click', () => {
            quote.general.dates.push('');
            render();
        });
        document.querySelectorAll('.btn-add').forEach(btn => {
            btn.addEventListener('click', (e) => openAddItemModal(e.target.dataset.category));
        });
        document.getElementById('guestCount').addEventListener('input', e => { quote.general.guestCount = parseInt(e.target.value) || 0; render(); });
        document.getElementById('priceTableSelect').addEventListener('change', e => { quote.general.priceTable = e.target.value; render(); });
        document.getElementById('discountValue').addEventListener('input', calculateTotal);
    }
    
    // --- LÓGICA DO MODAL ---
    function openAddItemModal(category) {
        const modal = document.getElementById('addItemModal');
        const itemList = document.getElementById('modalItemList');
        document.getElementById('modalCategoryTitle').textContent = `Adicionar Item de ${category}`;
        itemList.innerHTML = '';
        appData.services
            .filter(s => s.category === category)
            .forEach(service => {
                const itemDiv = document.createElement('div');
                itemDiv.className = 'modal-item';
                itemDiv.textContent = service.name;
                itemDiv.onclick = () => {
                    quote.items.push({ id: service.id, quantity: 1, assignedDate: '', observacoes: '' });
                    modal.style.display = 'none';
                    render();
                };
                itemList.appendChild(itemDiv);
            });
        modal.style.display = 'block';
    }

    document.querySelector('#addItemModal .close-button').onclick = () => document.getElementById('addItemModal').style.display = 'none';

    // --- FUNÇÕES GLOBAIS ---
    window.updateDate = (index, value) => { quote.general.dates[index] = value; render(); };
    window.removeDate = (index) => { quote.general.dates.splice(index, 1); render(); };
    window.removeItem = (index) => { quote.items.splice(index, 1); render(); };
    window.updateItem = (index, key, value) => {
        if (key === 'quantity') value = parseInt(value);
        quote.items[index][key] = value;
        render();
    };

    function getCalculatedPrices() {
        const tableName = document.getElementById('priceTableSelect').value;
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
