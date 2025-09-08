import { supabase } from './supabase-client.js';

document.addEventListener('DOMContentLoaded', () => {
    // --- ESTADO DA APLICAÇÃO ---
    let appData = { services: [], tabelas: {} };
    let quote = {
        general: { guestCount: 100, priceTable: '', discount: 0, dates: [] },
        items: []
    };

    // --- ORDEM FIXA DAS CATEGORIAS ---
    const CATEGORY_ORDER = ['Espaço', 'Gastronomia', 'Equipamentos', 'Serviços / Outros'];

    // --- ELEMENTOS DO DOM ---
    const guestCountInput = document.getElementById('guestCount');
    const priceTableSelect = document.getElementById('priceTableSelect');
    const discountInput = document.getElementById('discountValue');
    const addDateBtn = document.getElementById('add-date-btn');
    const quoteCategoriesContainer = document.getElementById('quote-categories-container');

    // --- INICIALIZAÇÃO ---
    async function initialize() {
        try {
            await loadDataFromSupabase();
            populatePriceTables();
            addEventListeners();
            render();
        } catch (error) {
            console.error("Falha crítica na inicialização:", error);
            alert("Não foi possível carregar os dados do banco de dados. Verifique sua conexão ou as configurações do Supabase e recarregue a página.");
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
        renderQuoteCategories();
        calculateTotal();
        setupMultiselects();
    }
    
    function renderDateManager() {
        const container = document.getElementById('event-dates-container');
        container.innerHTML = '';
        quote.general.dates.forEach((dateObj, index) => {
            const div = document.createElement('div');
            div.className = 'date-entry';
            div.innerHTML = `
                <input type="date" value="${dateObj.date}" data-index="${index}" data-field="date" title="Data">
                <input type="time" value="${dateObj.startTime}" data-index="${index}" data-field="startTime" title="Horário de Início">
                <input type="time" value="${dateObj.endTime}" data-index="${index}" data-field="endTime" title="Horário de Término">
                <input type="text" placeholder="Observações da data..." value="${dateObj.observations || ''}" data-index="${index}" data-field="observations">
                <button class="btn-icon" data-action="removeDate" data-index="${index}">&times;</button>
            `;
            container.appendChild(div);
        });
    }

    function renderQuoteCategories() {
        quoteCategoriesContainer.innerHTML = '';
        const template = document.getElementById('category-template');
        const groupedItems = groupItemsByCategory();

        CATEGORY_ORDER.forEach(categoryName => {
            const clone = template.content.cloneNode(true);
            const categoryBlock = clone.querySelector('.category-block');
            categoryBlock.dataset.category = categoryName;

            clone.querySelector('.category-title').textContent = categoryName;
            
            const tableBody = clone.querySelector('tbody');
            renderTableForCategory(tableBody, categoryName, groupedItems[categoryName] || []);

            quoteCategoriesContainer.appendChild(clone);
        });
    }

    function renderTableForCategory(tableBody, category, items) {
        tableBody.innerHTML = '';
        const prices = getCalculatedPrices();
        
        items.forEach(item => {
            const itemIndex = quote.items.indexOf(item);
            const service = appData.services.find(s => s.id === item.id);
            const unitPrice = prices[item.id] || 0;
            const isPerPerson = service.unit === 'por_pessoa';
            const quantity = isPerPerson ? quote.general.guestCount : item.quantity;
            const total = unitPrice * quantity;
            const dateOptions = quote.general.dates.map((d, i) => `<option value="${d.date}" ${d.date === item.assignedDate ? 'selected' : ''}>Data ${i + 1} (${d.date || 'N/D'})</option>`).join('');

            const row = document.createElement('tr');
            row.dataset.index = itemIndex;
            row.innerHTML = `
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
            tableBody.appendChild(row);

            if (item.showObs) {
                const obsRow = document.createElement('tr');
                obsRow.className = 'observations-row';
                obsRow.innerHTML = `<td colspan="7"><textarea data-field="observacoes" placeholder="Adicione observações para este item...">${item.observacoes || ''}</textarea></td>`;
                tableBody.appendChild(obsRow);
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
            quote.general.dates.push({ date: new Date().toISOString().split('T')[0], startTime: '19:00', endTime: '23:00', observations: '' });
            render();
        });
        
        guestCountInput.addEventListener('input', e => { quote.general.guestCount = parseInt(e.target.value) || 0; render(); });
        priceTableSelect.addEventListener('change', e => { quote.general.priceTable = e.target.value; render(); });
        discountInput.addEventListener('input', calculateTotal);
        
        document.body.addEventListener('change', e => {
            const { index, field } = e.target.dataset;
            if (index && field) {
                const dateEntry = e.target.closest('.date-entry');
                if (dateEntry) {
                    updateDate(index, field, e.target.value);
                } else {
                    updateItem(index, field, e.target.value);
                }
            }
        });

        document.body.addEventListener('click', e => {
            const button = e.target.closest('button, .multiselect-input');
            if (!button) return;
            const { action, index, category } = button.dataset;
            if (action === 'removeDate') removeDate(index);
            if (action === 'toggleObs') toggleObs(index);
            if (action === 'duplicate') duplicateItem(index);
            if (action === 'remove') removeItem(index);
        });
    }
    
    // --- LÓGICA DO MENU MULTISELECT ---
    function setupMultiselects() {
        document.querySelectorAll('.multiselect-container').forEach(container => {
            const input = container.querySelector('.multiselect-input');
            const dropdown = container.querySelector('.multiselect-dropdown');
            const list = container.querySelector('.multiselect-list');
            const addButton = container.querySelector('.btn-add-selected');
            const category = container.closest('.category-block').dataset.category;

            list.innerHTML = '';
            appData.services.filter(s => s.category === category).forEach(service => {
                list.innerHTML += `<div class="multiselect-list-item"><label><input type="checkbox" value="${service.id}"> ${service.name}</label></div>`;
            });

            input.onclick = () => container.classList.toggle('open');
            
            addButton.onclick = () => {
                const selected = list.querySelectorAll('input:checked');
                selected.forEach(checkbox => {
                    quote.items.push({ id: checkbox.value, quantity: 1, assignedDate: '', observacoes: '' });
                    checkbox.checked = false;
                });
                container.classList.remove('open');
                render();
            };
        });

        document.addEventListener('click', e => {
            if (!e.target.closest('.multiselect-container')) {
                document.querySelectorAll('.multiselect-container.open').forEach(c => c.classList.remove('open'));
            }
        });
    }
    
    // --- FUNÇÕES DE MANIPULAÇÃO DO ORÇAMENTO ---
    function updateItem(index, key, value) { const item = quote.items[parseInt(index)]; if(item) item[key] = (key === 'quantity') ? parseInt(value) : value; render(); }
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
    function groupItemsByCategory() {
        return quote.items.reduce((acc, item) => {
            const service = appData.services.find(s => s.id === item.id);
            if (service) (acc[service.category] = acc[service.category] || []).push(item);
            return acc;
        }, {});
    }
    
    initialize();
});
