import { supabase } from './supabase-client.js';

document.addEventListener('DOMContentLoaded', () => {
    // ESTADO DA APLICAÇÃO
    let appData = { services: [], tabelas: {} };
    let quote = {
        general: { guestCount: 100, priceTable: '', discount: 0, dates: [] },
        items: []
    };
    const CATEGORY_ORDER = ['Espaço', 'Gastronomia', 'Equipamentos', 'Serviços / Outros'];

    // ELEMENTOS DO DOM
    const guestCountInput = document.getElementById('guestCount');
    const priceTableSelect = document.getElementById('priceTableSelect');
    const discountInput = document.getElementById('discountValue');
    const addDateBtn = document.getElementById('add-date-btn');
    const quoteCategoriesContainer = document.getElementById('quote-categories-container');
    const saveBtn = document.getElementById('save-quote-btn');
    const loadBtn = document.getElementById('load-quote-btn');
    const printBtn = document.getElementById('print-btn');

    // --- INICIALIZAÇÃO ---
    async function initialize() {
        try {
            await loadDataFromSupabase();
            populatePriceTables();
            addEventListeners();
            render();
        } catch (error) {
            console.error("Falha crítica na inicialização:", error);
            alert("Não foi possível carregar os dados.");
        }
    }

    // --- CARREGAMENTO DE DADOS ---
    async function loadDataFromSupabase() { /* ... (sem alterações) ... */ }
    function populatePriceTables() { /* ... (sem alterações) ... */ }

    // --- LÓGICA DE RENDERIZAÇÃO ---
    function render() {
        renderDateManager();
        renderQuoteCategories();
        calculateTotal();
        setupMultiselects();
    }
    
    function renderDateManager() { /* ... (sem alterações) ... */ }

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
            
            const totalBeforeDiscount = unitPrice * quantity;
            const discountAmount = totalBeforeDiscount * (itemDiscount / 100);
            const total = totalBeforeDiscount - discountAmount;
            categorySubtotal += total;

            const dateOptions = quote.general.dates.map((d, i) => `<option value="${d.date}" ${d.date === item.assignedDate ? 'selected' : ''}>Data ${i + 1} (${formatDateBR(d.date) || 'N/D'})</option>`).join('');

            const row = document.createElement('tr');
            row.dataset.index = itemIndex;
            row.innerHTML = `
                <td>${service.name}</td>
                <td><select data-field="assignedDate"><option value="">Selecione</option>${dateOptions}</select></td>
                <td><input type="number" value="${quantity}" min="1" data-field="quantity"></td>
                <td>R$ ${unitPrice.toFixed(2)}</td>
                <td>R$ ${total.toFixed(2)}</td>
                <td class="item-actions">
                    <button class="btn-icon" data-action="toggleObs" title="Detalhes">💬</button>
                    <button class="btn-icon" data-action="duplicate" title="Duplicar">📋</button>
                    <button class="btn-icon" data-action="remove" title="Remover">&times;</button>
                </td>
            `;
            tableBody.appendChild(row);

            if (item.showObs) {
                const obsRow = document.createElement('tr');
                obsRow.className = 'observations-row';
                obsRow.innerHTML = `<td colspan="6">
                    <div class="form-grid" style="padding: 0.5rem 0;">
                        <div class="form-group">
                            <label>Observações</label>
                            <textarea data-field="observacoes" rows="2">${item.observacoes || ''}</textarea>
                        </div>
                        <div class="form-group">
                            <label>Desconto do Item (%)</label>
                            <input type="number" min="0" max="100" value="${itemDiscount}" data-field="discount_percent">
                        </div>
                    </div>
                </td>`;
                tableBody.appendChild(obsRow);
            }
        });

        if (items.length > 0) {
            const subtotalRow = document.createElement('tr');
            subtotalRow.className = 'category-subtotal';
            subtotalRow.innerHTML = `<td colspan="4">Subtotal ${category}</td><td>R$ ${categorySubtotal.toFixed(2)}</td><td></td>`;
            tableBody.appendChild(subtotalRow);
        }
    }

    // --- LÓGICA DE CÁLCULO ---
    function calculateTotal() {
        const prices = getCalculatedPrices();
        let subtotal = 0;

        quote.items.forEach(item => {
            const service = appData.services.find(s => s.id === item.id);
            if (!service) return;
            const unitPrice = prices[item.id] || 0;
            const quantity = (item.quantity || 1);
            const itemDiscount = item.discount_percent || 0;
            const totalBeforeDiscount = unitPrice * quantity;
            const discountAmount = totalBeforeDiscount * (itemDiscount / 100);
            subtotal += totalBeforeDiscount - discountAmount;
        });
        
        const discount = parseFloat(discountInput.value) || 0;
        const total = subtotal - discount;

        document.getElementById('subtotalValue').textContent = `R$ ${subtotal.toFixed(2)}`;
        document.getElementById('totalValue').textContent = `R$ ${total.toFixed(2)}`;
    }

    // --- MANIPULADORES DE EVENTOS ---
    function addEventListeners() {
        addDateBtn.addEventListener('click', () => { /* ... */ });
        guestCountInput.addEventListener('input', e => { /* ... */ });
        priceTableSelect.addEventListener('change', e => { /* ... */ });
        discountInput.addEventListener('input', calculateTotal);

        printBtn.addEventListener('click', () => window.print());
        saveBtn.addEventListener('click', saveQuote);
        loadBtn.addEventListener('click', loadQuote);
        
        document.body.addEventListener('change', e => { /* ... */ });
        document.body.addEventListener('click', e => { /* ... */ });
    }
    
    // --- LÓGICA DO MENU MULTISELECT ---
    function setupMultiselects() { /* ... (sem alterações) ... */ }
    
    // --- NOVAS FUNÇÕES: SALVAR E CARREGAR ---
    function saveQuote() {
        localStorage.setItem('savedQuote', JSON.stringify(quote));
        alert('Cotação salva com sucesso no seu navegador!');
    }
    
    function loadQuote() {
        const savedData = localStorage.getItem('savedQuote');
        if (savedData) {
            if (confirm('Isso irá substituir a cotação atual. Deseja continuar?')) {
                quote = JSON.parse(savedData);
                // Atualiza os inputs principais
                guestCountInput.value = quote.general.guestCount;
                priceTableSelect.value = quote.general.priceTable;
                discountInput.value = quote.general.discount;
                render();
            }
        } else {
            alert('Nenhuma cotação salva foi encontrada.');
        }
    }

    // --- FUNÇÕES DE MANIPULAÇÃO DO ORÇAMENTO E AUXILIARES ---
    function updateItem(index, key, value) { const item = quote.items[parseInt(index)]; if(item) item[key] = (key === 'quantity' || key === 'discount_percent') ? parseFloat(value) : value; render(); }
    function formatDateBR(dateString) { if (!dateString) return null; const [year, month, day] = dateString.split('-'); return `${day}/${month}/${year}`; }
    
    // ... (O restante das funções como removeItem, duplicateItem, etc., permanecem as mesmas)
    
    initialize();
});
