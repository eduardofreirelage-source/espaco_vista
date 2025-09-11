import { supabase, getSession } from './supabase-client.js';

document.addEventListener('DOMContentLoaded', async () => {
    // =================================================================
    // VERIFICAÇÃO DE ACESSO
    // =================================================================
    const { role } = await getSession();
    if (role !== 'admin') {
        // Se não for admin, redireciona para a página de login.
        console.warn("Acesso negado ao painel administrativo. Redirecionando para login.");
        window.location.href = 'login.html';
        return; // Interrompe a execução do restante do script admin
    }

    // =================================================================
    // LÓGICA DO PAINEL ADMINISTRATIVO
    // =================================================================

    // ESTADO
    let services = [];
    let priceTables = [];
    let servicePrices = [];
    let quotes = [];

    // ELEMENTOS DO DOM
    const servicesTbody = document.getElementById('services-table')?.querySelector('tbody');
    const priceTablesTbody = document.getElementById('price-tables-list')?.querySelector('tbody');
    const quotesTbody = document.getElementById('quotes-table')?.querySelector('tbody');
    const addServiceForm = document.getElementById('addServiceForm');
    const addPriceTableForm = document.getElementById('addPriceTableForm');
    const editPricesModal = document.getElementById('editPricesModal');
    const editPricesForm = document.getElementById('editPricesForm');
    const notification = document.getElementById('save-notification');

    // --- INICIALIZAÇÃO ---
    async function initialize() {
        await fetchData();
        addEventListeners();
    }

    async function fetchData() {
        try {
            const [servicesRes, tablesRes, pricesRes, quotesRes] = await Promise.all([
                supabase.from('services').select('*').order('name'),
                supabase.from('price_tables').select('*').order('name'),
                supabase.from('service_prices').select('*'),
                // Busca os dados essenciais dos orçamentos para a listagem
                supabase.from('quotes').select('id, client_name, created_at, status, total_value').order('created_at', { ascending: false })
            ]);

            if (servicesRes.error) throw servicesRes.error;
            if (tablesRes.error) throw tablesRes.error;
            if (pricesRes.error) throw pricesRes.error;
            if (quotesRes.error) throw quotesRes.error;

            services = servicesRes.data || [];
            priceTables = tablesRes.data || [];
            servicePrices = pricesRes.data || [];
            quotes = quotesRes.data || [];

            renderAll();
        } catch (error) {
            console.error("Erro ao carregar dados:", error.message);
            showNotification("Erro ao carregar dados. Verifique se as tabelas existem no banco de dados.", true);
        }
    }

    // --- RENDERIZAÇÃO ---
    function renderAll() {
        if (servicesTbody) renderServicesTable();
        if (priceTablesTbody) renderPriceTablesList();
        if (quotesTbody) renderQuotesTable();
    }

    function renderServicesTable() {
        servicesTbody.innerHTML = '';
        services.forEach(service => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${service.name}</td>
                <td>${service.category}</td>
                <td class="actions">
                    <button class="btn" data-action="edit-prices" data-id="${service.id}">Editar Preços</button>
                    <button class="btn-remove" data-action="delete-service" data-id="${service.id}" title="Excluir Serviço">&times;</button>
                </td>
            `;
            servicesTbody.appendChild(row);
        });
    }
    
    function renderPriceTablesList() {
        priceTablesTbody.innerHTML = '';
        priceTables.forEach(table => {
            const row = document.createElement('tr');
            const consumable = table.consumable_credit || 0;
            const formattedConsumable = parseFloat(consumable).toFixed(2).replace('.', ',');
            row.innerHTML = `
                <td>${table.name}</td>
                <td>R$ ${formattedConsumable}</td>
                <td class="actions">
                    <button class="btn-remove" data-action="delete-table" data-id="${table.id}" title="Excluir Lista">&times;</button>
                </td>
            `;
            priceTablesTbody.appendChild(row);
        });
    }

    function renderQuotesTable() {
        quotesTbody.innerHTML = '';
        quotes.forEach(quote => {
            const row = document.createElement('tr');
            const createdAt = new Date(quote.created_at).toLocaleDateString('pt-BR');
            //const totalValue = quote.total_value || 0;
            //const formattedTotal = parseFloat(totalValue).toFixed(2).replace('.', ',');

            // O HTML original do admin.html fornecido no início não tinha a coluna de Valor Total no THEAD.
            // Se você adicionou essa coluna no HTML, descomente as linhas acima e adicione o TD abaixo.
            row.innerHTML = `
                <td>${quote.client_name || 'Rascunho sem nome'}</td>
                <td>${createdAt}</td>
                <td><span class="status">${quote.status}</span></td>
                <td class="actions">
                    <a href="index.html?quote_id=${quote.id}" class="btn">Carregar</a>
                    <button class="btn-remove" data-action="delete-quote" data-id="${quote.id}" title="Excluir Orçamento">&times;</button>
                </td>
            `;
            quotesTbody.appendChild(row);
        });
    }

    // --- LÓGICA DO MODAL E EVENT LISTENERS ---
    function openEditPricesModal(serviceId) {
        const service = services.find(s => s.id === serviceId);
        if (!service) return;
        document.getElementById('editPricesModalTitle').textContent = `Preços para: ${service.name}`;
        
        editPricesForm.innerHTML = '';
        priceTables.forEach(table => {
            const priceRecord = servicePrices.find(p => p.service_id === serviceId && p.price_table_id === table.id);
            const price = priceRecord ? priceRecord.price : 0;
            const div = document.createElement('div');
            div.className = 'form-group';
            div.innerHTML = `
                <label>${table.name}</label>
                <input type="number" value="${parseFloat(price).toFixed(2)}" step="0.01" data-table-id="${table.id}">
            `;
            editPricesForm.appendChild(div);
        });

        document.getElementById('savePricesButton').dataset.serviceId = serviceId;
        editPricesModal.style.display = 'block';
    }

    function addEventListeners() {
        addServiceForm?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const newService = {
                name: document.getElementById('serviceName').value,
                category: document.getElementById('serviceCategory').value,
                unit: document.getElementById('serviceUnit').value,
            };
            const { error } = await supabase.from('services').insert([newService]);
            if(error) { showNotification(`Erro: ${error.message}`, true); } 
            else { showNotification('Serviço adicionado!'); e.target.reset(); fetchData(); }
        });
        
        addPriceTableForm?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const newTable = { 
                name: document.getElementById('tableName').value,
                consumable_credit: parseFloat(document.getElementById('tableConsumable').value) || 0
            };
            const { error } = await supabase.from('price_tables').insert([newTable]);
            if(error) { showNotification(`Erro: ${error.message}`, true); } 
            else { showNotification('Lista de preços adicionada!'); e.target.reset(); fetchData(); }
        });

        document.body.addEventListener('click', e => {
            const button = e.target.closest('button');
            if (!button) return;

            const { action, id } = button.dataset;
            if (action === 'edit-prices') openEditPricesModal(id);
            if (action === 'delete-service') deleteService(id);
            if (action === 'delete-table') deletePriceTable(id);
            if (action === 'delete-quote') deleteQuote(id);
        });

        const closeButton = editPricesModal.querySelector('.close-button');
        if (closeButton) closeButton.onclick = () => editPricesModal.style.display = 'none';
        
        // Fecha o modal se clicar fora dele
        window.addEventListener('click', (event) => {
            if (event.target == editPricesModal) {
                editPricesModal.style.display = "none";
            }
        });

        const savePricesButton = document.getElementById('savePricesButton');
        if (savePricesButton) savePricesButton.addEventListener('click', async (e) => {
            const serviceId = e.target.dataset.serviceId;
            const inputs = editPricesForm.querySelectorAll('input');
            
            const recordsToUpsert = Array.from(inputs).map(input => ({
                service_id: serviceId,
                price_table_id: input.dataset.tableId,
                price: parseFloat(input.value) || 0
            }));
            
            // Upsert atualiza se existir, insere se não existir
            const { error } = await supabase.from('service_prices').upsert(recordsToUpsert);
            if (error) {
                showNotification(`Erro ao salvar preços: ${error.message}`, true);
            } else {
                showNotification('Preços salvos com sucesso!');
                editPricesModal.style.display = 'none';
                fetchData();
            }
        });
    }

    // --- FUNÇÕES DE AÇÃO (CRUD) ---
    async function deleteService(id) {
        if (!confirm('Tem certeza? Isso excluirá o serviço e todos os seus preços.')) return;
        const { error } = await supabase.from('services').delete().eq('id', id);
        if(error) { showNotification(`Erro: ${error.message}`, true); } else { showNotification('Serviço excluído.'); fetchData(); }
    }
    
    async function deletePriceTable(id) {
        if (!confirm('Tem certeza? Isso excluirá a lista e todos os preços associados a ela.')) return;
        const { error } = await supabase.from('price_tables').delete().eq('id', id);
        if(error) { showNotification(`Erro: ${error.message}`, true); } else { showNotification('Lista de preços excluída.'); fetchData(); }
    }
    
    async function deleteQuote(id) {
        if (!confirm('Tem certeza que deseja excluir este orçamento?')) return;
        const { error } = await supabase.from('quotes').delete().eq('id', id);
        if(error) { showNotification(`Erro: ${error.message}`, true); } else { showNotification('Orçamento excluído.'); fetchData(); }
    }

    // --- FUNÇÃO DE NOTIFICAÇÃO ---
    function showNotification(message, isError = false) {
        if (!notification) return;
        notification.textContent = message;
        // Usa as variáveis CSS definidas no admin.css
        notification.style.backgroundColor = isError ? 'var(--danger-color, #dc3545)' : 'var(--success-color, #28a745)';
        notification.classList.add('show');
        setTimeout(() => notification.classList.remove('show'), 5000);
    }

    initialize();
});
