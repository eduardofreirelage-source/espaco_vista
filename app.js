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
            const rowId = `item-row-${index}`;
            row.id = rowId;
            
            // Define colunas com base na categoria
            let columnsHTML = '';
            if (service.category === 'Espaço') {
                columnsHTML = `<td>R$ ${total.toFixed(2)}</td>`;
            } else {
                columnsHTML = `
                    <td>R$ ${unitPrice.toFixed(2)}</td>
                    <td><input type="number" value="${quantity}" min="1" ${isPerPerson ? 'disabled' : ''} data-index="${index}" data-field="quantity"></td>
                    <td>R$ ${total.toFixed(2)}</td>
                `;
            }

            row.innerHTML = `
                <td>
                    <strong>${service.name}</strong>
                    <div class="item-details">
                        <div class="form-group">
                            <label>Data do Serviço:</label>
                            <select data-index="${index}" data-field="assignedDate">
                                <option value="">Selecione a data</option>
                                ${dateOptions}
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Observações:</label>
                            <textarea data-index="${index}" data-field="observacoes" rows="2">${item.observacoes || ''}</textarea>
                        </div>
                    </div>
                </td>
                ${columnsHTML}
                <td><button class="btn-remove" data-index="${index}">&times;</button></td>
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
            if (service.category === 'Gastronomia') {
                gastronomySubtotal += itemTotal;
            }
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
            quote.general.dates.push(new Date().toISOString().split('T')[0]); // Adiciona data de hoje como padrão
            render();
        });

        document.querySelectorAll('.btn-add').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const category = e.target.dataset.category;
                openAddItemModal(category);
            });
        });
        
        // Listeners para os campos principais
        guestCountInput.addEventListener('input', e => { quote.general.guestCount = parseInt(e.target.value) || 0; render(); });
        priceTableSelect.addEventListener('change', e => { quote.general.priceTable = e.target.value; render(); });
        discountInput.addEventListener('input', calculateTotal);
        
        // Delegação de eventos para itens dinâmicos
        document.querySelector('main').addEventListener('change', (e) => {
            if (e.target.dataset.index) {
                const { index, field } = e.target.dataset;
                const value = e.target.type === 'number' ? parseInt(e.target.value) : e.target.value;
                updateItem(index, field, value);
            }
        });
        document.querySelector('main').addEventListener('click', (e) => {
             if (e.target.classList.contains('btn-remove') && e.target.dataset.index) {
                removeItem(e.target.dataset.index);
            }
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
    
    // --- FUNÇÕES GLOBAIS DE MANIPULAÇÃO DO ORÇAMENTO ---
    window.updateDate = (index, value) => { quote.general.dates[index] = value; render(); };
    window.removeDate = (index) => { quote.general.dates.splice(index, 1); render(); };
    
    function removeItem(index) {
        quote.items.splice(index, 1);
        render();
    }
    function updateItem(index, key, value) {
        quote.items[index][key] = value;
        render();
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
    
    // --- INICIALIZAÇÃO DA APLICAÇÃO ---
    initialize();
});
