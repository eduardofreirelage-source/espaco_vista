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
    const quoteTableBody = document.getElementById('quote-table-body');
    const serviceSearchInput = document.getElementById('service-search');
    const searchResultsContainer = document.getElementById('service-search-results');


    // --- INICIALIZAÇÃO ---
    async function initialize() {
        try {
            await loadDataFromSupabase();
            populatePriceTables(); // <-- ESTA FUNÇÃO ESTAVA FALTANDO
            addEventListeners();
            render();
        } catch (error) {
            console.error("Falha crítica na inicialização:", error);
            alert("Não foi possível carregar os dados do banco de dados. Verifique sua conexão ou as configurações do Supabase.");
        }
    }

    async function loadDataFromSupabase() {
        const { data: servicesData, error: servicesError } = await supabase.from('services').select('*');
        if (servicesError) throw servicesError;

        const { data: tablesData, error: tablesError } = await supabase.from('price_tables').select('*');
        if (tablesError) throw tablesError;

        appData.services = servicesData || [];
        appData.tabelas = (tablesData || []).reduce((acc, table) => {
            acc[table.name] = { modificador: table.modifier };
            return acc;
        }, {});
    }

    // --- FUNÇÃO CORRIGIDA/ADICIONADA ---
    function populatePriceTables() {
        priceTableSelect.innerHTML = Object.keys(appData.tabelas)
            .map(name => `<option value="${name}">${name}</option>`)
            .join('');

        if (priceTableSelect.options.length > 0) {
            quote.general.priceTable = priceTableSelect.value;
        }
    }

    // --- LÓGICA DE RENDERIZAÇÃO ---
    function render() {
        renderDateManager();
        renderQuoteTable();
        calculateTotal();
    }
    
    function renderDateManager() {
        const container = document.getElementById('event-dates-container');
        container.innerHTML = '';
        quote.general.dates.forEach((dateObj, index) => {
            const div = document.createElement('div');
            div.className = 'date-entry';
            div.innerHTML = `
                <input type="date" value="${dateObj.date}" data-index="${index}" data-field="date">
                <input type="time" value="${dateObj.startTime}" data-index="${index}" data-field="startTime" title="Horário de Início">
                <input type="time" value="${dateObj.endTime}" data-index="${index}" data-field="endTime" title="Horário de Término">
                <button class="btn-icon" data-action="removeDate" data-index="${index}">&times;</button>
            `;
            container.appendChild(div);
        });
    }

    function renderQuoteTable() {
        quoteTableBody.innerHTML = '';
        const prices = getCalculatedPrices();
        
        quote.items.forEach((item, index) => {
            const service = appData.services.find(s => s.id === item.id);
            if (!service) return;

            const unitPrice = prices[item.id] || 0;
            const isPerPerson = service.unit === 'por_pessoa';
            const quantity = isPerPerson ? quote.general.guestCount : item.quantity;
            const total = unitPrice * quantity;
            const dateOptions = quote.general.dates.map((d, i) => `<option value="${d.date}" ${d.date === item.assignedDate ? 'selected' : ''}>Data ${i + 1} (${d.date || 'N/D'})</option>`).join('');

            const row = document.createElement('tr');
            row.dataset.index = index;
            row.innerHTML = `
                <td><span class="category-badge">${service.category}</span></td>
                <td>${service.name}</td>
                <td><select data-field="assignedDate"><option value="">Selecione</option>${dateOptions}</select></td>
                <td><input type="number" value="${quantity}" min="1" ${isPerPerson ? 'disabled' : ''} data-field="quantity"></td>
                <td>R$ ${unitPrice.toFixed(2)}</td>
                <td>R$ ${total.toFixed(2)}</td>
                <td class="item-actions">
                    <button class="btn-icon" data-action="toggleObs" title="Observações">💬</button>
                    <button class="btn-icon" data-action="duplicate" title="Duplicar Item">📋</button>
                    <button class="btn-icon" data-action="remove" title="Remover Item">&times;</button>
                </td>
            `;
            quoteTableBody.appendChild(row);

            if (item.showObs) {
                const obsRow = document.createElement('tr');
                obsRow.className = 'observations-row';
                obsRow.innerHTML = `<td colspan="7"><textarea data-field="observacoes" placeholder="Adicione observações para este item...">${item.observacoes || ''}</textarea></td>`;
                quoteTableBody.appendChild(obsRow);
            }
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
            quote.general.dates.push({ date: new Date().toISOString().split('T')[0], startTime: '19:00', endTime: '23:00' });
            render();
        });
        
        serviceSearchInput.addEventListener('keyup', handleServiceSearch);
        serviceSearchInput.addEventListener('focus', handleServiceSearch);
        document.addEventListener('click', (e) => {
            if (!searchResultsContainer.contains(e.target) && e.target !== serviceSearchInput) {
                searchResultsContainer.style.display = 'none';
            }
        });

        document.body.addEventListener('change', e => {
            const { index, field } = e.target.dataset;
            const targetId = e.target.id;

            if (index && field) { // Para itens da tabela
                updateItem(index, field, e.target.value);
            } else if (targetId === 'guestCount' || targetId === 'priceTableSelect' || targetId === 'discountValue') {
                const key = targetId.replace('Value', '');
                quote.general[key] = e.target.value;
                render();
            } else { // Para datas
                const dateEntry = e.target.closest('.date-entry');
                if (dateEntry && index && field) {
                    updateDate(index, field, e.target.value);
                }
            }
        });

        document.body.addEventListener('click', e => {
            const button = e.target.closest('button');
            if (!button) return;
            const { action, index } = button.dataset;
            if (action === 'removeDate') removeDate(index);
            if (action === 'toggleObs') toggleObs(index);
            if (action === 'duplicate') duplicateItem(index);
            if (action === 'remove') removeItem(index);
        });
    }
    
    // --- LÓGICA DO DROPDOWN DE BUSCA ---
    function handleServiceSearch(e) {
        const searchTerm = e.target.value.toLowerCase();
        searchResultsContainer.style.display = 'none';
        if (searchTerm.length < 1) return;
        
        const filteredServices = appData.services.filter(s => s.name.toLowerCase().includes(searchTerm));
        searchResultsContainer.innerHTML = '';
        if (filteredServices.length > 0) {
            filteredServices.forEach(service => {
                const itemDiv = document.createElement('div');
                itemDiv.className = 'search-result-item';
                itemDiv.textContent = `${service.name} (${service.category})`;
                itemDiv.onclick = () => {
                    quote.items.push({ id: service.id, quantity: 1, assignedDate: '', observacoes: '' });
                    serviceSearchInput.value = '';
                    searchResultsContainer.style.display = 'none';
                    render();
                };
                searchResultsContainer.appendChild(itemDiv);
            });
            searchResultsContainer.style.display = 'block';
        }
    }
    
    // --- FUNÇÕES DE MANIPULAÇÃO DO ORÇAMENTO ---
    function updateItem(index, key, value) { quote.items[parseInt(index)][key] = (key === 'quantity') ? parseInt(value) : value; render(); }
    function removeItem(index) { quote.items.splice(parseInt(index), 1); render(); }
    function duplicateItem(index) { const item = quote.items[parseInt(index)]; if(item) quote.items.splice(parseInt(index) + 1, 0, JSON.parse(JSON.stringify(item))); render(); }
    function toggleObs(index) { const item = quote.items[parseInt(index)]; if(item) item.showObs = !item.showObs; render(); }
    function updateDate(index, field, value) { const date = quote.general.dates[parseInt(index)]; if (date) date[field] = value; render(); }
    function removeDate(index) { quote.general.dates.splice(parseInt(index), 1); render(); }

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
