import { supabase } from './supabase-client.js';

document.addEventListener('DOMContentLoaded', () => {
    let appData = { services: [], tabelas: {} };
    let quote = { id: null, general: { clientName: '', clientCnpj: '', clientEmail: '', clientPhone: '', guestCount: 100, priceTable: '', discount: 0, dates: [] }, items: [] };
    const CATEGORY_ORDER = ['Espaço', 'Gastronomia', 'Equipamentos', 'Serviços / Outros'];
    let isDirty = false;

    const priceTableSelect = document.getElementById('priceTableSelect');
    const discountInput = document.getElementById('discountValue');
    const addDateBtn = document.getElementById('add-date-btn');
    const quoteCategoriesContainer = document.getElementById('quote-categories-container');
    const generalDataFields = ['clientName', 'clientCnpj', 'clientEmail', 'clientPhone', 'guestCount'];
    const saveBtn = document.getElementById('save-quote-btn');
    const printBtn = document.getElementById('print-btn');
    const notification = document.getElementById('save-notification');

    async function initialize() {
        try {
            await loadDataFromSupabase();
            populatePriceTables();
            addEventListeners();
            await loadQuoteFromURL();
            render();
        } catch (error) {
            console.error("Falha crítica na inicialização:", error);
            alert("Não foi possível carregar os dados.");
        }
    }

    async function loadDataFromSupabase() { /* ... */ }
    function populatePriceTables() { /* ... */ }

    function render() {
        renderGeneralData();
        renderDateManager();
        renderQuoteCategories();
        calculateTotal();
        setupMultiselects();
        setDirty(isDirty); // Atualiza o estado visual do botão Salvar
    }

    function renderGeneralData() { /* ... */ }
    function renderDateManager() { /* ... */ }

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
        let categorySubtotal = 0;
        
        items.forEach(item => {
            const itemIndex = quote.items.indexOf(item);
            const service = appData.services.find(s => s.id === item.id);
            const unitPrice = prices[item.id] || 0;
            const quantity = item.quantity || 1;
            const itemDiscount = item.discount_percent || 0;
            const total = (unitPrice * quantity) * (1 - itemDiscount / 100);
            categorySubtotal += total;

            const dateOptions = quote.general.dates.map((d, i) => `<option value="${d.date}" ${d.date === item.assignedDate ? 'selected' : ''}>Data ${i + 1} (${formatDateBR(d.date) || 'N/D'})</option>`).join('');

            const row = document.createElement('tr');
            row.dataset.index = itemIndex;
            row.innerHTML = `
                <td>${service.name} <div class="print-only print-item-obs">${item.observacoes || ''}</div></td>
                <td><select data-field="assignedDate"><option value="">Selecione</option>${dateOptions}</select></td>
                <td><input type="number" value="${quantity}" min="1" data-field="quantity"></td>
                <td>R$ ${unitPrice.toFixed(2)}</td>
                <td><input type="number" value="${itemDiscount}" min="0" max="100" data-field="discount_percent"></td>
                <td>R$ ${total.toFixed(2)}</td>
                <td class="item-actions">
                    <button class="btn-icon" data-action="duplicate" data-index="${itemIndex}" title="Duplicar">📋</button>
                    <button class="btn-icon" data-action="remove" data-index="${itemIndex}" title="Remover">&times;</button>
                </td>
            `;
            tableBody.appendChild(row);
        });

        if (items.length > 0) {
            const subtotalRow = document.createElement('tr');
            subtotalRow.className = 'category-subtotal';
            subtotalRow.innerHTML = `<td colspan="5">Subtotal ${category}</td><td>R$ ${categorySubtotal.toFixed(2)}</td><td></td>`;
            tableBody.appendChild(subtotalRow);
        }
    }

    function calculateTotal() { /* ... (lógica de cálculo com desconto por item) ... */ }

    function addEventListeners() {
        addDateBtn.addEventListener('click', () => {
            quote.general.dates.push({ date: new Date().toISOString().split('T')[0], startTime: '19:00', endTime: '23:00', observations: '' });
            setDirty(true);
            render();
        });
        
        generalDataFields.forEach(id => document.getElementById(id)?.addEventListener('input', () => setDirty(true)));
        priceTableSelect.addEventListener('change', () => { setDirty(true); render(); });
        discountInput.addEventListener('input', () => { setDirty(true); calculateTotal(); });

        if (printBtn) printBtn.addEventListener('click', generatePrintableQuote);
        if (saveBtn) saveBtn.addEventListener('click', saveQuoteToSupabase);
        
        document.body.addEventListener('change', e => {
            const { index, field } = e.target.dataset;
            if (index && field) {
                if (e.target.closest('.date-entry')) updateDate(index, field, e.target.value);
                else if (e.target.closest('tr')) updateItem(index, field, e.target.value);
            }
        });
        document.body.addEventListener('click', e => {
            const button = e.target.closest('button');
            if (button) {
                const { action, index } = button.dataset;
                if (action === 'removeDate') removeDate(index);
                if (action === 'duplicate') duplicateItem(index);
                if (action === 'remove') removeItem(index);
            }
        });
    }
    
    function setupMultiselects() { /* ... (sem alterações) ... */ }
    
    async function saveQuoteToSupabase() { /* ... (lógica de salvar com setDirty(false) no sucesso) ... */ }
    async function loadQuoteFromURL() { /* ... (lógica de carregar da URL) ... */ }
    function generatePrintableQuote() { /* ... (lógica de impressão) ... */ }
    
    function updateItem(index, key, value) { /* ... setDirty(true); render(); */ }
    function removeItem(index) { /* ... setDirty(true); render(); */ }
    function duplicateItem(index) { /* ... setDirty(true); render(); */ }
    function updateDate(index, field, value) { /* ... setDirty(true); render(); */ }
    function removeDate(index) { /* ... setDirty(true); render(); */ }
    
    function setDirty(state) {
        isDirty = state;
        if (saveBtn) {
            if (isDirty) {
                saveBtn.classList.add('dirty');
                saveBtn.textContent = 'Salvar Alterações';
            } else {
                saveBtn.classList.remove('dirty');
                saveBtn.textContent = 'Salvo';
            }
        }
    }
    
    function showNotification(message, isError = false) { /* ... */ }

    // --- FUNÇÕES AUXILIARES ---
    function getCalculatedPrices() { /* ... */ }
    function groupItemsByCategory() { /* ... */ }
    function formatDateBR(dateString) { /* ... */ }
    
    initialize();
});
