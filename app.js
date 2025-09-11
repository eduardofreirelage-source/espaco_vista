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
        if (quoteId) {
            await loadQuote(quoteId);
        } 
        
        if (currentQuote.event_dates.length === 0) {
            addDateEntry();
        }
        
        renderQuote();
        setDirty(false);
    }

    // (Funções checkUserRole e fetchData permanecem idênticas)
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

    // =================================================================
    // FUNÇÕES UTILITÁRIAS (Idênticas)
    // =================================================================
    
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

    // =================================================================
    // GERENCIAMENTO DE DADOS DO CLIENTE E EVENTO (Idênticas)
    // =================================================================
    
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
        div.innerHTML = `
            <input type="date" value="${data.date || ''}" required>
            <input type="time" class="start-time" value="${data.start || '19:00'}">
            <input type="time" class="end-time" value="${data.end || '23:00'}">
            <span></span>
            <button type="button" class="btn-icon remove-date-btn">&times;</button>
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

    // =================================================================
    // LÓGICA DE CÁLCULO DO ORÇAMENTO (Idêntica)
    // =================================================================
    
    function calculateQuote() {
        let subtotal = 0;
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
            subtotal += total;
        });

        const discountGeneral = userRole === 'admin' ? (parseFloat(currentQuote.discount_general) || 0) : 0;
        
        let consumableCredit = 0;
        if (userRole === 'admin' && priceTableId) {
            const table = priceTables.find(t => t.id === priceTableId);
            consumableCredit = table ? (parseFloat(table.consumable_credit) || 0) : 0;
        }

        const total = subtotal - discountGeneral - consumableCredit;

        return { subtotal, consumableCredit, discountGeneral, total: Math.max(0, total) };
    }


    // =================================================================
    // RENDERIZAÇÃO DO ORÇAMENTO (Ajustada para o novo fluxo)
    // =================================================================

    function renderQuote() {
        const calculation = calculateQuote();
        renderCategories(calculation);
        renderSummary(calculation);
        // NOVO: Se o modal estiver aberto, atualiza o estado dos botões nele
        if (catalogModal.style.display === 'block') {
            updateCatalogButtonsState();
        }
    }

    // MODIFICADO: Agora só renderiza categorias que possuem itens no orçamento
    function renderCategories(calculation) {
        const container = document.getElementById('quote-categories-container');
        if (!container) return;

        // Apenas categorias que possuem itens no orçamento atual
        const categoriesInQuote = [...new Set(currentQuote.items.map(item => {
             const service = services.find(s => s.id === item.service_id);
             return service?.category;
        }).filter(Boolean))].sort();

        // Remove acordeões de categorias que não estão mais no orçamento
        container.querySelectorAll('.category-accordion').forEach(accordion => {
            const categoryName = accordion.dataset.category;
            if (!categoriesInQuote.includes(categoryName)) {
                accordion.remove();
            }
        });

        // Renderiza ou atualiza as categorias presentes
        categoriesInQuote.forEach(category => {
            let accordion = container.querySelector(`details[data-category="${category}"]`);
            if (!accordion) {
                const template = document.getElementById('category-template').content.cloneNode(true);
                accordion = template.querySelector('details');
                accordion.dataset.category = category;
                accordion.querySelector('.category-title').textContent = category;
                container.appendChild(accordion);
                // setupMultiselect foi removido!
            }
            renderItems(accordion, category);
        });

        // Exibe mensagem se não houver itens
        if (categoriesInQuote.length === 0) {
            container.innerHTML = '<p style="padding: 1.2rem; text-align: center; color: var(--subtle-text-color);">Nenhum item adicionado ainda. Clique em "+ Adicionar Itens" para começar.</p>';
        }
    }

    // (renderItems, renderDateSelect, renderSummary permanecem idênticas)
    function renderItems(accordion, category) {
        const tbody = accordion.querySelector('tbody');
        tbody.innerHTML = '';
        const items = currentQuote.items.filter(item => {
            const service = services.find(s => s.id === item.service_id);
            return service && service.category === category;
        });

        items.forEach(item => {
            const service = services.find(s => s.id === item.service_id);
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
                    <button class="btn-icon obs-btn" title="Observações">${item.observations ? '📝' : '📄'}</button>
                    <button class="btn-icon remove-item-btn">&times;</button>
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
        if(document.getElementById('subtotalValue')) document.getElementById('subtotalValue').textContent = formatCurrency(calculation.subtotal);
        if(document.getElementById('consumableValue')) document.getElementById('consumableValue').textContent = formatCurrency(calculation.consumableCredit);
        if(document.getElementById('discountValue')) document.getElementById('discountValue').value = calculation.discountGeneral.toFixed(2);
        if(document.getElementById('totalValue')) document.getElementById('totalValue').textContent = formatCurrency(calculation.total);

        if(document.getElementById('summary-subtotal-value')) document.getElementById('summary-subtotal-value').textContent = formatCurrency(calculation.subtotal);
        if(document.getElementById('summary-consumable-value')) document.getElementById('summary-consumable-value').textContent = formatCurrency(calculation.consumableCredit);
        if(document.getElementById('summary-discount-value')) document.getElementById('summary-discount-value').textContent = formatCurrency(calculation.discountGeneral);
        if(document.getElementById('summary-total-value')) document.getElementById('summary-total-value').textContent = formatCurrency(calculation.total);

        const categoryList = document.getElementById('summary-categories-list');
        if (!categoryList) return;

        categoryList.innerHTML = '';
        const categoriesInQuote = [...new Set(currentQuote.items.map(item => {
            const service = services.find(s => s.id === item.service_id);
            return service ? service.category : null;
        }).filter(Boolean))].sort();

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
    // NOVO: LÓGICA DO MODAL DE CATÁLOGO
    // =================================================================

    let activeCategory = 'Todos';
    let searchQuery = '';

    function openCatalogModal() {
        if (currentQuote.event_dates.length === 0) {
            alert("Por favor, adicione pelo menos uma data de evento antes de adicionar itens.");
            return;
        }
        
        // Reseta o estado do modal ao abrir
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
        // Cria a lista de categorias incluindo a opção "Todos"
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

        // Aplica filtro de categoria
        if (activeCategory !== 'Todos') {
            filteredServices = filteredServices.filter(s => s.category === activeCategory);
        }

        // Aplica filtro de busca
        if (searchQuery) {
            filteredServices = filteredServices.filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase()));
        }

        // Data padrão para verificar se o item já foi adicionado (primeira data do evento)
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

    // Atualiza o estado dos botões no catálogo (caso algo mude enquanto ele está aberto)
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

    // MODIFICADO: Agora lida com um ID por vez, vindo do modal
    function addItemsToQuote(serviceId) {
        
        if (currentQuote.event_dates.length === 0) return;

        const defaultDate = currentQuote.event_dates[0].date;

        // Verifica duplicatas na data padrão
        const existing = currentQuote.items.find(item => item.service_id === serviceId && item.event_date === defaultDate);
        if (existing) {
            return;
        }

        const newItem = {
            id: Date.now() + '-' + serviceId, // ID temporário local
            service_id: serviceId,
            quantity: 1,
            discount_percent: 0,
            event_date: defaultDate,
            observations: ''
        };
        currentQuote.items.push(newItem);
        
        setDirty(true);
        renderQuote(); // Isso também atualizará o botão no modal via updateCatalogButtonsState
    }

    // (updateItem, removeItem, showObsPopover permanecem idênticas)
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
        // Ajuste básico para tentar manter o popover na tela
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
            // Importante: Re-renderizar para atualizar o ícone (📝 ou 📄)
            renderQuote(); 
        };
    }


    // =================================================================
    // EVENT LISTENERS
    // =================================================================
    
    function setupEventListeners() {
        // Listeners de Formulário (Idênticos)
         document.querySelectorAll('#clientName, #clientCnpj, #clientEmail, #clientPhone').forEach(input => {
            input.addEventListener('change', syncClientData);
        });
        
        document.querySelectorAll('#guestCount, #priceTableSelect').forEach(input => {
             input.addEventListener('change', () => {
                syncClientData();
                renderQuote(); 
            });
        });

        // Gerenciamento de datas (Idênticos)
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

        // Delegação de eventos para itens do orçamento (Idênticos)
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

        // Desconto geral (Rodapé) (Idêntico)
        document.getElementById('discountValue')?.addEventListener('change', (e) => {
            if (userRole === 'admin') {
                currentQuote.discount_general = parseFloat(e.target.value) || 0;
                setDirty(true);
                renderQuote();
            } else {
                e.target.value = 0;
            }
        });

        // Listeners Globais (Ajustado para remover Multiselect)
        document.addEventListener('click', (e) => {
            // Fecha Popover de Observações
            const popover = document.getElementById('obs-popover');
            if (popover && popover.classList.contains('show') && !popover.contains(e.target) && !e.target.classList.contains('obs-btn')) {
                popover.classList.remove('show');
            }
        });

        // Salvar e Imprimir (Idêntico)
        document.getElementById('save-quote-btn')?.addEventListener('click', saveQuote);
        document.getElementById('print-btn')?.addEventListener('click', () => {
             window.print();
        });

        // NOVO: Listeners do Catálogo Modal
        document.getElementById('open-catalog-btn')?.addEventListener('click', openCatalogModal);
        document.getElementById('close-catalog-btn')?.addEventListener('click', closeCatalogModal);
        
        // Fechar modal ao clicar fora
        window.addEventListener('click', (event) => {
            if (event.target == catalogModal) {
                closeCatalogModal();
            }
        });

        // Busca no Catálogo (com debounce simples)
        let searchTimeout;
        document.getElementById('catalog-search')?.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                 searchQuery = e.target.value;
                 renderCatalogItems();
            }, 300);
        });

        // Troca de Abas de Categoria
        document.getElementById('catalog-categories')?.addEventListener('click', (e) => {
            const tab = e.target.closest('.catalog-category-tab');
            if (tab) {
                activeCategory = tab.dataset.category;
                renderCatalog();
            }
        });

        // Adicionar Item do Catálogo
        document.getElementById('catalog-items')?.addEventListener('click', (e) => {
            const button = e.target.closest('.btn-add-item');
            if (button && !button.disabled) {
                const serviceId = button.dataset.serviceId;
                addItemsToQuote(serviceId);
            }
        });
    }


    // =================================================================
    // PERSISTÊNCIA (SALVAR E CARREGAR) (Idênticas)
    // =================================================================
    
    async function saveQuote() {
        syncClientData();

        if (currentQuote.items.length === 0) {
            // Verifica se há algo para mostrar antes de notificar
            if (document.getElementById('quote-categories-container').children.length > 0) {
                showNotification("Adicione itens antes de salvar ou enviar.", true);
            }
            return;
        }

        const calculation = calculateQuote();
        const dataToSave = {
            ...currentQuote,
            items: currentQuote.items.map(item => {
                const { id, ...rest } = item;
                return rest;
            }),
            total_value: calculation.total,
            subtotal_value: calculation.subtotal,
            consumable_credit_used: calculation.consumableCredit,
        };

        // Lógica Cliente vs Admin (Limpeza de dados sensíveis)
        if (userRole === 'client') {
            dataToSave.id = null; 
            dataToSave.status = 'Solicitado pelo Cliente';
            dataToSave.price_table_id = null;
            dataToSave.discount_general = 0;
            dataToSave.total_value = 0;
            dataToSave.subtotal_value = 0;
            dataToSave.consumable_credit_used = 0;
            dataToSave.items.forEach(item => {
                item.discount_percent = 0;
                item.calculated_unit_price = 0;
                item.calculated_total = 0;
            });

        } else if (userRole === 'admin' && !isDirty) {
            return; 
        }

        try {
            let result;
            if (dataToSave.id) {
                // UPDATE
                const { data, error } = await supabase.from('quotes').update(dataToSave).eq('id', dataToSave.id).select().single();
                result = { data, error };
            } else {
                // INSERT
                const { data, error } = await supabase.from('quotes').insert(dataToSave).select().single();
                result = { data, error };
            }

            if (result.error) throw result.error;

            currentQuote.id = result.data.id;
            
            if (userRole === 'client') {
                showNotification('Solicitação enviada com sucesso! Entraremos em contato.');
            } else {
                showNotification('Orçamento salvo com sucesso!');
                setDirty(false);
                if (window.location.search.indexOf('quote_id') === -1) {
                    window.history.pushState({}, '', `?quote_id=${currentQuote.id}`);
                }
            }

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

            currentQuote = {
                ...data,
                items: (data.items || []).map((item, index) => ({
                    ...item,
                    id: `loaded-${index}-${item.service_id || index}`
                })),
                event_dates: data.event_dates || [],
                discount_general: parseFloat(data.discount_general) || 0,
                guest_count: parseInt(data.guest_count) || 100,
            };

            // Popula o UI
            if(document.getElementById('clientName')) document.getElementById('clientName').value = currentQuote.client_name || '';
            if(document.getElementById('clientCnpj')) document.getElementById('clientCnpj').value = currentQuote.client_cnpj || '';
            if(document.getElementById('clientEmail')) document.getElementById('clientEmail').value = currentQuote.client_email || '';
            if(document.getElementById('clientPhone')) document.getElementById('clientPhone').value = currentQuote.client_phone || '';
            if(document.getElementById('guestCount')) document.getElementById('guestCount').value = currentQuote.guest_count;
            if(document.getElementById('priceTableSelect')) document.getElementById('priceTableSelect').value = currentQuote.price_table_id || '';

            const datesContainer = document.getElementById('event-dates-container');
            if (datesContainer) {
                datesContainer.innerHTML = '';
                if (currentQuote.event_dates.length > 0) {
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
