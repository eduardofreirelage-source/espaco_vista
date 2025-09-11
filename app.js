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
    let userRole = 'client'; // Padrão é cliente
    let isDirty = false;

    const notification = document.getElementById('save-notification');

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
            adminLink.style.display = 'inline-block';
            logoutBtn.style.display = 'inline-block';
            loginLink.style.display = 'none';
            mainTitle.textContent = 'Gerador de Propostas (Admin)';
        } else {
            // Aplica a visão restrita para clientes
            document.body.classList.add('client-view');
            adminLink.style.display = 'none';
            logoutBtn.style.display = 'none';
            loginLink.style.display = 'inline-block';
            mainTitle.textContent = 'Solicitação de Orçamento (Cliente)';
            saveBtn.textContent = 'Enviar Solicitação';
            currentQuote.status = 'Solicitado'; // Muda o status padrão para cliente
        }
    }

    async function fetchData() {
        try {
            const [servicesRes, tablesRes, pricesRes] = await Promise.all([
                supabase.from('services').select('*').order('category').order('name'),
                supabase.from('price_tables').select('*').order('name'),
                supabase.from('service_prices').select('*')
            ]);

            if (servicesRes.error) throw servicesRes.error;
            if (tablesRes.error) throw tablesRes.error;
            if (pricesRes.error) throw pricesRes.error;

            services = servicesRes.data;
            priceTables = tablesRes.data;
            servicePrices = pricesRes.data;
        } catch (error) {
            console.error("Erro ao carregar dados:", error);
            showNotification("Erro ao carregar dados iniciais.", true);
        }
    }

    // =================================================================
    // FUNÇÕES UTILITÁRIAS
    // =================================================================
    
    function setDirty(state) {
        isDirty = state;
        updateSaveButtonState();
    }

    function updateSaveButtonState() {
        const saveBtn = document.getElementById('save-quote-btn');
        if (userRole === 'admin') {
            if (isDirty) {
                saveBtn.classList.add('dirty');
                saveBtn.textContent = 'Salvar Alterações*';
            } else {
                saveBtn.classList.remove('dirty');
                saveBtn.textContent = 'Salvo';
            }
        }
        // Para cliente, o botão é sempre "Enviar Solicitação"
    }

    function showNotification(message, isError = false) {
        if (!notification) return;
        notification.textContent = message;
        notification.style.backgroundColor = isError ? 'var(--danger-color, #dc3545)' : 'var(--success-color, #28a745)';
        notification.classList.add('show');
        setTimeout(() => notification.classList.remove('show'), 3000);
    }

    function formatCurrency(value) {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
    }

    // =================================================================
    // GERENCIAMENTO DE DADOS DO CLIENTE E EVENTO
    // =================================================================

    function populatePriceTables() {
        const select = document.getElementById('priceTableSelect');
        select.innerHTML = '<option value="">Selecione uma tabela</option>';
        priceTables.forEach(table => {
            const option = document.createElement('option');
            option.value = table.id;
            option.textContent = table.name;
            select.appendChild(option);
        });
    }

    function syncClientData() {
        currentQuote.client_name = document.getElementById('clientName').value;
        currentQuote.client_cnpj = document.getElementById('clientCnpj').value;
        currentQuote.client_email = document.getElementById('clientEmail').value;
        currentQuote.client_phone = document.getElementById('clientPhone').value;
        currentQuote.guest_count = parseInt(document.getElementById('guestCount').value) || 0;
        currentQuote.price_table_id = document.getElementById('priceTableSelect').value || null;
        syncEventDates();
        setDirty(true);
    }

    function syncEventDates() {
        const container = document.getElementById('event-dates-container');
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
    // LÓGICA DE CÁLCULO DO ORÇAMENTO (Ajustada para Roles)
    // =================================================================

    function calculateQuote() {
        let subtotal = 0;
        const guestCount = currentQuote.guest_count;
        const priceTableId = currentQuote.price_table_id;

        currentQuote.items.forEach(item => {
            const service = services.find(s => s.id === item.service_id);
            if (!service) return;

            // 1. Determinar Preço Base (APENAS SE FOR ADMIN)
            let basePrice = 0;
            if (userRole === 'admin' && priceTableId) {
                const priceRecord = servicePrices.find(p => p.service_id === item.service_id && p.price_table_id === priceTableId);
                basePrice = priceRecord ? priceRecord.price : 0;
            }
            
            // 2. Ajustar Quantidade se for 'por_pessoa'
            let quantity = item.quantity;
            if (service.unit === 'por_pessoa') {
                quantity = guestCount;
                item.quantity = quantity; // Atualiza o estado para refletir no UI
            }

            // 3. Calcular Custo do Item
            const cost = basePrice * quantity;

            // 4. Aplicar Desconto (APENAS SE FOR ADMIN)
            const discountRate = (userRole === 'admin' ? (item.discount_percent || 0) : 0) / 100;
            const total = cost * (1 - discountRate);

            item.calculated_unit_price = basePrice;
            item.calculated_total = total;
            subtotal += total;
        });

        const discountGeneral = userRole === 'admin' ? currentQuote.discount_general : 0;
        
        let consumableCredit = 0;
        if (userRole === 'admin' && priceTableId) {
            const table = priceTables.find(t => t.id === priceTableId);
            consumableCredit = table ? (table.consumable_credit || 0) : 0;
        }

        const total = subtotal - discountGeneral - consumableCredit;

        return { subtotal, consumableCredit, discountGeneral, total: Math.max(0, total) };
    }

    // =================================================================
    // RENDERIZAÇÃO DO ORÇAMENTO
    // =================================================================

    function renderQuote() {
        const calculation = calculateQuote();
        renderCategories(calculation);
        renderSummary(calculation);
    }

    function renderCategories(calculation) {
        const container = document.getElementById('quote-categories-container');
        const categories = [...new Set(services.map(s => s.category))];
        
        // Limpa categorias antigas que possam não existir mais
        container.querySelectorAll('.category-accordion').forEach(accordion => {
            const categoryName = accordion.dataset.category;
            if (!categories.includes(categoryName)) {
                accordion.remove();
            }
        });

        categories.forEach(category => {
            let accordion = container.querySelector(`details[data-category="${category}"]`);
            if (!accordion) {
                const template = document.getElementById('category-template').content.cloneNode(true);
                accordion = template.querySelector('details');
                accordion.dataset.category = category;
                accordion.querySelector('.category-title').textContent = category;
                container.appendChild(accordion);
                setupMultiselect(accordion, category);
            }
            renderItems(accordion, category);
        });
    }

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

            // Usamos as classes definidas no HTML/CSS para controle de visibilidade
            // Adicionamos a classe .price nas células de valor para segurança extra no CSS
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
        // Rodapé
        document.getElementById('subtotalValue').textContent = formatCurrency(calculation.subtotal);
        document.getElementById('consumableValue').textContent = formatCurrency(calculation.consumableCredit);
        document.getElementById('discountValue').value = calculation.discountGeneral.toFixed(2);
        document.getElementById('totalValue').textContent = formatCurrency(calculation.total);

        // Card de Resumo
        document.getElementById('summary-subtotal-value').textContent = formatCurrency(calculation.subtotal);
        document.getElementById('summary-consumable-value').textContent = formatCurrency(calculation.consumableCredit);
        document.getElementById('summary-discount-value').textContent = formatCurrency(calculation.discountGeneral);
        document.getElementById('summary-total-value').textContent = formatCurrency(calculation.total);

        // Resumo por categoria
        const categoryList = document.getElementById('summary-categories-list');
        categoryList.innerHTML = '';
        const categories = [...new Set(currentQuote.items.map(item => {
            const service = services.find(s => s.id === item.service_id);
            return service ? service.category : null;
        }).filter(Boolean))];

        categories.forEach(category => {
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
    // GERENCIAMENTO DE ITENS E MULTISELECT
    // =================================================================

    function setupMultiselect(accordion, category) {
        const container = accordion.querySelector('.multiselect-container');
        const input = container.querySelector('.multiselect-input');
        const dropdown = container.querySelector('.multiselect-dropdown');
        const list = container.querySelector('.multiselect-list');
        const search = container.querySelector('.multiselect-search');
        const addButton = container.querySelector('.btn-add-selected');

        const categoryServices = services.filter(s => s.category === category);

        function renderList(filter = '') {
            list.innerHTML = '';
            const filtered = categoryServices.filter(s => s.name.toLowerCase().includes(filter.toLowerCase()));
            filtered.forEach(service => {
                const item = document.createElement('div');
                item.className = 'multiselect-list-item';
                item.innerHTML = `
                    <label>
                        <input type="checkbox" value="${service.id}">
                        ${service.name}
                    </label>
                `;
                list.appendChild(item);
            });
        }

        input.addEventListener('click', (e) => {
            e.stopPropagation();
            // Fecha outros dropdowns abertos
            document.querySelectorAll('.multiselect-container.open').forEach(c => c.classList.remove('open'));
            container.classList.add('open');
            renderList();
            search.focus();
        });

        search.addEventListener('input', () => {
            renderList(search.value);
        });

        addButton.addEventListener('click', (e) => {
            e.preventDefault();
            const selectedIds = Array.from(list.querySelectorAll('input:checked')).map(input => input.value);
            addItemsToQuote(selectedIds);
            container.classList.remove('open');
            search.value = '';
        });

        dropdown.addEventListener('click', (e) => e.stopPropagation());
    }

    function addItemsToQuote(serviceIds) {
        if (currentQuote.event_dates.length === 0) {
            alert("Por favor, adicione pelo menos uma data de evento antes de adicionar itens.");
            return;
        }

        const defaultDate = currentQuote.event_dates[0].date;

        serviceIds.forEach(serviceId => {
            const existing = currentQuote.items.find(item => item.service_id === serviceId && item.event_date === defaultDate);
            if (existing) {
                return; // Ignora se já existir na mesma data padrão
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
        });
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
        const item = currentQuote.items.find(i => i.id === itemId);
        if (!item) return;

        popover.innerHTML = `
            <textarea id="obs-text">${item.observations || ''}</textarea>
            <button id="save-obs-btn" class="btn">Salvar Observação</button>
        `;

        // Posicionamento básico
        const rect = button.getBoundingClientRect();
        popover.style.position = 'absolute';
        popover.style.top = `${window.scrollY + rect.top}px`;
        popover.style.left = `${rect.left - 310}px`; // Posiciona à esquerda do botão
        popover.classList.add('show');

        document.getElementById('save-obs-btn').onclick = () => {
            const text = document.getElementById('obs-text').value;
            updateItem(itemId, 'observations', text);
            popover.classList.remove('show');
        };
    }

    // =================================================================
    // EVENT LISTENERS
    // =================================================================

    function setupEventListeners() {
        // Sincronização de dados do cliente/evento
        document.querySelectorAll('#clientName, #clientCnpj, #clientEmail, #clientPhone, #guestCount, #priceTableSelect').forEach(input => {
            input.addEventListener('change', () => {
                syncClientData();
                renderQuote(); // Recalcula tudo quando muda convidados ou tabela de preços
            });
        });

        // Gerenciamento de datas
        document.getElementById('add-date-btn').addEventListener('click', () => {
            addDateEntry();
            syncClientData();
            renderQuote();
        });

        document.getElementById('event-dates-container').addEventListener('click', (e) => {
            if (e.target.classList.contains('remove-date-btn')) {
                e.target.closest('.date-entry').remove();
                syncClientData();
                renderQuote();
            }
        });

        // Delegação de eventos para itens do orçamento
        document.getElementById('quote-categories-container').addEventListener('change', (e) => {
            const row = e.target.closest('tr');
            if (!row) return;
            const itemId = row.dataset.itemId;

            if (e.target.classList.contains('qty-input')) {
                updateItem(itemId, 'quantity', e.target.value);
            } else if (e.target.classList.contains('discount-input')) {
                updateItem(itemId, 'discount_percent', e.target.value);
            } else if (e.target.classList.contains('date-select')) {
                updateItem(itemId, 'event_date', e.target.value);
            }
        });

        document.getElementById('quote-categories-container').addEventListener('click', (e) => {
            const row = e.target.closest('tr');
            if (!row) return;
            const itemId = row.dataset.itemId;

            if (e.target.classList.contains('remove-item-btn')) {
                removeItem(itemId);
            } else if (e.target.classList.contains('obs-btn')) {
                e.stopPropagation();
                showObsPopover(e.target, itemId);
            }
        });

        // Desconto geral
        document.getElementById('discountValue').addEventListener('change', (e) => {
            currentQuote.discount_general = parseFloat(e.target.value) || 0;
            setDirty(true);
            renderQuote();
        });

        // Fechar popovers/dropdowns ao clicar fora
        document.addEventListener('click', (e) => {
            document.querySelectorAll('.multiselect-container.open').forEach(container => {
                if (!container.contains(e.target)) {
                    container.classList.remove('open');
                }
            });
            const popover = document.getElementById('obs-popover');
            if (popover.classList.contains('show') && !popover.contains(e.target) && !e.target.classList.contains('obs-btn')) {
                popover.classList.remove('show');
            }
        });

        // Salvar orçamento
        document.getElementById('save-quote-btn').addEventListener('click', saveQuote);

        // Exportar PDF (Funcionalidade básica de impressão)
        document.getElementById('print-btn').addEventListener('click', () => {
             window.print();
        });
    }

    // =================================================================
    // PERSISTÊNCIA (SALVAR E CARREGAR)
    // =================================================================

    async function saveQuote() {
        syncClientData(); // Garante que os dados mais recentes do cliente estão no estado

        if (currentQuote.items.length === 0) {
            showNotification("Adicione itens antes de salvar ou enviar.", true);
            return;
        }

        // Prepara os dados base
        const calculation = calculateQuote();
        const dataToSave = {
            ...currentQuote,
            // Remove IDs temporários dos itens antes de salvar
            items: currentQuote.items.map(item => {
                const { id, ...rest } = item;
                return rest;
            }),
            total_value: calculation.total,
            subtotal_value: calculation.subtotal,
            consumable_credit_used: calculation.consumableCredit,
        };

        if (userRole === 'client') {
            // Para clientes, forçamos a criação de um novo registro e ajustamos o status
            dataToSave.id = null; 
            dataToSave.status = 'Solicitado pelo Cliente';
            
            // Removemos informações de preço sensíveis que o cliente não deve definir
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

        } else if (!isDirty) {
            // Admin só salva se houver mudanças
            return; 
        }

        try {
            let result;
            if (dataToSave.id) {
                // Atualizar existente (Admin)
                const { data, error } = await supabase.from('quotes').update(dataToSave).eq('id', dataToSave.id).select().single();
                result = { data, error };
            } else {
                // Inserir novo (Admin ou Cliente)
                const { data, error } = await supabase.from('quotes').insert(dataToSave).select().single();
                result = { data, error };
            }

            if (result.error) throw result.error;

            currentQuote.id = result.data.id;
            
            if (userRole === 'client') {
                showNotification('Solicitação enviada com sucesso! Entraremos em contato.');
                // Idealmente, limpar o formulário ou redirecionar o cliente aqui
            } else {
                showNotification('Orçamento salvo com sucesso!');
                setDirty(false);
                // Atualiza a URL se for um novo orçamento (Admin)
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
        // Clientes não devem poder carregar orçamentos existentes por segurança
        if (userRole === 'client') {
            console.warn("Clientes não podem carregar orçamentos por ID.");
            window.history.pushState({}, '', window.location.pathname); // Limpa a URL
            return;
        }

        try {
            const { data, error } = await supabase.from('quotes').select('*').eq('id', id).single();
            if (error) throw error;

            // Adapta os dados carregados para o estado local
            currentQuote = {
                ...data,
                // Gera IDs temporários locais para os itens carregados
                items: (data.items || []).map((item, index) => ({
                    ...item,
                    id: `loaded-${index}-${item.service_id || index}`
                })),
                event_dates: data.event_dates || [],
                discount_general: data.discount_general || 0,
            };

            // Popula o UI
            document.getElementById('clientName').value = currentQuote.client_name || '';
            document.getElementById('clientCnpj').value = currentQuote.client_cnpj || '';
            document.getElementById('clientEmail').value = currentQuote.client_email || '';
            document.getElementById('clientPhone').value = currentQuote.client_phone || '';
            document.getElementById('guestCount').value = currentQuote.guest_count || 100;
            document.getElementById('priceTableSelect').value = currentQuote.price_table_id || '';

            // Popula as datas
            const datesContainer = document.getElementById('event-dates-container');
            datesContainer.innerHTML = '';
            if (currentQuote.event_dates.length > 0) {
                currentQuote.event_dates.forEach(dateData => addDateEntry(dateData));
            }
            
        } catch (error) {
            console.error("Erro ao carregar orçamento:", error);
            showNotification(`Erro ao carregar orçamento ID ${id}. Iniciando novo.`, true);
            window.history.pushState({}, '', window.location.pathname);
        }
    }

    initialize();
});
