// Importação corrigida e adicionada verificação de sessão
import { supabase, getSession } from './supabase-client.js';

document.addEventListener('DOMContentLoaded', async () => {
    // Verificação de Acesso
    const { role } = await getSession();
    if (role !== 'admin') {
        // Se não for admin, redireciona para a página de login.
        console.warn("Acesso negado. Redirecionando para login.");
        window.location.href = 'login.html';
        return; // Interrompe a execução do restante do script admin
    }

    // --- O restante da lógica do admin permanece a mesma fornecida originalmente ---

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
                supabase.from('quotes').select('id, client_name, created_at, status').order('created_at', { ascending: false })
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
            showNotification("Erro ao carregar dados.", true);
        }
    }

    // --- RENDERIZAÇÃO (Permanece igual ao original) ---
    function renderAll() {
        if (servicesTbody) renderServicesTable();
        if (priceTablesTbody) renderPriceTablesList();
        if (quotesTbody) renderQuotesTable();
    }

    // ... (As funções renderServicesTable, renderPriceTablesList, renderQuotesTable,
    // openEditPricesModal, addEventListeners, deleteService, deletePriceTable,
    // deleteQuote permanecem as mesmas do código original fornecido)

    // Função de Notificação
    function showNotification(message, isError = false) {
        if (!notification) return;
        notification.textContent = message;
        notification.style.backgroundColor = isError ? 'var(--danger-color)' : 'var(--success-color)';
        notification.classList.add('show');
        setTimeout(() => notification.classList.remove('show'), 3000);
    }

    initialize();
});
