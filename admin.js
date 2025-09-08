import { supabase } from './supabase-client.js';

document.addEventListener('DOMContentLoaded', () => {
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
                supabase.from('quotes').select('id, client_name, created_at, status').order('created_at', { ascending: false })
            ]);

            if (servicesRes.error) throw servicesRes.error;
            if (tablesRes.error) throw tablesRes.error;
            if (pricesRes.error) throw pricesRes.error;
            if (quotesRes.error) throw quotesRes.error;

            services = servicesRes.data;
            priceTables = tablesRes.data;
            servicePrices = pricesRes.data;
            quotes = quotesRes.data;

            renderAll();
        } catch (error) {
            console.error("Erro ao carregar dados:", error.message);
            showNotification("Erro ao carregar dados.", true);
        }
    }

    // --- RENDERIZAÇÃO ---
    function renderAll() {
        renderServicesTable();
        renderPriceTablesList();
        renderQuotesTable();
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
                    <button class="btn-remove" data-action="delete-service" data-id="${service.id}">&times;</button>
                </td>
            `;
            servicesTbody.appendChild(row);
        });
    }
    
    function renderPriceTablesList() {
        priceTablesTbody.innerHTML = '';
        priceTables.forEach(table => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${table.name}</td>
                <td class="actions">
                    <button class="btn-remove" data-action="delete-table" data-id="${table.id}">&times;</button>
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
            row.innerHTML = `
                <td>${quote.client_name || 'Rascunho'}</td>
                <td>${createdAt}</td>
                <td><span class="status">${quote.status}</span></td>
                <td class="actions">
                    <a href="index.html?quote_id=${quote.id}" class="btn">Carregar</a>
                    <button class="btn-remove" data-action="delete-quote" data-id="${quote.id}">&times;</button>
                </td>
            `;
            quotesTbody.appendChild(row);
        });
    }

    // --- LÓGICA DO MODAL DE EDIÇÃO DE PREÇOS ---
    function openEditPricesModal(serviceId) {
        const service = services.find(s => s.id === serviceId);
        document.getElementById('editPricesModalTitle').textContent = `Preços para: ${service.name}`;
        
        editPricesForm.innerHTML = '';
        priceTables.forEach(table => {
            const priceRecord = servicePrices.find(p => p.service_id === serviceId && p.price_table_id === table.id);
            const price = priceRecord ? priceRecord.price : 0;
            const div = document.createElement('div');
            div.className = 'form-group';
            div.innerHTML = `
                <label>${table.name}</label>
                <input type="number" value="${price.toFixed(2)}" step="0.01" data-table-id="${table.id}">
            `;
            editPricesForm.appendChild(div);
        });

        document.getElementById('savePricesButton').dataset.serviceId = serviceId;
        editPricesModal.style.display = 'block';
    }

    // --- EVENT LISTENERS ---
    function addEventListeners() {
        // ... (Listeners para os formulários de adicionar serviço/tabela)

        document.body.addEventListener('click', e => {
            const button = e.target.closest('button');
            if (!button) return;

            const { action, id } = button.dataset;
            if (action === 'edit-prices') openEditPricesModal(id);
            if (action === 'delete-service') deleteService(id);
            if (action === 'delete-table') deletePriceTable(id);
            if (action === 'delete-quote') deleteQuote(id);
        });

        editPricesModal.querySelector('.close-button').onclick = () => editPricesModal.style.display = 'none';

        document.getElementById('savePricesButton').addEventListener('click', async (e) => {
            const serviceId = e.target.dataset.serviceId;
            const inputs = editPricesForm.querySelectorAll('input');
            
            const recordsToUpsert = Array.from(inputs).map(input => ({
                service_id: serviceId,
                price_table_id: input.dataset.tableId,
                price: parseFloat(input.value) || 0
            }));
            
            const { error } = await supabase.from('service_prices').upsert(recordsToUpsert);
            if (error) {
                showNotification(`Erro ao salvar preços: ${error.message}`, true);
            } else {
                showNotification('Preços salvos com sucesso!');
                editPricesModal.style.display = 'none';
                fetchData(); // Recarrega os preços
            }
        });
    }

    // ... (funções de delete, notificações, etc.)
    initialize();
});
