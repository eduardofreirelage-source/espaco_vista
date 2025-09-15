import { supabase, getSession } from './supabase-client.js';

document.addEventListener('DOMContentLoaded', async () => {
    // =================================================================
    // VERIFICAÇÃO DE ACESSO (Mantenha descomentado em produção)
    // =================================================================
    /*
    const { role } = await getSession();
    if (role !== 'admin') {
        console.warn("Acesso negado. Redirecionando.");
        window.location.href = 'login.html';
        return;
    }
    */

    // =================================================================
    // ESTADO E ELEMENTOS DO DOM
    // =================================================================
    let services = [], priceTables = [], servicePrices = [], quotes = [];
    
    const adminCatalogContainer = document.getElementById('admin-catalog-container');
    // (Outros elementos do DOM como priceTablesTbody, quotesTbody, eventsTbody, etc.)
    const analyticsContainer = document.getElementById('analytics-container');
    const notification = document.getElementById('save-notification');
    
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
        // (Lógica de busca de dados mantida, garantindo seleção de 'quote_data')
        try {
             const [servicesRes, tablesRes, pricesRes, quotesRes] = await Promise.all([
                supabase.from('services').select('*').order('category').order('name'),
                supabase.from('price_tables').select('*').order('name'),
                supabase.from('service_prices').select('*'),
                // Importante selecionar 'quote_data' para o calendário e analytics
                supabase.from('quotes').select('*, clients(*)').order('created_at', { ascending: false })
            ]);

            // (Verificação de erros mantida)

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
        if (calendarInstance) {
            updateCalendarEvents();
        }
    }
    
    // (formatCurrency, renderQuotesTable, renderEventsTable - Mantidos do original com ajustes)

    // CORREÇÃO (Analytics): Usa a data da última cotação como referência em vez de 'hoje'.
    function renderAnalytics() {
        if (!analyticsContainer) return;
        
        let referenceDate;
        if (quotes.length > 0) {
            // Usa a data da cotação mais recente (pois 'quotes' está ordenado por created_at DESC)
            referenceDate = new Date(quotes[0].created_at);
        } else {
            // Se não houver NENHUMA cotação, não há o que mostrar.
            analyticsContainer.innerHTML = '<p>Nenhum dado disponível para análise.</p>';
            return;
        }

        // Define o período "atual" (Mês da data de referência)
        const startOfCurrentMonth = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1);
        
        // Define o período "anterior"
        const previousMonthDate = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1);
        previousMonthDate.setMonth(previousMonthDate.getMonth() - 1);

        const startOfPreviousMonth = new Date(previousMonthDate.getFullYear(), previousMonthDate.getMonth(), 1);
        const endOfPreviousMonth = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 0, 23, 59, 59);

        // Filtra as cotações
        const currentMonthQuotes = quotes.filter(q => {
            const createdAt = new Date(q.created_at);
            return createdAt >= startOfCurrentMonth && createdAt <= referenceDate;
        });

        const previousMonthQuotes = quotes.filter(q => {
            const createdAt = new Date(q.created_at);
            return createdAt >= startOfPreviousMonth && createdAt <= endOfPreviousMonth;
        });

        const currentMetrics = aggregateQuoteMetrics(currentMonthQuotes);
        const previousMetrics = aggregateQuoteMetrics(previousMonthQuotes);

        // (Renderização dos KPIs mantida do original)
        analyticsContainer.innerHTML = `
            ${createKpiCard('Ganhos', currentMetrics.Ganho, previousMetrics.Ganho)}
            ${createKpiCard('Perdidos', currentMetrics.Perdido, previousMetrics.Perdido)}
            ${createKpiCard('Em Análise', currentMetrics['Em analise'], previousMetrics['Em analise'])}
        `;
    }

    // (aggregateQuoteMetrics, createKpiCard, calculatePercentageChange, renderPriceTablesList - Mantidos)

    // CORREÇÃO (Cadastros): Garantir que as sub-abas (categorias) iniciem fechadas
    function renderAdminCatalog() {
        if (!adminCatalogContainer) return;
        adminCatalogContainer.innerHTML = '';
        
        // (Lógica de agrupamento e ordenação mantida)

        orderedCategories.forEach(category => {
            const categoryWrapper = document.createElement('div');
            // CORREÇÃO: Removido o atributo 'open' do <details> para que as categorias iniciem fechadas.
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
            // Preenche se estiver vazio
            if (calendarStatusFilter.options.length === 0) {
                const statuses = ['Todos', 'Ganho', 'Em analise', 'Perdido', 'Rascunho'];
                calendarStatusFilter.innerHTML = statuses.map(s => `<option value="${s}">${s}</option>`).join('');
            }
            // Define 'Ganho' como padrão inicial se não houver seleção prévia
            if (!calendarStatusFilter.value) {
                 calendarStatusFilter.value = 'Ganho';
            }
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

        const calendarEvents = filteredQuotes.flatMap(quote => {
            // Verifica se quote_data e event_dates existem
            if (!quote.quote_data || !quote.quote_data.event_dates) return [];
                
            // CORREÇÃO: Identificar o Espaço locado a partir dos itens salvos (snapshot)
            const spaceItem = quote.quote_data.items?.find(item => item.category === 'Espaço');
            const spaceName = spaceItem ? ` [${spaceItem.name}]` : '';

            return quote.quote_data.event_dates.map(eventDate => ({
                title: `${quote.client_name}${spaceName}`, // Título com o espaço
                start: eventDate.date, 
                allDay: true,
                // Guarda o ID para o clique
                extendedProps: {
                    quoteId: quote.id
                }
            }));
        });
        
        // Atualiza a fonte de eventos do FullCalendar
        calendarInstance.removeAllEvents();
        calendarInstance.addEventSource(calendarEvents);
    }

    async function initializeCalendar() {
        const calendarEl = document.getElementById('calendar');
        if (!calendarEl || typeof FullCalendar === 'undefined') return;

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
    
    // --- EVENT LISTENERS (CONSOLIDADO E CORRIGIDO) ---
    function addEventListeners() {
        // 1. Listener de Abas Principais (Corrige a navegação que estava quebrada)
        const tabsNav = document.querySelector('.tabs-nav');
        tabsNav?.addEventListener('click', (e) => {
            const clickedTab = e.target.closest('.tab-btn');
            if (!clickedTab) return;

            const tabId = clickedTab.dataset.tab;
            const targetContent = document.getElementById(`tab-content-${tabId}`);

            if (targetContent) {
                tabsNav.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
                document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
                
                clickedTab.classList.add('active');
                targetContent.classList.add('active');

                // Inicializa o calendário ao clicar na aba
                if (tabId === 'calendar') {
                    initializeCalendar();
                }
            }
        });

        // 2. Listener de Ações Globais (Delegação de Eventos)
        document.body.addEventListener('click', e => {
            // Controle de seções colapsáveis (collapsible-card)
            const header = e.target.closest('.collapsible-card > .card-header');
            if (header) {
                header.closest('.collapsible-card')?.classList.toggle('collapsed');
                return;
            }
            
            // (Ações de botões mantidas do original)
        });

        // 3. Listener para o filtro do calendário
        calendarStatusFilter?.addEventListener('change', updateCalendarEvents);

        // (Listeners de formulários e inputs mantidos do original)
    }
    
    // (Funções CRUD e Helpers - Mantidas do original)

    // Inicialização da aplicação (Chamar ao integrar)
    // initialize();
});
