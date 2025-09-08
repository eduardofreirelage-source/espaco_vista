import { supabase } from './supabase-client.js';

document.addEventListener('DOMContentLoaded', () => {
    // ESTADO DA APLICAÇÃO
    let appData = { services: [], tabelas: {} };
    let quote = {
        id: null,
        general: { clientName: '', clientCnpj: '', clientEmail: '', clientPhone: '', guestCount: 100, priceTable: '', discount: 0, dates: [] },
        items: []
    };
    const CATEGORY_ORDER = ['Espaço', 'Gastronomia', 'Equipamentos', 'Serviços / Outros'];
    let isDirty = false;

    // ELEMENTOS DO DOM
    const priceTableSelect = document.getElementById('priceTableSelect');
    const discountInput = document.getElementById('discountValue');
    const addDateBtn = document.getElementById('add-date-btn');
    const quoteCategoriesContainer = document.getElementById('quote-categories-container');
    const generalDataFields = ['clientName', 'clientCnpj', 'clientEmail', 'clientPhone', 'guestCount'];
    const saveBtn = document.getElementById('save-quote-btn');
    const printBtn = document.getElementById('print-btn');
    const notification = document.getElementById('save-notification');

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

        appData.services = servicesData || [];
        appData.tabelas = (tablesData || []).reduce((acc, table) => {
            acc[table.name] = { modificador: table.modifier };
            return acc;
        }, {});
    }
    
    function populatePriceTables() {
        priceTableSelect.innerHTML = Object.keys(appData.tabelas).map(name => `<option value="${name}">${name}</option>`).join('');
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
        priceTableSelect.value = quote.general.priceTable;
        discountInput.value = quote.general.discount;
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
                <td style="width:35%;">${service.name}
                    <div class="item-details">
                        <textarea data-field="observacoes" rows="2" placeholder="Observações do item...">${item.observacoes || ''}</textarea>
                    </div>
                </td>
                <td><select data-field="assignedDate"><option value="">Selecione</option>${dateOptions}</select></td>
                <td style="width:70px;"><input type="number" value="${quantity}" min="1" data-field="quantity"></td>
                <td>R$ ${unitPrice.toFixed(2)}</td>
                <td style="width:100px;"><input type="number" value="${itemDiscount}" min="0" max="100" data-field="discount_percent"></td>
                <td>R$ ${total.toFixed(2)}</td>
                <td class="item-actions" style="width:80px;">
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
        addDateBtn.addEventListener('click', () => {
            quote.general.dates.push({ date: new Date().toISOString().split('T')[0], startTime: '19:00', endTime: '23:00', observations: '' });
            setDirty(true);
            render();
        });
        
        generalDataFields.forEach(fieldId => {
            const element = document.getElementById(fieldId);
            if(element) element.addEventListener('input', () => {
                quote.general[fieldId] = element.value;
                setDirty(true);
            });
        });

        priceTableSelect.addEventListener('change', () => { quote.general.priceTable = priceTableSelect.value; setDirty(true); render(); });
        discountInput.addEventListener('input', () => { quote.general.discount = parseFloat(discountInput.value) || 0; setDirty(true); calculateTotal(); });

        if (printBtn) printBtn.addEventListener('click', generatePrintableQuote);
        if (saveBtn) saveBtn.addEventListener('click', saveQuoteToSupabase);
        
        document.body.addEventListener('change', e => {
            const { index, field } = e.target.dataset;
            if (index && field) {
                if (e.target.closest('.date-entry')) {
                    updateDate(index, field, e.target.value);
                } else if (e.target.closest('tr')) {
                    updateItem(index, field, e.target.value);
                }
            }
        });

        document.body.addEventListener('click', e => {
            const button = e.target.closest('button');
            if (!button) return;
            const { action, index } = button.dataset;
            if (action === 'removeDate') removeDate(index);
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

            input.onclick = () => {
                const wasOpen = container.classList.contains('open');
                document.querySelectorAll('.multiselect-container.open').forEach(c => c.classList.remove('open'));
                if (!wasOpen) container.classList.add('open');
            };
            
            addButton.onclick = () => {
                const selected = list.querySelectorAll('input:checked');
                selected.forEach(checkbox => {
                    quote.items.push({ id: checkbox.value, quantity: 1, assignedDate: '', observacoes: '', discount_percent: 0 });
                    checkbox.checked = false;
                });
                container.classList.remove('open');
                setDirty(true);
                render();
            };
        });

        document.addEventListener('click', e => {
            if (!e.target.closest('.multiselect-container')) {
                document.querySelectorAll('.multiselect-container.open').forEach(c => c.classList.remove('open'));
            }
        }, true);
    }
    
    // --- FUNÇÕES DE SALVAR/CARREGAR/IMPRIMIR ---
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
            quote.id = response.data[0].id;
            setDirty(false);
            showNotification(`Orçamento para "${clientName}" salvo com sucesso!`);
        }
    }
    
    async function loadQuoteFromURL() {
        const params = new URLSearchParams(window.location.search);
        const quoteId = params.get('quote_id');
        if (quoteId) {
            window.history.replaceState({}, document.title, window.location.pathname); // Limpa a URL
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
        const printArea = document.getElementById('print-output');
        const prices = getCalculatedPrices();
        const groupedItems = groupItemsByCategory();
        
        let html = `<div class="print-header"><h1>Proposta de Investimento</h1></div>`;
        html += `<div class="print-client-info">
                    <p><strong>Cliente:</strong> ${quote.general.clientName || ''}</p>
                    <p><strong>CNPJ/CPF:</strong> ${quote.general.clientCnpj || ''}</p>
                    <p><strong>Nº de Convidados:</strong> ${quote.general.guestCount}</p>
                 </div>`;
        
        CATEGORY_ORDER.forEach(category => {
            if (groupedItems[category] && groupedItems[category].length > 0) {
                html += `<h2 class="print-category-title">${category}</h2>`;
                html += `<table class="print-table"><thead><tr><th>Item</th><th>Data</th><th>Qtde</th><th>Vlr. Unit.</th><th>Subtotal</th></tr></thead><tbody>`;
                groupedItems[category].forEach(item => {
                    const service = appData.services.find(s => s.id === item.id);
                    const unitPrice = prices[item.id] || 0;
                    const quantity = item.quantity || 1;
                    const itemDiscount = item.discount_percent || 0;
                    const totalBeforeDiscount = unitPrice * quantity;
                    const discountAmount = totalBeforeDiscount * (itemDiscount / 100);
                    const total = totalBeforeDiscount - discountAmount;
                    
                    html += `<tr>
                                <td>
                                    ${service.name}
                                    ${item.observacoes ? `<div class="print-item-obs">Obs: ${item.observacoes}</div>` : ''}
                                    ${itemDiscount > 0 ? `<div class="print-item-obs">Desconto: ${itemDiscount}%</div>` : ''}
                                </td>
                                <td>${formatDateBR(item.assignedDate) || '-'}</td>
                                <td class="center">${quantity}</td>
                                <td class="price">R$ ${unitPrice.toFixed(2)}</td>
                                <td class="price">R$ ${total.toFixed(2)}</td>
                             </tr>`;
                });
                html += `</tbody></table>`;
            }
        });
        
        const subtotal = parseFloat(document.getElementById('subtotalValue').textContent.replace('R$ ', '').replace(/\./g, '').replace(',', '.'));
        const discount = parseFloat(discountInput.value) || 0;
        const total = parseFloat(document.getElementById('totalValue').textContent.replace('R$ ', '').replace(/\./g, '').replace(',', '.'));
        
        html += `<div class="print-summary">
                    <table>
                        <tr><td class="total-label">Subtotal</td><td class="price total-value">R$ ${subtotal.toFixed(2)}</td></tr>
                        <tr><td class="total-label">Desconto Geral</td><td class="price total-value">- R$ ${discount.toFixed(2)}</td></tr>
                        <tr class="grand-total"><td class="total-label">VALOR TOTAL</td><td class="price total-value">R$ ${total.toFixed(2)}</td></tr>
                    </table>
                 </div>`;

        printArea.innerHTML = html;
        window.print();
    }
    
    // --- FUNÇÕES DE MANIPULAÇÃO DO ORÇAMENTO ---
    function updateItem(index, key, value) { const item = quote.items[parseInt(index)]; if(item) { item[key] = (key === 'quantity' || key === 'discount_percent') ? parseFloat(value) || 0 : value; setDirty(true); render(); } }
    function removeItem(index) { quote.items.splice(parseInt(index), 1); setDirty(true); render(); }
    function duplicateItem(index) { const item = quote.items[parseInt(index)]; if(item) { quote.items.splice(parseInt(index) + 1, 0, JSON.parse(JSON.stringify(item))); setDirty(true); render(); } }
    function updateDate(index, field, value) { const date = quote.general.dates[parseInt(index)]; if (date) { date[field] = value; setDirty(true); render(); } }
    function removeDate(index) { quote.general.dates.splice(parseInt(index), 1); setDirty(true); render(); }
    
    // --- FUNÇÕES AUXILIARES ---
    function getCalculatedPrices() {
        const tableName = priceTableSelect.value;
        const table = appData.tabelas[tableName];
        if (!table) return {};
        const prices = {};
        appData.services.forEach(service => { prices[service.id] = (service.base_price || 0) * (table.modificador || 1); });
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
                saveBtn.textContent = 'Salvo no Banco';
            }
        }
    }
    
    initialize();
});
