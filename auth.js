import { supabase, getSession } from './supabase-client.js';

document.addEventListener('DOMContentLoaded', async () => {
    // =================================================================
    // VERIFICAÇÃO DE ACESSO
    // ... (Mantido como original) ...

    // =================================================================
    // ESTADO E ELEMENTOS DO DOM
    // =================================================================
    let services = [], priceTables = [], servicePrices = [], quotes = [];
    
    const adminCatalogContainer = document.getElementById('admin-catalog-container');
    // ... (Outros elementos do DOM)
    const analyticsContainer = document.getElementById('analytics-container');
    // NOVO: Seletor do filtro do calendário (deve existir no admin.html)
    const calendarStatusFilter = document.getElementById('calendar-status-filter');

    let debounceTimers = {};
    let calendarInstance = null; 

    // --- INICIALIZAÇÃO ---
    async function initialize() {
        await fetchData();
        addEventListeners();
        populateCalendarFilters();
    }

    async function fetchData() {
        try {
            const [servicesRes, tablesRes, pricesRes, quotesRes] = await Promise.all([
                supabase.from('services').select('*').order('category').order('name'),
                supabase.from('price_tables').select('*').order('name'),
                supabase.from('service_prices').select('*'),
                // Importante selecionar o ID e todo o quote_data
                supabase.from('quotes').select('id, *, clients(*)').order('created_at', { ascending: false })
            ]);

            // ... (Verificação de erros)

            services = servicesRes.data || [];
            priceTables = tablesRes.data || [];
            servicePrices = pricesRes.data || [];
            quotes = quotesRes.data || [];
            // 'events' não é mais necessário, usamos 'quotes' diretamente.

            renderAll();
        } catch (error) {
            showNotification(`Erro ao carregar dados: ${error.message}`, true);
        }
    }

    // --- RENDERIZAÇÃO ---
    function renderAll() {
        renderPriceTablesList();
        renderAdminCatalog();
        renderQuotesTable();
        renderEventsTable();
        renderAnalytics();
        // Atualiza o calendário se já estiver inicializado (ex: após mudança de status)
        if (calendarInstance) {
            updateCalendarEvents();
        }
    }
    
    // ... (formatCurrency, renderQuotesTable, renderEventsTable - Mantidos)

    // CORREÇÃO (Analytics): Usar a data da última cotação como referência
    function renderAnalytics() {
        if (!analyticsContainer) return;
        
        let referenceDate;
        if (quotes.length > 0) {
            // Usa a data da cotação mais recente (já que está ordenado desc)
            referenceDate = new Date(quotes[0].created_at);
        } else {
            // Se não houver dados, usa a data atual como fallback
            referenceDate = new Date();
        }

        // Início do mês da data de referência
        const startOfCurrentMonth = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1);
        
        // Calcula o mês anterior corretamente
        const previousMonthDate = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1);
        previousMonthDate.setMonth(previousMonthDate.getMonth() - 1);

        const startOfPreviousMonth = new Date(previousMonthDate.getFullYear(), previousMonthDate.getMonth(), 1);
        // Último dia do mês anterior à data de referência
        const endOfPreviousMonth = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 0, 23, 59, 59);

        // Filtra as cotações para o "mês atual" (até a data de referência)
        const currentMonthQuotes = quotes.filter(q => {
            const createdAt = new Date(q.created_at);
            return createdAt >= startOfCurrentMonth && createdAt <= referenceDate;
        });

        // Filtra as cotações para o "mês anterior"
        const previousMonthQuotes = quotes.filter(q => {
            const createdAt = new Date(q.created_at);
            return createdAt >= startOfPreviousMonth && createdAt <= endOfPreviousMonth;
        });

        const currentMetrics = aggregateQuoteMetrics(currentMonthQuotes);
        const previousMetrics = aggregateQuoteMetrics(previousMonthQuotes);

        analyticsContainer.innerHTML = `
            ${createKpiCard('Ganhos', currentMetrics.Ganho, previousMetrics.Ganho)}
            ${createKpiCard('Perdidos', currentMetrics.Perdido, previousMetrics.Perdido)}
            ${createKpiCard('Em Análise', currentMetrics['Em analise'], previousMetrics['Em analise'])}
        `;
    }

    // ... (aggregateQuoteMetrics, createKpiCard, calculatePercentageChange, renderPriceTablesList - Mantidos)

    // CORREÇÃO (Cadastros): Renderizar abas fechadas
    function renderAdminCatalog() {
        if (!adminCatalogContainer) return;
        adminCatalogContainer.innerHTML = '';
        // ... (Lógica de agrupamento mantida)

        orderedCategories.forEach(category => {
            const categoryWrapper = document.createElement('div');
            // Removido o atributo 'open' do <details> para que iniciem fechadas.
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

    // ... (createUnitSelect - Mantido)

    // --- LÓGICA DO CALENDÁRIO (ATUALIZADA) ---

    // Popula o filtro de status (se existir no HTML)
    function populateCalendarFilters() {
        if (calendarStatusFilter && calendarStatusFilter.options.length === 0) {
            const statuses = ['Todos', 'Ganho', 'Em analise', 'Perdido', 'Rascunho'];
            calendarStatusFilter.innerHTML = statuses.map(s => `<option value="${s}">${s}</option>`).join('');
            // Define 'Ganho' como padrão inicial
            calendarStatusFilter.value = 'Ganho';
        }
    }

    // Função para atualizar os eventos com base no filtro de status
    function updateCalendarEvents() {
        if (!calendarInstance) return;

        const selectedStatus = calendarStatusFilter?.value || 'Todos';
        
        // Filtra os orçamentos baseado no status selecionado
        const filteredQuotes = quotes.filter(quote => {
            return selectedStatus === 'Todos' || quote.status === selectedStatus;
        });

        const calendarEvents = [];
        filteredQuotes.forEach(quote => {
            if (quote.quote_data && quote.quote_data.event_dates) {
                // CORREÇÃO: Identificar o Espaço locado
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
        
        // Atualiza a fonte de eventos do calendário
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
                headerToolbar: {
                    left: 'prev,next today',
                    center: 'title',
                    right: 'dayGridMonth,timeGridWeek,listWeek'
                },
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
            // ... (Lógica de troca de abas mantida)
            
            // Inicializa o calendário SE for a aba de calendário
            if (tabId === 'calendar') {
                initializeCalendar();
            }
        });
    }
    
    function addEventListeners() {
        setupTabEvents();
        // ... (Outros listeners mantidos)

        // NOVO: Listener para o filtro do calendário
        calendarStatusFilter?.addEventListener('change', updateCalendarEvents);
    }

    // ... (Funções CRUD e Helpers mantidas)

    // Inicialização da aplicação
    // initialize();
});
