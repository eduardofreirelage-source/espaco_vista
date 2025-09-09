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

        // **INÍCIO DA CORREÇÃO: Salvar estado dos acordeões abertos**
        const openCategories = new Set();
        quoteCategoriesContainer.querySelectorAll('details[open]').forEach(details => {
            openCategories.add(details.dataset.category);
        });
        // **FIM DA CORREÇÃO**

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
            
            // **INÍCIO DA CORREÇÃO: Restaurar estado dos acordeões**
            if (openCategories.has(categoryName)) {
                accordion.open = true;
            }
            // **FIM DA CORREÇÃO**
            
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
                 e.stopPropagation();
                const container = target.closest('.multiselect-container');
                const wasOpen = container.classList.contains('open');
                document.querySelectorAll('.multiselect-container.open').forEach(c => c.classList.remove('open'));
                if (!wasOpen) container.classList.add('open');
                return;
            }

            // **INÍCIO DA CORREÇÃO: Adicionar stopPropagation para evitar fechar o acordeão**
            const actionButton = e.target.closest('button[data-action]');
            if (actionButton) {
                 e.stopPropagation(); 
            }
            // **FIM DA CORREÇÃO**

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
            // **INÍCIO DA MELHORIA: Lógica de busca**
            const searchInput = container.querySelector('.multiselect-search');
            // **FIM DA MELHORIA**
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
            
             // **INÍCIO DA MELHORIA: Event listener da busca**
            searchInput.addEventListener('input', () => {
                const searchTerm = searchInput.value.toLowerCase();
                list.querySelectorAll('.multiselect-list-item').forEach(item => {
                    const label = item.querySelector('label');
                    const itemName = label.textContent.trim().toLowerCase();
                    if (itemName.includes(searchTerm)) {
                        item.style.display = 'block';
                    } else {
                        item.style.display = 'none';
                    }
                });
            });
            // **FIM DA MELHORIA**
            
            addButton.onclick = () => {
                const selected = list.querySelectorAll('input:checked');
                selected.forEach(checkbox => {
                    quote.items.push({ id: checkbox.value, quantity: 1, assignedDate: '', observacoes: '', discount_percent: 0 });
                    checkbox.checked = false;
                });
                // **INÍCIO DA MELHORIA: Limpar busca após adicionar**
                searchInput.value = '';
                list.querySelectorAll('.multiselect-list-item').forEach(item => item.style.display = 'block');
                 // **FIM DA MELHORIA**
                container.classList.remove('open');
                setDirty(true);
                render();
            };
        });
        document.addEventListener('click', e => {
            if (!e.target.closest('.multiselect-container')) {
                document.querySelectorAll('.multiselect-container.open').forEach(c => c.classList.remove('open'));
            }
        });
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
            // Atualiza a URL para incluir o ID do novo orçamento, sem recarregar a página
            const newUrl = `${window.location.pathname}?quote_id=${quote.id}`;
            window.history.pushState({ path: newUrl }, '', newUrl);
        }
    }
    
    async function loadQuoteFromURL() {
        const params = new URLSearchParams(window.location.search);
        const quoteId = params.get('quote_id');
        if (quoteId) {
            // Não limpa mais a URL, para permitir recarregamento
            // window.history.replaceState({}, document.title, window.location.pathname);
            const { data, error } = await supabase.from('quotes').select('id, quote_data').eq('id', quoteId).single();
            if (error) {
                alert('Não foi possível carregar o orçamento solicitado.');
                // Limpa a URL se o ID for inválido para evitar loops de erro
                 window.history.replaceState({}, document.title, window.location.pathname);
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
                    const total = (unitPrice * quantity) * (1 - itemDiscount / 100);
                    html += `<tr><td>${service.name}${item.observacoes ? `<div class="print-item-obs">Obs: ${item.observacoes}</div>` : ''}${itemDiscount > 0 ? `<div class="print-item-obs">Desconto: ${itemDiscount}%</div>` : ''}</td><td>${formatDateBR(item.assignedDate) || '-'}</td><td class="center">${quantity}</td><td class="price">R$ ${unitPrice.toFixed(2)}</td><td class="price">R$ ${total.toFixed(2)}</td></tr>`;
                });
                html += `</tbody></table>`;
            }
        });
        const subtotal = quote.items.reduce((acc, item) => { const service = appData.services.find(s => s.id === item.id); if (!service) return acc; const unitPrice = prices[item.id] || 0; const quantity = (item.quantity || 1); const itemDiscount = item.discount_percent || 0; return acc + (unitPrice * quantity) * (1 - itemDiscount / 100); }, 0);
        const discount = parseFloat(discountInput.value) || 0;
        const total = subtotal - discount;
        html += `<div class="print-summary"><table><tr><td class="total-label">Subtotal</td><td class="price total-value">R$ ${subtotal.toFixed(2)}</td></tr><tr><td class="total-label">Desconto Geral</td><td class="price total-value">- R$ ${discount.toFixed(2)}</td></tr><tr class="grand-total"><td class="total-label">VALOR TOTAL</td><td class="price total-value">R$ ${total.toFixed(2)}</td></tr></table></div>`;
        printArea.innerHTML = html;
        window.print();
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
        // Anexa o popover ao elemento correto para melhor posicionamento
        const actionCell = button.closest('.item-actions');
        if (actionCell) {
            actionCell.style.position = 'relative';
            actionCell.appendChild(obsPopover);
        } else {
             button.parentElement.appendChild(obsPopover);
        }
        
        obsPopover.classList.add('show');

        document.getElementById('popover-save-btn').onclick = () => {
            const newObs = document.getElementById('popover-obs-textarea').value;
            updateItem(index, 'observacoes', newObs);
            closeAllPopups();
        };
    }

    function closeAllPopups() {
        if (obsPopover && obsPopover.classList.contains('show')) {
             obsPopover.classList.remove('show');
             // Desanexa o popover para evitar que ele fique 'preso' no DOM
             if (obsPopover.parentElement) {
                 obsPopover.parentElement.style.position = '';
                 obsPopover.parentElement.removeChild(obsPopover);
             }
        }
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
        notification.style.backgroundColor = isError ? 'var(--danger-color)' : '#28a745';
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
