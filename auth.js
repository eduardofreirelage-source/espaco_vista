
import { supabase, getSession } from './supabase-client.js';

// =================================================================
// FUNÇÃO DE ANIMAÇÃO (JS Slide Toggle) - CORREÇÃO DE LAYOUT
// Necessária para animar a altura sem impedir o overflow horizontal quando aberto.
// =================================================================
function slideToggle(element) {
    // Previne múltiplas animações simultâneas
    if (element.dataset.animating === 'true') return;
    
    const content = element.querySelector('.card-content');
    if (!content) return;

    element.dataset.animating = 'true';
    const isCollapsed = element.classList.contains('collapsed');
    const duration = 300; // Duração da animação em ms

    if (isCollapsed) {
        // EXPANDINDO
        element.classList.remove('collapsed');
        content.style.display = 'block';
        const height = content.scrollHeight;
        content.style.height = '0px';
        content.style.overflow = 'hidden'; // Esconder durante a animação
        content.style.transition = `height ${duration}ms ease-out`;
        
        // Usamos double requestAnimationFrame para garantir que o navegador processe o display:block antes de animar a altura
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                 content.style.height = height + 'px';
            });
        });

        // Após a animação
        setTimeout(() => {
            content.style.height = 'auto';
            content.style.overflow = 'visible'; // CRUCIAL: Restaurar após a animação!
            content.style.transition = '';
            element.dataset.animating = 'false';
        }, duration);

    } else {
        // COLAPSANDO
        const height = content.scrollHeight;
        content.style.height = height + 'px';
        content.style.overflow = 'hidden'; // Esconder durante a animação
        content.style.transition = `height ${duration}ms ease-out`;

        // Usamos double requestAnimationFrame para garantir que o navegador processe a altura atual antes de animar para 0
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                content.style.height = '0px';
            });
        });

        // Após a animação
        setTimeout(() => {
            element.classList.add('collapsed');
            content.style.display = 'none';
            content.style.height = 'auto'; // Resetar
            content.style.overflow = 'visible'; // Resetar
            content.style.transition = '';
            element.dataset.animating = 'false';
        }, duration);
    }
}


document.addEventListener('DOMContentLoaded', async () => {
    if (!document.querySelector('.tabs-nav')) return;

    // A verificação de sessão e redirecionamento devem ser mantidos
    /*
    const { role } = await getSession();
    if (role !== 'admin') {
        window.location.href = 'login.html';
        return;
    }
    */

    // ESTADO GLOBAL
    let services = [], priceTables = [], servicePrices = [], quotes = [], paymentMethods = [], cardapioItems = [], cardapioComposition = [], units = [];
    let selectedCardapioId = null;
    let calendarInstance = null;

    // SELETORES DO DOM
    const notification = document.getElementById('save-notification');
    const adminCatalogContainer = document.getElementById('admin-catalog-container');
    const selectCardapioToEdit = document.getElementById('select-cardapio-to-edit');
    const compositionSection = document.getElementById('composition-section');
    const editingCardapioName = document.getElementById('editing-cardapio-name');
    const selectItemToAdd = document.getElementById('select-item-to-add');
    const serviceUnitSelect = document.getElementById('serviceUnit');
    const analyticsContainer = document.getElementById('analytics-container');
    const analyticsNotice = document.getElementById('analytics-notice');
    const calendarEl = document.getElementById('calendar');

    // =================================================================
    // FUNÇÕES UTILITÁRIAS (Código original preservado)
    // =================================================================
    function showNotification(message, isError = false) {
        if (!notification) return;
        notification.textContent = message;
        notification.style.backgroundColor = isError ? 'var(--danger-color)' : 'var(--success-color)';
        notification.classList.add('show');
        setTimeout(() => notification.classList.remove('show'), 5000);
    }
    
    function showFlash(inputElement) {
        if (inputElement) {
            inputElement.classList.add('success-flash');
            setTimeout(() => inputElement.classList.remove('success-flash'), 1500);
        }
    }

    function createUnitSelect(currentUnit) {
        if (!units || units.length === 0) return `<input type="text" class="editable-input" data-field="unit" value="${currentUnit || ''}">`;
        return `<select class="editable-input" data-field="unit">${units.map(unit => `<option value="${unit.name}" ${unit.name === currentUnit ? 'selected' : ''}>${unit.name}</option>`).join('')}</select>`;
    }

    function aggregateQuoteMetrics(quoteArray) {
        const initialMetrics = { 'Ganho': { count: 0, value: 0 }, 'Perdido': { count: 0, value: 0 }, 'Em analise': { count: 0, value: 0 }, 'Rascunho': { count: 0, value: 0 } };
        return quoteArray.reduce((acc, quote) => { if (acc[quote.status]) { acc[quote.status].count++; acc[quote.status].value += parseFloat(quote.total_value || 0); } return acc; }, initialMetrics);
    }

    function createKpiCard(title, current, previous) {
        const calculatePercentageChange = (current, previous) => {
            if (previous === 0) { return current > 0 ? '+∞%' : '0%'; }
            const change = ((current - previous) / previous) * 100;
            return `${change > 0 ? '+' : ''}${change.toFixed(0)}%`;
        };
        const percentageChange = calculatePercentageChange(current.value, previous.value);
        const trendClass = percentageChange.startsWith('+') && parseFloat(percentageChange) > 0 ? 'increase' : percentageChange.startsWith('-') ? 'decrease' : '';
        const trendIndicator = trendClass ? `<span class="percentage ${trendClass}">${percentageChange}</span>` : '';
        const formatCurrency = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
        return `<div class="kpi-card"><div class="kpi-title">${title} (Mês Atual)</div><div class="kpi-value">${formatCurrency(current.value)}</div><div class="kpi-sub-value">${current.count} propostas</div><div class="kpi-comparison">${trendIndicator}<span>em relação ao mês anterior (${formatCurrency(previous.value)})</span></div></div>`;
    }

    // =================================================================
    // INICIALIZAÇÃO E DADOS
    // =================================================================
    async function initialize() {
        addEventListeners();
        // await fetchData(); // Descomente quando integrar com Supabase
    }

    async function fetchData() {
        // ... (Lógica de fetchData como no original) ...
    }
    
    // =================================================================
    // RENDERIZAÇÃO
    // =================================================================
    // ... (Funções de renderização como renderAll, renderSimpleTable, etc.) ...

    // =================================================================
    // EVENT LISTENERS (Integração da Animação JS)
    // =================================================================
    
    function addEventListeners() {
        // Listener Global de Cliques (Delega eventos)
        document.addEventListener('click', handleGlobalClicks);

        // ... (Outros listeners específicos de formulários, inputs, etc.) ...
    }

    function handleGlobalClicks(e) {
        // 1. Troca de Abas (Tabs)
        const tabBtn = e.target.closest('.tab-btn');
        if (tabBtn) {
            document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
            tabBtn.classList.add('active');
            const tabId = tabBtn.dataset.tab;
            document.getElementById(`tab-content-${tabId}`).classList.add('active');
            // if (tabId === 'calendar') renderCalendar();
            // if (tabId === 'analytics') renderAnalytics();
            return;
        }

        // 2. CORREÇÃO: Cards Colapsáveis (Integração da Animação JS)
        const header = e.target.closest('.collapsible-card > .card-header');
        if (header) {
            const card = header.parentElement;
            slideToggle(card); // Chama a função de animação JS
            return;
        }

        // 3. Ações de Tabela (Deletar, Editar, etc.)
        // ... (Lógica para ações de tabela) ...
    }

    // =================================================================
    // RESTANTE DA LÓGICA (Analytics, Calendar, CRUD operations)
    // =================================================================
    
    function renderAnalytics() {
        // ... (Lógica de renderAnalytics como no original) ...
    }
    
    // ... (Restante das funções CRUD e helpers) ...

    initialize();
});
