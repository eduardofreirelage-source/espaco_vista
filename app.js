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
    const quoteTableBody = document.getElementById('quote-table-body');
    const serviceSearchInput = document.getElementById('service-search');
    const searchResultsContainer = document.getElementById('service-search-results');
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
        appData.tabelas = (tablesData || []).reduce((acc, table) => {
            acc[table.id] = { name: table.name };
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
        renderQuoteTable();
        calculateTotal();
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

    function renderQuoteTable() {
        if (!quoteTableBody) return;
        quoteTableBody.innerHTML = '';
        const prices = getCalculatedPrices();
        const groupedItems = groupItemsByCategory();

        CATEGORY_ORDER.forEach(category => {
            if (!groupedItems[category] || groupedItems[category].length === 0) return;

            const headerRow = document.createElement('tr');
            headerRow.className = 'category-subheader';
            headerRow.innerHTML = `<td colspan="7">${category}</td>`;
            quoteTableBody.appendChild(headerRow);
            
            let categorySubtotal = 0;

            groupedItems[category].forEach(item => {
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
                    <td><span class="category-badge">${service.category}</span> ${service.name}</td>
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

            const subtotalRow = document.createElement('tr');
            subtotalRow.className = 'category-subtotal';
            subtotalRow.innerHTML = `<td colspan="6">Subtotal ${category}</td><td>R$ ${categorySubtotal.toFixed(2)}</td>`;
            quoteTableBody.appendChild(subtotalRow);
        });
    }

    function calculateTotal() {
        const prices = getCalculatedPrices();
        let subtotal = 0;
        quote.items.forEach(item => {
            const service = appData.services.find(s => s.id === item.id);
            if (!service) return;
            const unitPrice = prices[item.id] || 0;
            const quantity = (item.quantity || 1);
            const itemDiscount = item.discount_percent || 0;
            subtotal += (unitPrice * quantity) * (1 - itemDiscount / 100);
        });
        const discount = parseFloat(discountInput.value) || 0;
        const total = subtotal - discount;
        document.getElementById('subtotalValue').textContent = `R$ ${subtotal.toFixed(2)}`;
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
        
        if(serviceSearchInput) {
            serviceSearchInput.addEventListener('keyup', handleServiceSearch);
            serviceSearchInput.addEventListener('focus', handleServiceSearch);
        }
        
        document.body.addEventListener('change', e => {
            const { index, field } = e.target.dataset;
            if (index && field) {
                if (e.target.closest('.date-entry')) updateDate(index, field, e.target.value);
                else if (e.target.closest('tr')) updateItem(index, field, e.target.value);
            }
        });
        document.body.addEventListener('click', e => {
            const target = e.target;
            if (!target.closest('.item-actions') && !target.closest('.date-entry') && !target.closest('.header-actions')) {
                 closeAllPopups();
            }
            const button = target.closest('button');
            if (button) {
                const { action, index } = button.dataset;
                if (action === 'removeDate') removeDate(index);
                if (action === 'duplicate') duplicateItem(index);
                if (action === 'remove') removeItem(index);
                if (action === 'showObs') { e.stopPropagation(); openObsPopover(index, button); }
            }
        });
    }
    
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
                    quote.items.push({ id: service.id, quantity: 1, assignedDate: '', observacoes: '', discount_percent: 0 });
                    serviceSearchInput.value = '';
                    searchResultsContainer.style.display = 'none';
                    setDirty(true);
                    render();
                };
                searchResultsContainer.appendChild(itemDiv);
            });
            searchResultsContainer.style.display = 'block';
        }
    }
    
    async function saveQuoteToSupabase() {
        const clientName = quote.general.clientName || 'Orçamento sem nome';
        const dataToSave = { client_name: clientName, quote_data: quote };
        let response;
        if (quote.id) {
            response = await supabase.from('quotes').update(dataToSave).eq('id', quote.id).select();
        } else {
            response = await supabase.from('quotes').insert([dataToSave]).select();
        }
        if (response.error) {
            console.error('Erro ao salvar no Supabase:', response.error);
            showNotification('Erro ao salvar o orçamento.', true);
        } else {
            if (response.data && response.data.length > 0) quote.id = response.data[0].id;
            setDirty(false);
            showNotification(`Orçamento para "${clientName}" salvo com sucesso!`);
        }
    }
    
    async function loadQuoteFromURL() {
        const params = new URLSearchParams(window.location.search);
        const quoteId = params.get('quote_id');
        if (quoteId) {
            window.history.replaceState({}, document.title, window.location.pathname);
            const { data, error } = await supabase.from('quotes').select('id, quote_data').eq('id', quoteId).single();
            if (error) {
                alert('Não foi possível carregar o orçamento solicitado.');
            } else {
                quote = data.quote_data;
                quote.id = data.id;
            }
        }
    }
    
    function generatePrintableQuote() {
        // ... (lógica de impressão)
    }
    
    function updateItem(index, key, value) { const item = quote.items[parseInt(index)]; if(item) { item[key] = (key === 'quantity' || key === 'discount_percent') ? parseFloat(value) || 0 : value; setDirty(true); render(); } }
    function removeItem(index) { quote.items.splice(parseInt(index), 1); setDirty(true); render(); }
    function duplicateItem(index) { const item = quote.items[parseInt(index)]; if(item) { quote.items.splice(parseInt(index) + 1, 0, JSON.parse(JSON.stringify(item))); setDirty(true); render(); } }
    function updateDate(index, field, value) { const date = quote.general.dates[parseInt(index)]; if (date) { date[field] = value; setDirty(true); render(); } }
    function removeDate(index) { quote.general.dates.splice(parseInt(index), 1); setDirty(true); render(); }
    
    function openObsPopover(index, button) {
        closeAllPopups();
        const item = quote.items[parseInt(index)];
        if (!item) return;
        
        obsPopover.innerHTML = `
            <div class="form-group">
                <label>Observações</label>
                <textarea id="popover-obs-textarea">${item.observacoes || ''}</textarea>
            </div>
            <button id="popover-save-btn" class="btn">Salvar</button>
        `;
        button.parentElement.appendChild(obsPopover);
        obsPopover.classList.add('show');

        document.getElementById('popover-save-btn').onclick = () => {
            const newObs = document.getElementById('popover-obs-textarea').value;
            updateItem(index, 'observacoes', newObs);
            closeAllPopups();
        };
    }

    function closeAllPopups() {
        if (obsPopover) obsPopover.classList.remove('show');
    }
    
    function getCalculatedPrices() {
        const tableId = priceTableSelect.value;
        const prices = {};
        if (appData.tabelas[tableId]) {
            appData.services.forEach(service => {
                prices[service.id] = appData.prices[tableId]?.[service.id] || 0;
            });
        }
        return prices;
    }

    function groupItemsByCategory() {
        return quote.items.reduce((acc, item) => {
            const service = appData.services.find(s => s.id === item.id);
            if (service) (acc[service.category] = acc[service.category] || []).push(item);
            return acc;
        }, {});
    }

    function formatDateBR(dateString) { if (!dateString) return null; const [year, month, day] = dateString.split('-'); return `${day}/${month}/${year}`; }
    
    function showNotification(message, isError = false) {
        if (!notification) return;
        notification.textContent = message;
        notification.style.backgroundColor = isError ? 'var(--danger-color)' : 'var(--success-color)';
        notification.classList.add('show');
        setTimeout(() => notification.classList.remove('show'), 3000);
    }
    
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
    
    function handleCnpjMask(e) {
        let value = e.target.value.replace(/\D/g, "");
        value = value.replace(/^(\d{2})(\d)/, "$1.$2");
        value = value.replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3");
        value = value.replace(/\.(\d{3})(\d)/, ".$1/$2");
        value = value.replace(/(\d{4})(\d)/, "$1-$2");
        e.target.value = value.slice(0, 18);
    }
    
    initialize();
});
