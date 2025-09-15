import { supabase, getSession } from './supabase-client.js';

document.addEventListener('DOMContentLoaded', async () => {
    // =================================================================
    // VERIFICAÇÃO DE ACESSO
    // =================================================================
    /* (Código de verificação de acesso mantido como no original) */

    // =================================================================
    // ESTADO E ELEMENTOS DO DOM
    // =================================================================
    let services = [], priceTables = [], servicePrices = [], quotes = [];
    // 'events' é removido do estado global, usaremos 'quotes' filtrados.
    
    const adminCatalogContainer = document.getElementById('admin-catalog-container');
    // ... (Outros elementos do DOM)
    const analyticsContainer = document.getElementById('analytics-container');
    
    // CORREÇÃO: Elemento do filtro do calendário
    const calendarStatusFilter = document.getElementById('calendar-status-filter');
    
    let debounceTimers = {};
    let calendarInstance = null; 

    // --- INICIALIZAÇÃO ---
    async function initialize() {
        await fetchData();
        addEventListeners();
        populateCalendarFilters(); // Inicializa o filtro do calendário
    }

    async function fetchData() {
        try {
            const [servicesRes, tablesRes, pricesRes, quotesRes] = await Promise.all([
                supabase.from('services').select('*').order('category').order('name'),
                supabase.from('price_tables').select('*').order('name'),
                supabase.from('service_prices').select('*'),
                // Importante selecionar ID e quote_data para o calendário e analytics
                supabase.from('quotes').select('id, *, clients(*)').order('created_at', { ascending: false })
            ]);

            // ... (Verificação de erros)

            services = servicesRes.data || [];
            priceTables = tablesRes.data || [];
            servicePrices = pricesRes.data || [];
            quotes = quotesRes.data || [];

            renderAll();
        } catch (error) {
            // showNotification(...)
        }
    }

    // --- RENDERIZAÇÃO ---
    function renderAll() {
        renderPriceTablesList();
        renderAdminCatalog();
        renderQuotesTable();
        renderEventsTable();
        renderAnalytics();
        // Atualiza o calendário se ele já estiver inicializado
        if (calendarInstance) {
            updateCalendarEvents();
        }
    }
    
    // ... (formatCurrency, renderQuotesTable, renderEventsTable - Mantidos com ajustes necessários para ações)

    // CORREÇÃO (Analytics): Usa a data da última cotação como referência em vez de hoje.
    function renderAnalytics() {
        if (!analyticsContainer) return;
        
        let referenceDate;
        if (quotes.length > 0) {
            // Usa a data da cotação mais recente (já que 'quotes' está ordenado por created_at DESC)
            referenceDate = new Date(quotes[0].created_at);
        } else {
            // Se não houver NENHUMA cotação no sistema, não há o que mostrar.
            analyticsContainer.innerHTML = '<p>Nenhum dado disponível para análise.</p>';
            return;
        }

        // Define o período "atual" baseado na data de referência
        const startOfCurrentMonth = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1);
        
        // Define o período "anterior"
        const previousMonthDate = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1);
        previousMonthDate.setMonth(previousMonthDate.getMonth() - 1);

        const startOfPreviousMonth = new Date(previousMonthDate.getFullYear(), previousMonthDate.getMonth(), 1);
        const endOfPreviousMonth = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 0, 23, 59, 59);

        // Filtra as cotações para o "mês atual" (do início do mês até a data de referência)
        const currentMonthQuotes = quotes.filter(q => {
            const createdAt = new Date(q.created_at);
            return createdAt >= startOfCurrentMonth && createdAt <= referenceDate;
        });

        // Filtra as cotações para o "mês anterior" completo
        const previousMonthQuotes = quotes.filter(q => {
            const createdAt = new Date(q.created_at);
            return createdAt >= startOfPreviousMonth && createdAt <= endOfPreviousMonth;
        });

        const currentMetrics = aggregateQuoteMetrics(currentMonthQuotes);
        const previousMetrics = aggregateQuoteMetrics(previousMonthQuotes);

        /* (Lógica de renderização dos KPIs mantida) */
    }

    // ... (aggregateQuoteMetrics, createKpiCard, calculatePercentageChange, renderPriceTablesList - Mantidos)

    // CORREÇÃO (Cadastros): Garantir que as categorias dentro do catálogo iniciem fechadas
    function renderAdminCatalog() {
        if (!adminCatalogContainer) return;
        adminCatalogContainer.innerHTML = '';
        // ... (Lógica de agrupamento e ordenação)

        orderedCategories.forEach(category => {
            const categoryWrapper = document.createElement('div');
            // Removido o atributo 'open' do <details> para que as categorias iniciem fechadas.
            categoryWrapper.innerHTML = `
                <details class="category-accordion"> 
                    <summary class="category-header">
                        <h3 class="category-title">${category}</h3>
                    </summary>
                    <div class="table-container">
                        </div>
                </details>
            `;
            adminCatalogContainer.appendChild(categoryWrapper);
        });
    }

    // --- LÓGICA DO CALENDÁRIO (ATUALIZADA) ---

    // Popula as opções do filtro de status
    function populateCalendarFilters() {
        if (calendarStatusFilter) {
            // Limpa opções existentes
            calendarStatusFilter.innerHTML = ''; 
            const statuses = ['Todos', 'Ganho', 'Em analise', 'Perdido', 'Rascunho'];
            calendarStatusFilter.innerHTML = statuses.map(s => `<option value="${s}">${s}</option>`).join('');
            // Define 'Ganho' como padrão inicial
            calendarStatusFilter.value = 'Ganho';
        }
    }

    // Função para atualizar os eventos com base nos filtros
    function updateCalendarEvents() {
        if (!calendarInstance) return;

        const selectedStatus = calendarStatusFilter?.value || 'Todos';
        
        // Filtra os orçamentos
        const filteredQuotes = quotes.filter(quote => {
            return selectedStatus === 'Todos' || quote.status === selectedStatus;
        });

        const calendarEvents = [];
        filteredQuotes.forEach(quote => {
            if (quote.quote_data && quote.quote_data.event_dates) {
                // CORREÇÃO: Identificar o Espaço locado a partir dos itens salvos (snapshot)
                const spaceItem = quote.quote_data.items?.find(item => item.category === 'Espaço');
                const spaceName = spaceItem ? ` [${spaceItem.name}]` : '';

                quote.quote_data.event_dates.forEach(eventDate => {
                    calendarEvents.push({
                        title: `${quote.client_name}${spaceName}`, // Título com o espaço
                        start: eventDate.date, 
                        allDay: true,
                        // Guarda o ID para o clique
                        extendedProps: {
                            quoteId: quote.id
                        }
                    });
                });
            }
        });
        
        // Atualiza a fonte de eventos do FullCalendar
        calendarInstance.removeAllEvents();
        calendarInstance.addEventSource(calendarEvents);
    }

    async function initializeCalendar() {
        const calendarEl = document.getElementById('calendar');
        if (!calendarEl) return;

        // Se a instância não existe, cria ela
        if (!calendarInstance) {
            calendarInstance = new FullCalendar.Calendar(calendarEl, {
                locale: 'pt-br',
                initialView: 'dayGridMonth',
                // ... (Configurações do headerToolbar)
                eventColor: '#8B0000',
                // CORREÇÃO: Implementação do clique no evento
                eventClick: function(info) {
                    const quoteId = info.event.extendedProps.quoteId;
                    // Redireciona para a página de gestão do evento
                    if (quoteId) {
                        window.location.href = `evento.html?quote_id=${quoteId}`;
                    }
                }
            });
            calendarInstance.render();
        }

        // Gera e atualiza os eventos (com filtros aplicados)
        updateCalendarEvents();
    }
    
    // --- EVENT LISTENERS ---
    function setupTabEvents() {
        const tabsNav = document.querySelector('.tabs-nav');
        if (!tabsNav) return;
        tabsNav.addEventListener('click', (e) => {
            // ... (Lógica de troca de abas)
            
            // Inicializa o calendário SE for a aba de calendário
            if (tabId === 'calendar') {
                initializeCalendar();
            }
        });
    }
    
    function addEventListeners() {
        setupTabEvents();
        // setupCollapsibleEvents(); // Mantido se necessário

        // ... (Outros listeners de formulários e botões)

        // CORREÇÃO: Listener para o filtro do calendário
        calendarStatusFilter?.addEventListener('change', updateCalendarEvents);

        // ... (Listeners de inputs)
    }

    // ... (Funções CRUD e Helpers mantidas)

    // Inicialização da aplicação (Descomentar ao integrar)
    // initialize(); 
});
