import { supabase, getSession } from './supabase-client.js';

document.addEventListener('DOMContentLoaded', async () => {
    // =================================================================
    // ESTADO GLOBAL E CONFIGURAÇÃO
    // =================================================================
    let services = [];
    let priceTables = [];
    let servicePrices = [];
    let currentQuote = {
        id: null,
        client_name: '',
        client_cnpj: '',
        client_email: '',
        client_phone: '',
        guest_count: 100,
        price_table_id: null,
        event_dates: [],
        items: [],
        discount_general: 0,
        status: 'Rascunho'
    };
    let userRole = 'client';
    let isDirty = false;

    // NOVO: Define a ordem fixa para as categorias
    const CATEGORY_ORDER = ['Espaço', 'Gastronomia', 'Equipamentos', 'Serviços e Outros'];

    const notification = document.getElementById('save-notification');
    const catalogModal = document.getElementById('catalogModal');

    // =================================================================
    // INICIALIZAÇÃO
    // =================================================================
    async function initialize() {
        await checkUserRole();
        await fetchData();
        populatePriceTables();
        setupEventListeners();
        
        const urlParams = new URLSearchParams(window.location.search);
        const quoteId = urlParams.get('quote_id');
        const autoPrint = urlParams.get('print') === 'true';

        if (quoteId) {
            await loadQuote(quoteId);
        } 
        
        renderQuote();
        setDirty(false);

        if (autoPrint) {
            if (userRole === 'admin') {
                const newUrl = new URL(window.location);
                newUrl.searchParams.delete('print');
                window.history.replaceState({}, document.title, newUrl);

                setTimeout(() => {
                    window.print();
                }, 500);
            } else {
                console.warn("Acesso de impressão negado para clientes.");
                 window.history.replaceState({}, document.title, window.location.pathname);
            }
        }
    }

    async function checkUserRole() {
        const { role } = await getSession();
        userRole = role;

        const adminLink = document.getElementById('admin-link');
        const logoutBtn = document.getElementById('logout-btn');
        const loginLink = document.getElementById('login-link');
        const mainTitle = document.getElementById('main-title');
        const saveBtn = document.getElementById('save-quote-btn');

        if (userRole === 'admin') {
            document.body.classList.remove('client-view');
            if(adminLink) adminLink.style.display = 'inline-block';
            if(logoutBtn) logoutBtn.style.display = 'inline-block';
            if(loginLink) loginLink.style.display = 'none';
            if(mainTitle) mainTitle.textContent = 'Gerador de Propostas (Admin)';
        } else {
            document.body.classList.add('client-view');
            if(adminLink) adminLink.style.display = 'none';
            if(logoutBtn) logoutBtn.style.display = 'none';
            if(loginLink) loginLink.style.display = 'inline-block';
            if(mainTitle) mainTitle.textContent = 'Solicitação de Orçamento (Cliente)';
            if(saveBtn) saveBtn.textContent = 'Enviar Solicitação';
            currentQuote.status = 'Solicitado';
        }
    }

    async function fetchData() {
        try {
            const servicesRes = await supabase.from('services').select('*').order('category').order('name');
            if (servicesRes.error) throw servicesRes.error;
            services = servicesRes.data;

            if (userRole === 'admin') {
                const [tablesRes, pricesRes] = await Promise.all([
                    supabase.from('price_tables').select('*').order('name'),
                    supabase.from('service_prices').select('*')
                ]);
                if (tablesRes.error) throw tablesRes.error;
                if (pricesRes.error) throw pricesRes.error;
                priceTables = tablesRes.data;
                servicePrices = pricesRes.data;
            } else {
                priceTables = [];
                servicePrices = [];
            }
        } catch (error) {
            console.error("Erro ao carregar dados:", error);
            showNotification("Erro ao carregar dados iniciais.", true);
        }
    }
    
    function setDirty(state) {
        isDirty = state;
        updateSaveButtonState();
    }

    function updateSaveButtonState() {
        const saveBtn = document.getElementById('save-quote-btn');
        if (!saveBtn) return;
        if (userRole === 'admin') {
            if (isDirty) {
                saveBtn.classList.add('dirty');
                saveBtn.textContent = 'Salvar Alterações*';
            } else {
                saveBtn.classList.remove('dirty');
                saveBtn.textContent = 'Salvo';
            }
        }
    }

    function showNotification(message, isError = false) {
        if (!notification) return;
        notification.textContent = message;
        notification.style.backgroundColor = isError ? 'var(--danger-color, #dc3545)' : 'var(--success-color, #28a745)';
        notification.classList.add('show');
        setTimeout(() => notification.classList.remove('show'), 4000);
    }

    function formatCurrency(value) {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(parseFloat(value) || 0);
    }
    
    function populatePriceTables() {
        const select = document.getElementById('priceTableSelect');
        if (!select) return;
        select.innerHTML = '<option value="">Selecione uma tabela</option>';
        priceTables.forEach(table => {
            const option = document.createElement('option');
            option.value = table.id;
            option.textContent = table.name;
            select.appendChild(option);
        });
    }

    function syncClientData() {
        currentQuote.client_name = document.getElementById('clientName')?.value || '';
        currentQuote.client_cnpj = document.getElementById('clientCnpj')?.value || '';
        currentQuote.client_email = document.getElementById('clientEmail')?.value || '';
        currentQuote.client_phone = document.getElementById('clientPhone')?.value || '';
        currentQuote.guest_count = parseInt(document.getElementById('guestCount')?.value) || 0;
        
        if (userRole === 'admin') {
            currentQuote.price_table_id = document.getElementById('priceTableSelect')?.value || null;
            currentQuote.discount_general = parseFloat(document.getElementById('discountValue')?.value) || 0;
        }
        syncEventDates();
        setDirty(true);
    }

    function syncEventDates() {
        const container = document.getElementById('event-dates-container');
        if (!container) return;
        const entries = container.querySelectorAll('.date-entry');
        currentQuote.event_dates = [];
        entries.forEach(entry => {
            const date = entry.querySelector('input[type="date"]').value;
            const start = entry.querySelector('.start-time').value;
            const end = entry.querySelector('.end-time').value;
            if (date) {
                currentQuote.event_dates.push({ date, start, end });
            }
        });
    }

    function addDateEntry(data = {}) {
        const container = document.getElementById('event-dates-container');
        if (!container) return;

        const div = document.createElement('div');
        div.className = 'date-entry';
        const uniqueId = Date.now() + Math.random();

        div.innerHTML = `
            <div class="form-group">
                <label for="event_date_${uniqueId}">Data</label>
                <input type="date" id="event_date_${uniqueId}" value="${data.date || ''}" required>
            </div>
            <div class="form-group">
                <label for="start_time_${uniqueId}">Início</label>
                <input type="time" class="start-time" id="start_time_${uniqueId}" value="${data.start || '19:00'}">
            </div>
            <div class="form-group">
                <label for="end_time_${uniqueId}">Fim</label>
                <input type="time" class="end-time" id="end_time_${uniqueId}" value="${data.end || '23:00'}">
            </div>
            <button type="button" class="btn-icon remove-date-btn" title="Remover Data">&times;</button>
        `;
        container.appendChild(div);
        updateDateInputs();
    }

    function updateDateInputs() {
        document.querySelectorAll('#event-dates-container input').forEach(input => {
            input.onchange = () => {
                syncClientData();
                renderQuote();
            };
        });
    }
    
    // MODIFICADO: Função de cálculo para aplicar a regra da consumação
    function calculateQuote() {
        let consumableSubtotal = 0;
        let nonConsumableSubtotal = 0;
        const guestCount = currentQuote.guest_count;
        const priceTableId = currentQuote.price_table_id;

        currentQuote.items.forEach(item => {
            const service = services.find(s => s.id === item.service_id);
            if (!service) return;

            let basePrice = 0;
            if (userRole === 'admin' && priceTableId) {
                const priceRecord = servicePrices.find(p => p.service_id === item.service_id && p.price_table_id === priceTableId);
                basePrice = priceRecord ? parseFloat(priceRecord.price) : 0;
            }
            
            let quantity = item.quantity;
            if (service.unit === 'por_pessoa') {
                quantity = guestCount;
                item.quantity = quantity;
            }

            const cost = basePrice * quantity;
            const discountRate = (userRole === 'admin' ? (parseFloat(item.discount_percent) || 0) : 0) / 100;
            const total = cost * (1 - discountRate);

            item.calculated_unit_price = basePrice;
            item.calculated_total = total;
            
            // Separa os totais entre consumíveis e não consumíveis
            if (service.category === 'Serviços e Outros') {
                nonConsumableSubtotal += total;
            } else {
                consumableSubtotal += total;
            }
        });

        const subtotal = consumableSubtotal + nonConsumableSubtotal;
        const discountGeneral = userRole === 'admin' ? (parseFloat(currentQuote.discount_general) || 0) : 0;
        
        let availableConsumableCredit = 0;
        if (userRole === 'admin' && priceTableId) {
            const table = priceTables.find(t => t.id === priceTableId);
            availableConsumableCredit = table ? (parseFloat(table.consumable_credit) || 0) : 0;
        }

        // O crédito usado é o menor valor entre o crédito disponível e o subtotal dos itens consumíveis
        const consumableCreditUsed = Math.min(consumableSubtotal, availableConsumableCredit);

        const total = subtotal - discountGeneral - consumableCreditUsed;

        return { subtotal, consumableCredit: consumableCreditUsed, discountGeneral, total: Math.max(0, total) };
    }


    // =================================================================
    // RENDERIZAÇÃO DO ORÇAMENTO
    // =================================================================

    // NOVO: Função auxiliar para ordenação customizada
    function sortCategories(categories) {
        return categories.sort((a, b) => {
            const indexA = CATEGORY_ORDER.indexOf(a);
            const indexB = CATEGORY_ORDER.indexOf(b);
            if (indexA === -1 && indexB === -1) return a.localeCompare(b); // Alfabético para não listados
            if (indexA === -1) return 1;  // Não listados vão para o fim
            if (indexB === -1) return -1; // Não listados vão para o fim
            return indexA - indexB; // Ordena pelos definidos
        });
    }
    
    function renderQuote() {
        const calculation = calculateQuote();
        renderCategories(calculation);
        renderSummary(calculation);

        if (userRole === 'admin') {
            generatePrintOutput(calculation);
        }

        if (catalogModal.style.display === 'block') {
            updateCatalogButtonsState();
        }
    }

    function renderCategories(calculation) {
        const container = document.getElementById('quote-categories-container');
        if (!container) return;

        // MODIFICADO: Usa a nova função de ordenação
        const categoriesInQuote = sortCategories([...new Set(currentQuote.items.map(item => {
             const service = services.find(s => s.id === item.service_id);
             return service?.category;
        }).filter(Boolean))]);

        container.querySelectorAll('.category-accordion').forEach(accordion => {
            const categoryName = accordion.dataset.category;
            if (!categoriesInQuote.includes(categoryName)) {
                const itemsStillExist = currentQuote.items.some(item => {
                    const service = services.find(s => s.id === item.service_id);
                    return service && service.category === categoryName;
                });
                if (!itemsStillExist) {
                   accordion.remove();
                }
            }
        });

        categoriesInQuote.forEach(category => {
            let accordion = container.querySelector(`details[data-category="${category}"]`);
            if (!accordion) {
                const template = document.getElementById('category-template').content.cloneNode(true);
                accordion = template.querySelector('details');
                accordion.dataset.category = category;
                accordion.querySelector('.category-title').textContent = category;
                container.appendChild(accordion);
            }
            renderItems(accordion, category);
        });

        if (categoriesInQuote.length === 0) {
            container.innerHTML = '<p style="padding: 1.2rem; text-align: center; color: var(--subtle-text-color);">Nenhum item adicionado ainda. Clique em "+ Adicionar Itens" para começar.</p>';
        } else {
            const messageEl = container.querySelector('p');
            if (messageEl) {
                messageEl.remove();
            }
        }
    }

    function renderItems(accordion, category) {
        const tbody = accordion.querySelector('tbody');
        tbody.innerHTML = '';

        const itemIdsInCategory = currentQuote.items.filter(item => {
            const service = services.find(s => s.id === item.service_id);
            return service && service.category === category;
        }).map(item => item.id);

        currentQuote.items.forEach(item => {
            if (!itemIdsInCategory.includes(item.id)) return;

            const service = services.find(s => s.id === item.service_id);
            if (!service) return;

            const row = document.createElement('tr');
            row.dataset.itemId = item.id;

            const isPerPerson = service.unit === 'por_pessoa';

            row.innerHTML = `
                <td class="col-item">${service.name}</td>
                <td class="col-date">${renderDateSelect(item)}</td>
                <td class="col-qty">
                    <input type="number" value="${item.quantity}" min="1" class="qty-input" ${isPerPerson ? 'disabled' : ''}>
                </td>
                <td class="col-unit-price price">${formatCurrency(item.calculated_unit_price)}</td>
                <td class="col-discount">
                    <input type="number" value="${item.discount_percent || 0}" min="0" max="100" class="discount-input price-input">
                </td>
                <td class="col-total-price price">${formatCurrency(item.calculated_total)}</td>
                <td class="col-actions item-actions">
                    <button class="btn-icon duplicate-item-btn" title="Duplicar Item">⧉</button>
                    <button class="btn-icon obs-btn" title="Observações">${item.observations ? '📝' : '📄'}</button>
                    <button class="btn-icon remove-item-btn" title="Remover Item">&times;</button>
                </td>
            `;
            tbody.appendChild(row);
        });
    }

    function renderDateSelect(item) {
        if (currentQuote.event_dates.length === 0) return 'N/A';
        
        let options = currentQuote.event_dates.map(d => 
            `<option value="${d.date}" ${item.event_date === d.date ? 'selected' : ''}>${new Date(d.date + 'T12:00:00').toLocaleDateString('pt-BR')}</option>`
        ).join('');

        return `<select class="date-select">${options}</select>`;
    }

    function renderSummary(calculation) {
        const consumableText = "(-) " + formatCurrency(calculation.consumableCredit);
        if(document.getElementById('subtotalValue')) document.getElementById('subtotalValue').textContent = formatCurrency(calculation.subtotal);
        if(document.getElementById('consumableValue')) document.getElementById('consumableValue').textContent = consumableText;
        if(document.getElementById('discountValue')) document.getElementById('discountValue').value = calculation.discountGeneral.toFixed(2);
        if(document.getElementById('totalValue')) document.getElementById('totalValue').textContent = formatCurrency(calculation.total);

        if(document.getElementById('summary-subtotal-value')) document.getElementById('summary-subtotal-value').textContent = formatCurrency(calculation.subtotal);
        if(document.getElementById('summary-consumable-value')) document.getElementById('summary-consumable-value').textContent = consumableText;
        if(document.getElementById('summary-discount-value')) document.getElementById('summary-discount-value').textContent = formatCurrency(calculation.discountGeneral);
        if(document.getElementById('summary-total-value')) document.getElementById('summary-total-value').textContent = formatCurrency(calculation.total);

        const categoryList = document.getElementById('summary-categories-list');
        if (!categoryList) return;

        categoryList.innerHTML = '';
        
        // MODIFICADO: Usa a nova função de ordenação
        const categoriesInQuote = sortCategories([...new Set(currentQuote.items.map(item => {
            const service = services.find(s => s.id === item.service_id);
            return service ? service.category : null;
        }).filter(Boolean))]);

        categoriesInQuote.forEach(category => {
            const categoryTotal = currentQuote.items.reduce((sum, item) => {
                const service = services.find(s => s.id === item.service_id);
                if (service && service.category === category) {
                    return sum + item.calculated_total;
                }
                return sum;
            }, 0);

            const div = document.createElement('div');
            div.className = 'summary-line';
            div.innerHTML = `<span>${category}</span><strong>${formatCurrency(categoryTotal)}</strong>`;
            categoryList.appendChild(div);
        });
    }

    // =================================================================
    // LÓGICA DE GERAÇÃO DO PDF (IMPRESSÃO)
    // =================================================================

    function generatePrintOutput(calculation) {
        const printOutput = document.getElementById('print-output');
        if (!printOutput) return;

        let html = `
            <div class="print-header">
                <h1>Proposta Comercial</h1>
                <p>Data da Proposta: ${new Date().toLocaleDateString('pt-BR')}</p>
            </div>
        `;

        html += `
            <div class="print-client-info">
                <p><strong>Cliente:</strong> ${currentQuote.client_name || 'N/A'}</p>
                <p><strong>CNPJ:</strong> ${currentQuote.client_cnpj || 'N/A'}</p>
                <p><strong>E-mail:</strong> ${currentQuote.client_email || 'N/A'}</p>
                <p><strong>Nº Convidados:</strong> ${currentQuote.guest_count}</p>
                <p><strong>Datas do Evento:</strong> ${currentQuote.event_dates.map(d => new Date(d.date + 'T12:00:00').toLocaleDateString('pt-BR')).join(', ')}</p>
            </div>
        `;

        // MODIFICADO: Usa a nova função de ordenação
        const categoriesInQuote = sortCategories([...new Set(currentQuote.items.map(item => {
             const service = services.find(s => s.id === item.service_id);
             return service?.category;
        }).filter(Boolean))]);

        categoriesInQuote.forEach(category => {
            html += `<h2 class="print-category-title">${category}</h2>`;
            html += `
                <table class="print-table">
                    <thead>
                        <tr>
                            <th>Item</th>
                            <th class="center">Data</th>
                            <th class="center">Qtde.</th>
                            <th class="price">Vlr. Unitário</th>
                            <th class="price">Desconto (%)</th>
                            <th class="price">Vlr. Total</th>
                        </tr>
                    </thead>
                    <tbody>
            `;
            const itemIdsInCategory = currentQuote.items.filter(item => {
                const service = services.find(s => s.id === item.service_id);
                return service && service.category === category;
            }).map(item => item.id);


            currentQuote.items.forEach(item => {
                if (!itemIdsInCategory.includes(item.id)) return;
                
                const service = services.find(s => s.id === item.service_id);
                if (!service) return;

                const formattedDate = item.event_date ? new Date(item.event_date + 'T12:00:00').toLocaleDateString('pt-BR') : 'N/A';
                
                html += `
                    <tr>
                        <td>
                            ${service.name}
                            ${item.observations ? `<div class="print-item-obs">${item.observations}</div>` : ''}
                        </td>
                        <td class="center">${formattedDate}</td>
                        <td class="center">${item.quantity}</td>
                        <td class="price">${formatCurrency(item.calculated_unit_price)}</td>
                        <td class="price">${item.discount_percent || 0}%</td>
                        <td class="price">${formatCurrency(item.calculated_total)}</td>
                    </tr>
                `;
            });

            html += `</tbody></table>`;
        });

        html += `
            <div class="print-summary">
                <table>
                    <tr>
                        <td class="total-label">Subtotal:</td>
                        <td class="total-value">${formatCurrency(calculation.subtotal)}</td>
                    </tr>
                    <tr>
                        <td class="total-label">Consumação Inclusa:</td>
                        <td class="total-value">(-) ${formatCurrency(calculation.consumableCredit)}</td>
                    </tr>
                    <tr>
                        <td class="total-label">Desconto Geral:</td>
                        <td class="total-value">(-) ${formatCurrency(calculation.discountGeneral)}</td>
                    </tr>
                    <tr class="grand-total">
                        <td class="total-label">VALOR TOTAL:</td>
                        <td class="total-value">${formatCurrency(calculation.total)}</td>
                    </tr>
                </table>
            </div>
        `;

        printOutput.innerHTML = html;
    }


    // =================================================================
    // LÓGICA DO MODAL DE CATÁLOGO
    // =================================================================
    let activeCategory = 'Todos';
    let searchQuery = '';

    function openCatalogModal() {
        if (currentQuote.event_dates.length === 0) {
            alert("Por favor, adicione pelo menos uma data de evento antes de adicionar itens.");
            return;
        }
        
        activeCategory = 'Todos';
        searchQuery = '';
        document.getElementById('catalog-search').value = '';

        renderCatalog();
        catalogModal.style.display = 'block';
        document.getElementById('catalog-search').focus();
    }

    function closeCatalogModal() {
        catalogModal.style.display = 'none';
    }

    function renderCatalog() {
        renderCatalogCategories();
        renderCatalogItems();
    }

    function renderCatalogCategories() {
        const container = document.getElementById('catalog-categories');
        const categories = ['Todos', ...new Set(services.map(s => s.category))].sort((a, b) => a === 'Todos' ? -1 : b === 'Todos' ? 1 : a.localeCompare(b));
        
        container.innerHTML = categories.map(category => `
            <div class="catalog-category-tab ${category === activeCategory ? 'active' : ''}" data-category="${category}">
                ${category}
            </div>
        `).join('');
    }

    function renderCatalogItems() {
        const container = document.getElementById('catalog-items');
        
        let filteredServices = services;

        if (activeCategory !== 'Todos') {
            filteredServices = filteredServices.filter(s => s.category === activeCategory);
        }

        if (searchQuery) {
            filteredServices = filteredServices.filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase()));
        }

        const defaultDate = currentQuote.event_dates[0]?.date;

        container.innerHTML = filteredServices.map(service => {
            const isAdded = currentQuote.items.some(item => item.service_id === service.id && item.event_date === defaultDate);

            return `
            <div class="catalog-item">
                <span class="catalog-item-name">${service.name}</span>
                <button class="btn btn-primary btn-add-item ${isAdded ? 'btn-added' : ''}" data-service-id="${service.id}" ${isAdded ? 'disabled' : ''}>
                    ${isAdded ? 'Adicionado ✔' : 'Adicionar'}
                </button>
            </div>
        `}).join('');
    }

    function updateCatalogButtonsState() {
        const container = document.getElementById('catalog-items');
        if (!container) return;

        const defaultDate = currentQuote.event_dates[0]?.date;

        container.querySelectorAll('.btn-add-item').forEach(button => {
            const serviceId = button.dataset.serviceId;
            const isAdded = currentQuote.items.some(item => item.service_id === serviceId && item.event_date === defaultDate);

            if (isAdded) {
                button.classList.add('btn-added');
                button.disabled = true;
                button.textContent = 'Adicionado ✔';
            } else {
                button.classList.remove('btn-added');
                button.disabled = false;
                button.textContent = 'Adicionar';
            }
        });
    }

    // =================================================================
    // GERENCIAMENTO DE ITENS
    // =================================================================
    function addItemsToQuote(serviceId) {
        
        if (currentQuote.event_dates.length === 0) return;

        const defaultDate = currentQuote.event_dates[0].date;

        const existing = currentQuote.items.find(item => item.service_id === serviceId && item.event_date === defaultDate);
        if (existing) {
            return;
        }

        const newItem = {
            id: Date.now() + '-' + serviceId, 
            service_id: serviceId,
            quantity: 1,
            discount_percent: 0,
            event_date: defaultDate,
            observations: ''
        };
        currentQuote.items.push(newItem);
        
        setDirty(true);
        renderQuote();
    }

    function updateItem(itemId, field, value) {
        const item = currentQuote.items.find(i => i.id === itemId);
        if (item) {
            if (field === 'quantity' || field === 'discount_percent') {
                item[field] = parseFloat(value) || 0;
            } else {
                item[field] = value;
            }
            setDirty(true);
            renderQuote();
        }
    }

    function removeItem(itemId) {
        currentQuote.items = currentQuote.items.filter(i => i.id !== itemId);
        setDirty(true);
        renderQuote();
    }

    function showObsPopover(button, itemId) {
        const popover = document.getElementById('obs-popover');
        if (!popover) return;

        const item = currentQuote.items.find(i => i.id === itemId);
        if (!item) return;

        popover.innerHTML = `
            <textarea id="obs-text">${item.observations || ''}</textarea>
            <button id="save-obs-btn" class="btn">Salvar Observação</button>
        `;

        const rect = button.getBoundingClientRect();
        popover.style.position = 'absolute';
        popover.style.top = `${window.scrollY + rect.top}px`;
        if (rect.left < 310) {
             popover.style.left = `${rect.right + 10}px`;
        } else {
             popover.style.left = `${rect.left - 310}px`;
        }
       
        popover.classList.add('show');

        document.getElementById('save-obs-btn').onclick = () => {
            const text = document.getElementById('obs-text').value;
            updateItem(itemId, 'observations', text);
            popover.classList.remove('show');
            renderQuote(); 
        };
    }


    function duplicateItem(itemId) {
        const originalItemIndex = currentQuote.items.findIndex(i => i.id === itemId);
        if (originalItemIndex === -1) return;

        const originalItem = currentQuote.items[originalItemIndex];
        
        const duplicatedItem = JSON.parse(JSON.stringify(originalItem));
        
        duplicatedItem.id = Date.now() + '-dup-' + (originalItem.service_id || originalItemIndex);
        
        currentQuote.items.splice(originalItemIndex + 1, 0, duplicatedItem);

        setDirty(true);
        renderQuote();
    }

    // =================================================================
    // LÓGICA DE EXPORTAÇÃO XLSX
    // =================================================================
    function exportToXLSX() {
        if (userRole !== 'admin') {
            showNotification("Funcionalidade disponível apenas para administradores.", true);
            return;
        }

        const clientName = currentQuote.client_name || 'Cliente';
        const fileName = `Proposta - ${clientName.replace(/[^a-z0-9]/gi, '_')}.xlsx`;
        const calculation = calculateQuote();

        const data = [
            ["Proposta Comercial"],
            [],
            ["DADOS DO CLIENTE"],
            ["Nome", currentQuote.client_name],
            ["CNPJ", currentQuote.client_cnpj],
            ["E-mail", currentQuote.client_email],
            ["Telefone", currentQuote.client_phone],
            [],
            ["DADOS DO EVENTO"],
            ["Nº de Convidados", currentQuote.guest_count],
            ["Datas do Evento", currentQuote.event_dates.map(d => new Date(d.date + 'T12:00:00').toLocaleDateString('pt-BR')).join(', ')],
            [],
            ["ITENS DO ORÇAMENTO"],
            ["Categoria", "Item", "Data", "Qtde.", "Vlr. Unitário", "Desc. (%)", "Vlr. Total", "Observações"]
        ];

        // MODIFICADO: Usa a nova função de ordenação
        const categoriesInQuote = sortCategories([...new Set(currentQuote.items.map(item => {
            const service = services.find(s => s.id === item.service_id);
            return service?.category;
        }).filter(Boolean))]);

        categoriesInQuote.forEach(category => {
            const itemsInCategory = currentQuote.items.filter(item => {
                const service = services.find(s => s.id === item.service_id);
                return service && service.category === category;
            });

            itemsInCategory.forEach(item => {
                const service = services.find(s => s.id === item.service_id);
                if (!service) return;

                const formattedDate = item.event_date ? new Date(item.event_date + 'T12:00:00').toLocaleDateString('pt-BR') : 'N/A';
                data.push([
                    service.category,
                    service.name,
                    formattedDate,
                    item.quantity,
                    item.calculated_unit_price,
                    item.discount_percent || 0,
                    item.calculated_total,
                    item.observations || ''
                ]);
            });
        });

        data.push([]);
        data.push([]);
        data.push([null, null, null, null, null, "Subtotal", calculation.subtotal]);
        data.push([null, null, null, null, null, "Consumação Inclusa", -calculation.consumableCredit]);
        data.push([null, null, null, null, null, "Desconto Geral", -calculation.discountGeneral]);
        data.push([null, null, null, null, null, "VALOR TOTAL", calculation.total]);

        const ws = XLSX.utils.aoa_to_sheet(data);

        ws['!cols'] = [
            { wch: 25 }, { wch: 40 }, { wch: 12 }, { wch: 8 },
            { wch: 15 }, { wch: 12 }, { wch: 15 }, { wch: 50 }
        ];

        const currencyFormat = 'R$ #,##0.00';
        const itemsHeaderRowIndex = 13;
        for (let i = itemsHeaderRowIndex; i < data.length; i++) {
            if (data[i].length < 4) continue;
            
            const unitPriceCell = ws[XLSX.utils.encode_cell({ c: 4, r: i })];
            if (unitPriceCell && typeof unitPriceCell.v === 'number') {
                unitPriceCell.t = 'n';
                unitPriceCell.z = currencyFormat;
            }
            const totalCell = ws[XLSX.utils.encode_cell({ c: 6, r: i })];
            if (totalCell && typeof totalCell.v === 'number') {
                totalCell.t = 'n';
                totalCell.z = currencyFormat;
            }
        }
        
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Proposta");

        XLSX.writeFile(wb, fileName);
    }



    // =================================================================
    // EVENT LISTENERS
    // =================================================================
    
    function setupEventListeners() {
         document.querySelectorAll('#clientName, #clientCnpj, #clientEmail, #clientPhone').forEach(input => {
            input.addEventListener('change', syncClientData);
        });
        
        document.querySelectorAll('#guestCount, #priceTableSelect').forEach(input => {
             input.addEventListener('change', () => {
                syncClientData();
                renderQuote(); 
            });
        });

        document.getElementById('add-date-btn')?.addEventListener('click', () => {
            addDateEntry();
            syncClientData();
            renderQuote();
        });

        document.getElementById('event-dates-container')?.addEventListener('click', (e) => {
            if (e.target.classList.contains('remove-date-btn')) {
                e.target.closest('.date-entry').remove();
                syncClientData();
                renderQuote();
            }
        });

        document.getElementById('quote-categories-container')?.addEventListener('change', (e) => {
            const row = e.target.closest('tr');
            if (!row) return;
            const itemId = row.dataset.itemId;

            if (e.target.classList.contains('qty-input')) {
                updateItem(itemId, 'quantity', e.target.value);
            } else if (e.target.classList.contains('discount-input')) {
                 if (userRole === 'admin') {
                    updateItem(itemId, 'discount_percent', e.target.value);
                } else {
                    e.target.value = 0;
                }
            } else if (e.target.classList.contains('date-select')) {
                updateItem(itemId, 'event_date', e.target.value);
            }
        });

        document.getElementById('quote-categories-container')?.addEventListener('click', (e) => {
            const row = e.target.closest('tr');
            
            if (row) {
                const itemId = row.dataset.itemId;

                if (e.target.classList.contains('duplicate-item-btn')) {
                    duplicateItem(itemId);
                    return;
                }
                
                if (e.target.classList.contains('remove-item-btn')) {
                    removeItem(itemId);
                    return;
                } else if (e.target.classList.contains('obs-btn')) {
                    e.stopPropagation();
                    showObsPopover(e.target, itemId);
                    return;
                }
            }
        });

        document.getElementById('discountValue')?.addEventListener('change', (e) => {
            currentQuote.discount_general = parseFloat(e.target.value) || 0;
            setDirty(true);
            renderQuote();
        });

        document.addEventListener('click', (e) => {
            const popover = document.getElementById('obs-popover');
            if (popover && popover.classList.contains('show') && !popover.contains(e.target) && !e.target.classList.contains('obs-btn')) {
                popover.classList.remove('show');
            }
        });

        document.getElementById('save-quote-btn')?.addEventListener('click', saveQuote);
        
        document.getElementById('export-xlsx-btn')?.addEventListener('click', exportToXLSX);

        document.getElementById('print-btn')?.addEventListener('click', () => {
             if (userRole === 'admin') {
                 window.print();
             }
        });

        document.getElementById('open-catalog-btn')?.addEventListener('click', openCatalogModal);
        document.getElementById('close-catalog-btn')?.addEventListener('click', closeCatalogModal);
        
        window.addEventListener('click', (event) => {
            if (event.target == catalogModal) {
                closeCatalogModal();
            }
        });

        let searchTimeout;
        document.getElementById('catalog-search')?.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                 searchQuery = e.target.value;
                 renderCatalogItems();
            }, 300);
        });

        document.getElementById('catalog-categories')?.addEventListener('click', (e) => {
            const tab = e.target.closest('.catalog-category-tab');
            if (tab) {
                activeCategory = tab.dataset.category;
                renderCatalog();
            }
        });

        document.getElementById('catalog-items')?.addEventListener('click', (e) => {
            const button = e.target.closest('.btn-add-item');
            if (button && !button.disabled) {
                const serviceId = button.dataset.serviceId;
                addItemsToQuote(serviceId);
            }
        });
    }


    // =================================================================
    // PERSISTÊNCIA (SALVAR E CARREGAR)
    // =================================================================
    
    async function saveQuote() {
        syncClientData();

        if (currentQuote.items.length === 0 && document.getElementById('quote-categories-container').children.length > 0) {
            showNotification("Adicione itens antes de salvar ou enviar.", true);
            return;
        }

        const calculation = calculateQuote();
        
        const quoteDataObject = {
            client_cnpj: currentQuote.client_cnpj,
            client_email: currentQuote.client_email,
            client_phone: currentQuote.client_phone,
            guest_count: currentQuote.guest_count,
            price_table_id: currentQuote.price_table_id,
            event_dates: currentQuote.event_dates,
            items: currentQuote.items.map(item => {
                const { id, ...rest } = item;
                return rest;
            }),
            discount_general: currentQuote.discount_general,
            subtotal_value: calculation.subtotal,
            consumable_credit_used: calculation.consumableCredit
        };

        const finalPayload = {
            client_name: currentQuote.client_name,
            status: currentQuote.status,
            total_value: calculation.total,
            quote_data: quoteDataObject
        };
        
        if (userRole === 'client') {
            finalPayload.status = 'Solicitado pelo Cliente';
            finalPayload.total_value = 0;
            // Limpa dados sensíveis no objeto JSON
            finalPayload.quote_data.price_table_id = null;
            finalPayload.quote_data.discount_general = 0;
            finalPayload.quote_data.subtotal_value = 0;
            finalPayload.quote_data.consumable_credit_used = 0;
            finalPayload.quote_data.items.forEach(item => {
                item.discount_percent = 0;
                item.calculated_unit_price = 0;
                item.calculated_total = 0;
            });
        } else if (userRole === 'admin' && !isDirty) {
            return; 
        }

        try {
            let result;
            if (currentQuote.id) {
                const { data, error } = await supabase.from('quotes').update(finalPayload).eq('id', currentQuote.id).select().single();
                result = { data, error };
            } else {
                const { data, error } = await supabase.from('quotes').insert(finalPayload).select().single();
                result = { data, error };
            }

            if (result.error) throw result.error;

            const savedData = result.data;
            currentQuote.id = savedData.id;
            Object.assign(currentQuote, savedData.quote_data);
            currentQuote.items = (savedData.quote_data.items || []).map((item, index) => ({
                ...item,
                id: `saved-${savedData.id}-${index}-${item.service_id || index}`
            }));
            
            if (userRole === 'client') {
                showNotification('Solicitação enviada com sucesso! Entraremos em contato.');
            } else {
                showNotification('Orçamento salvo com sucesso!');
                setDirty(false);
                if (window.location.search.indexOf('quote_id=') === -1) {
                     const newUrl = new URL(window.location);
                     newUrl.searchParams.set('quote_id', savedData.id);
                     window.history.pushState({}, '', newUrl);
                }
            }
            
            renderQuote();

        } catch (error) {
            console.error("Erro ao salvar orçamento:", error);
            showNotification(`Erro ao salvar/enviar: ${error.message}`, true);
        }
    }

    async function loadQuote(id) {
        if (userRole === 'client') {
            console.warn("Clientes não podem carregar orçamentos por ID.");
            window.history.pushState({}, '', window.location.pathname);
            return;
        }

        try {
            const { data, error } = await supabase.from('quotes').select('*').eq('id', id).single();
            if (error) throw error;
            if (!data) throw new Error("Orçamento não encontrado.");

            const quoteDetails = data.quote_data || {};
            currentQuote = {
                ...currentQuote,
                ...quoteDetails,
                id: data.id,
                client_name: data.client_name,
                status: data.status,
                items: (quoteDetails.items || []).map((item, index) => ({
                    ...item,
                    id: `loaded-${id}-${index}-${item.service_id || index}`
                })),
            };

            document.getElementById('clientName').value = currentQuote.client_name || '';
            document.getElementById('clientCnpj').value = currentQuote.client_cnpj || '';
            document.getElementById('clientEmail').value = currentQuote.client_email || '';
            document.getElementById('clientPhone').value = currentQuote.client_phone || '';
            document.getElementById('guestCount').value = currentQuote.guest_count || 100;
            document.getElementById('priceTableSelect').value = currentQuote.price_table_id || '';
            document.getElementById('discountValue').value = (currentQuote.discount_general || 0).toFixed(2);

            const datesContainer = document.getElementById('event-dates-container');
            if (datesContainer) {
                datesContainer.innerHTML = '';
                if (currentQuote.event_dates && currentQuote.event_dates.length > 0) {
                    currentQuote.event_dates.forEach(dateData => addDateEntry(dateData));
                }
            }
            
        } catch (error) {
            console.error("Erro ao carregar orçamento:", error);
            showNotification(`Erro ao carregar orçamento ID ${id}. Iniciando novo.`, true);
            window.history.pushState({}, '', window.location.pathname);
        }
    }

    initialize();
});
