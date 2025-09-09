import { supabase } from './supabase-client.js';

document.addEventListener('DOMContentLoaded', () => {
    // ESTADO DA APLICAÇÃO
    let appData = { services: [], tabelas: {}, prices: {} };
    let quote = {
        id: null,
        general: { clientName: '', clientCnpj: '', clientEmail: '', clientPhone: '', guestCount: 100, priceTable: '', discount: 0, dates: [] },
        items: []
    };
    const CATEGORY_ORDER = ['Espaço', 'Gastronomia', 'Equipamentos', 'Serviços / Outros'];
    let isDirty = false;
    let currentItemIndex = null;

    // ELEMENTOS DO DOM
    const priceTableSelect = document.getElementById('priceTableSelect');
    const discountInput = document.getElementById('discountValue');
    const addDateBtn = document.getElementById('add-date-btn');
    const quoteCategoriesContainer = document.getElementById('quote-categories-container');
    const generalDataFields = ['clientName', 'clientCnpj', 'clientEmail', 'clientPhone', 'guestCount'];
    const saveBtn = document.getElementById('save-quote-btn');
    const printBtn = document.getElementById('print-btn');
    const notification = document.getElementById('save-notification');
    const clientCnpjInput = document.getElementById('clientCnpj');
    const obsPopover = document.getElementById('obs-popover');

    // --- INICIALIZAÇÃO ---
    async function initialize() {
        try {
            await loadDataFromSupabase();
            populatePriceTables();
            addEventListeners();
            await loadQuoteFromURL();
            render();
        } catch (error) {
            console.error("Falha crítica na inicialização:", error);
            alert("Não foi possível carregar os dados. Verifique o console para mais detalhes.");
        }
    }

    async function loadDataFromSupabase() {
        const { data: servicesData, error: servicesError } = await supabase.from('services').select('*');
        if (servicesError) throw servicesError;
        const { data: tablesData, error: tablesError } = await supabase.from('price_tables').select('*');
        if (tablesError) throw tablesError;
        const { data: pricesData, error: pricesError } = await supabase.from('service_prices').select('*');
        if (pricesError) throw pricesError;

        appData.services = servicesData || [];
        // Armazena nome e valor da consumação para cada tabela
        appData.tabelas = (tablesData || []).reduce((acc, table) => {
            acc[table.id] = { 
                name: table.name,
                consumable_credit: table.consumable_credit || 0 
            };
            return acc;
        }, {});
        appData.prices = (pricesData || []).reduce((acc, p) => {
            if (!acc[p.price_table_id]) acc[p.price_table_id] = {};
            acc[p.price_table_id][p.service_id] = p.price;
            return acc;
        }, {});
    }
    
    function populatePriceTables() {
        if (!priceTableSelect) return;
        priceTableSelect.innerHTML = Object.entries(appData.tabelas)
            .map(([id, table]) => `<option value="${id}">${table.name}</option>`)
            .join('');
        if (priceTableSelect.options.length > 0 && !quote.general.priceTable) {
            quote.general.priceTable = priceTableSelect.value;
        }
    }

    // --- LÓGICA DE RENDERIZAÇÃO ---
    function render() {
        renderGeneralData();
        renderDateManager();
        renderQuoteCategories();
        calculateTotal();
        setupMultiselects();
        setDirty(isDirty);
    }

    function renderGeneralData() {
        generalDataFields.forEach(fieldId => {
            const element = document.getElementById(fieldId);
            if(element) element.value = quote.general[fieldId] || '';
        });
        if (priceTableSelect) priceTableSelect.value = quote.general.priceTable;
        if (discountInput) discountInput.value = quote.general.discount;
    }
    
    function renderDateManager() {
        const container = document.getElementById('event-dates-container');
        if (!container) return;
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
        if (!quoteCategoriesContainer) return;

        const openCategories = new Set();
        quoteCategoriesContainer.querySelectorAll('details[open]').forEach(details => {
            openCategories.add(details.dataset.category);
        });

        quoteCategoriesContainer.innerHTML = '';
        const template = document.getElementById('category-template');
        if (!template) return;
        
        const groupedItems = groupItemsByCategory();

        CATEGORY_ORDER.forEach(categoryName => {
            const clone = template.content.cloneNode(true);
            const accordion = clone.querySelector('.category-accordion');
            if (!accordion) return;
            
            accordion.dataset.category = categoryName;
            accordion.querySelector('.category-title').textContent = categoryName;
            
            if (openCategories.has(categoryName)) {
                accordion.open = true;
            }
            
            const tableBody = clone.querySelector('tbody');
            renderTableForCategory(tableBody, categoryName, groupedItems[categoryName] || []);

            quoteCategoriesContainer.appendChild(clone);
        });
    }

    function renderTableForCategory(tableBody, category, items) {
        if (!tableBody) return;
        tableBody.innerHTML = '';
        const prices = getCalculatedPrices();
        let categorySubtotal = 0;
        
        items.forEach(item => {
            const itemIndex = quote.items.indexOf(item);
            const service = appData.services.find(s => s.id === item.id);
            if (!service) return;

            const unitPrice = prices[item.id] || 0;
            const quantity = item.quantity || 1;
            const itemDiscount = item.discount_percent || 0;
            const total = (unitPrice * quantity) * (1 - itemDiscount / 100);
            categorySubtotal += total;

            const dateOptions = quote.general.dates.map((d, i) => `<option value="${d.date}" ${d.date === item.assignedDate ? 'selected' : ''}>Data ${i + 1} (${formatDateBR(d.date) || 'N/D'})</option>`).join('');

            const row = document.createElement('tr');
            row.dataset.index = itemIndex;
            row.innerHTML = `
                <td>${service.name}</td>
                <td><select data-field="assignedDate"><option value="">Selecione</option>${dateOptions}</select></td>
                <td><input type="number" value="${quantity}" min="1" data-field="quantity"></td>
                <td>R$ ${unitPrice.toFixed(2)}</td>
                <td><input type="number" value="${itemDiscount}" min="0" max="100" data-field="discount_percent"></td>
                <td>R$ ${total.toFixed(2)}</td>
                <td class="item-actions">
                    <button class="btn-icon" data-action="showObs" data-index="${itemIndex}" title="Observações">💬</button>
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

    function calculateTotal() {
        const prices = getCalculatedPrices();
        let subtotal = 0;
        let consumableSubtotal = 0; // Subtotal apenas para categorias de consumação

        // 1. Itera sobre os itens para calcular os subtotais
        quote.items.forEach(item => {
            const service = appData.services.find(s => s.id === item.id);
            if (!service) return;

            const unitPrice = prices[item.id] || 0;
            const quantity = item.quantity || 1;
            const itemDiscount = item.discount_percent || 0;
            const itemTotal = (unitPrice * quantity) * (1 - itemDiscount / 100);
            
            subtotal += itemTotal;

            // 2. Acumula o valor se a categoria for Gastronomia ou Equipamentos
            if (service.category === 'Gastronomia' || service.category === 'Equipamentos') {
                consumableSubtotal += itemTotal;
            }
        });

        // 3. Pega o crédito de consumação da tabela de preços selecionada
        const selectedTableId = priceTableSelect.value;
        const consumableCredit = appData.tabelas[selectedTableId]?.consumable_credit || 0;

        // 4. Calcula a dedução real (o menor valor entre o crédito e o subtotal das categorias)
        const consumableDeduction = Math.min(consumableCredit, consumableSubtotal);

        // 5. Calcula o total final
        const generalDiscount = parseFloat(discountInput.value) || 0;
        const total = subtotal - consumableDeduction - generalDiscount;

        // 6. Atualiza a interface
        document.getElementById('subtotalValue').textContent = `R$ ${subtotal.toFixed(2)}`;
        document.getElementById('consumableValue').textContent = `- R$ ${consumableDeduction.toFixed(2)}`;
        document.getElementById('totalValue').textContent = `R$ ${total.toFixed(2)}`;
    }

    function addEventListeners() {
        if (addDateBtn) addDateBtn.addEventListener('click', () => {
            quote.general.dates.push({ date: new Date().toISOString().split('T')[0], startTime: '19:00', endTime: '23:00', observations: '' });
            setDirty(true);
            render();
        });
        
        generalDataFields.forEach(id => document.getElementById(id)?.addEventListener('input', e => { quote.general[id] = e.target.value; setDirty(true); }));
        if (priceTableSelect) priceTableSelect.addEventListener('change', e => { quote.general.priceTable = e.target.value; setDirty(true); render(); });
        if (discountInput) discountInput.addEventListener('input', e => { quote.general.discount = parseFloat(e.target.value) || 0; setDirty(true); calculateTotal(); });

        if (printBtn) printBtn.addEventListener('click', generatePrintableQuote);
        if (saveBtn) saveBtn.addEventListener('click', saveQuoteToSupabase);
        if (clientCnpjInput) clientCnpjInput.addEventListener('input', handleCnpjMask);
        
        document.body.addEventListener('change', e => {
            const { index, field } = e.target.dataset;
            if (index && field) {
                if (e.target.closest('.date-entry')) updateDate(index, field, e.target.value);
                else if (e.target.closest('tr')) updateItem(index, field, e.target.value);
            }
        });
        
        document.body.addEventListener('click', e => {
            const target = e.target.closest('button, .multiselect-input, summary');
            if (!target) { closeAllPopups(); return; }

            if (target.matches('.multiselect-input')) {
                e.preventDefault(); 
                e.stopPropagation();
                
                const container = target.closest('.multiselect-container');
                const wasOpen = container.classList.contains('open');
                document.querySelectorAll('.multiselect-container.open').forEach(c => c.classList.remove('open'));
                if (!wasOpen) container.classList.add('open');
                return;
            }

            const actionButton = e.target.closest('button[data-action]');
            if (actionButton) {
                 e.stopPropagation(); 
            }

            const { action, index } = target.dataset;
            if (action === 'removeDate') removeDate(index);
            if (action === 'duplicate') duplicateItem(index);
            if (action === 'remove') removeItem(index);
            if (action === 'showObs') { openObsPopover(index, target); }
        });
    }
    
    function setupMultiselects() {
        document.querySelectorAll('.multiselect-container').forEach(container => {
            const list = container.querySelector('.multiselect-list');
            const addButton = container.querySelector('.btn-add-selected');
            const searchInput = container.querySelector('.multiselect-search');
            const category = container.closest('.category-accordion, .category-block')?.dataset.category;
            if (!category) return;

            list.innerHTML = '';
            const servicesForCategory = appData.services.filter(s => s.category === category);
            
            servicesForCategory.forEach(service => {
                const itemDiv = document.createElement('div');
                itemDiv.className = 'multiselect-list-item';
                itemDiv.innerHTML = `<label><input type="checkbox" value="${service.id}"> ${service.name}</label>`;
                list.appendChild(itemDiv);
            });
            
            searchInput.addEventListener('input', () => {
                const searchTerm = searchInput.value.toLowerCase();
                list.querySelectorAll('.multiselect-list-item').forEach(item => {
                    const label = item.querySelector
