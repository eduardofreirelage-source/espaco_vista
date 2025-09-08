import { supabase } from './supabase-client.js';

document.addEventListener('DOMContentLoaded', () => {
    let appData = { services: [], tabelas: {} };
    let quote = {
        general: { guestCount: 100, priceTable: '', discount: 0, dates: [] },
        items: []
    };
    const CATEGORY_ORDER = ['Espaço', 'Gastronomia', 'Equipamentos', 'Serviços / Outros'];

    // --- ELEMENTOS DO DOM ---
    const guestCountInput = document.getElementById('guestCount');
    const priceTableSelect = document.getElementById('priceTableSelect');
    const discountInput = document.getElementById('discountValue');
    const addDateBtn = document.getElementById('add-date-btn');
    const quoteTableBody = document.getElementById('quote-table-body');
    const toolbarCategorySelect = document.getElementById('toolbar-category-select');
    const toolbarMultiselect = document.getElementById('toolbar-multiselect');
    const toolbarDateTargetSelect = document.getElementById('toolbar-date-target-select');
    const toolbarAddBtn = document.getElementById('toolbar-add-btn');

    // --- INICIALIZAÇÃO ---
    async function initialize() {
        try {
            await loadDataFromSupabase();
            populatePriceTables();
            addEventListeners();
            render();
            populateToolbarMultiselect();
        } catch (error) {
            console.error("Falha crítica na inicialização:", error);
            alert("Não foi possível carregar os dados.");
        }
    }

    // --- LÓGICA DE CARREGAMENTO E RENDERIZAÇÃO ---
    async function loadDataFromSupabase() { /* ... (sem alterações) ... */ }
    function populatePriceTables() { /* ... (sem alterações) ... */ }

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
                <input type="time" value="${dateObj.startTime}" data-index="${index}" data-field="startTime">
                <input type="time" value="${dateObj.endTime}" data-index="${index}" data-field="endTime">
                <input type="text" placeholder="Observações..." value="${dateObj.observations || ''}" data-index="${index}" data-field="observations">
                <button class="btn-icon" data-action="removeDate" data-index="${index}">&times;</button>
            `;
            container.appendChild(div);
        });
        // Atualiza o dropdown de datas na toolbar
        toolbarDateTargetSelect.innerHTML = quote.general.dates.map((d, i) => `<option value="${d.date}">Data ${i + 1} (${d.date || 'N/D'})</option>`).join('');
    }

    function renderQuoteTable() {
        quoteTableBody.innerHTML = '';
        const prices = getCalculatedPrices();
        const groupedItems = groupItemsByCategory();

        CATEGORY_ORDER.forEach(category => {
            if (!groupedItems[category] || groupedItems[category].length === 0) return;

            const headerRow = document.createElement('tr');
            headerRow.className = 'category-subheader';
            headerRow.innerHTML = `<td colspan="6">${category}</td>`;
            quoteTableBody.appendChild(headerRow);
            
            let categorySubtotal = 0;

            groupedItems[category].forEach(item => {
                const itemIndex = quote.items.indexOf(item);
                const service = appData.services.find(s => s.id === item.id);
                const unitPrice = prices[item.id] || 0;
                const isPerPerson = service.unit === 'por_pessoa';
                const quantity = isPerPerson ? quote.general.guestCount : item.quantity;
                const total = unitPrice * quantity;
                categorySubtotal += total;

                const row = document.createElement('tr');
                row.dataset.index = itemIndex;
                row.innerHTML = `
                    <td>${service.name}</td>
                    <td><input type="number" value="${quantity}" min="1" ${isPerPerson ? 'disabled' : ''} data-field="quantity"></td>
                    <td>R$ ${unitPrice.toFixed(2)}</td>
                    <td>R$ ${total.toFixed(2)}</td>
                    <td class="item-actions">
                        <button class="btn-icon" data-action="toggleObs" title="Observações">💬</button>
                        <button class="btn-icon" data-action="duplicate" title="Duplicar">📋</button>
                        <button class="btn-icon" data-action="remove" title="Remover">&times;</button>
                    </td>
                `;
                quoteTableBody.appendChild(row);
                
                // ... Lógica para renderizar a linha de observações se item.showObs for true
            });

            const subtotalRow = document.createElement('tr');
            subtotalRow.className = 'category-subtotal';
            subtotalRow.innerHTML = `<td colspan="3">Subtotal ${category}</td><td>R$ ${categorySubtotal.toFixed(2)}</td><td></td>`;
            quoteTableBody.appendChild(subtotalRow);
        });
    }
    
    // --- LÓGICA DA NOVA TOOLBAR ---
    function populateToolbarMultiselect() {
        const category = toolbarCategorySelect.value;
        const list = toolbarMultiselect.querySelector('.multiselect-list');
        list.innerHTML = '';
        appData.services
            .filter(s => s.category === category)
            .forEach(service => {
                list.innerHTML += `<div class="multiselect-list-item"><label><input type="checkbox" value="${service.id}"> ${service.name}</label></div>`;
            });
    }

    // --- MANIPULADORES DE EVENTOS ---
    function addEventListeners() {
        addDateBtn.addEventListener('click', () => { /* ... */ });
        toolbarCategorySelect.addEventListener('change', populateToolbarMultiselect);
        toolbarMultiselect.querySelector('.multiselect-input').addEventListener('click', () => {
            toolbarMultiselect.classList.toggle('open');
        });

        toolbarAddBtn.addEventListener('click', () => {
            const selectedDate = toolbarDateTargetSelect.value;
            const selectedItems = toolbarMultiselect.querySelectorAll('input:checked');
            if (!selectedDate && quote.general.dates.length > 0) {
                alert('Por favor, selecione uma data de destino.');
                return;
            }
            selectedItems.forEach(checkbox => {
                quote.items.push({ id: checkbox.value, quantity: 1, assignedDate: selectedDate, observacoes: '' });
                checkbox.checked = false;
            });
            toolbarMultiselect.classList.remove('open');
            render();
        });
        
        // ... (outros listeners principais e delegação de eventos)
    }

    // ... (restante do código: calculateTotal, funções de manipulação de item, helpers, etc.)
    initialize();
});
