import { supabase, getSession } from './supabase-client.js';

// =================================================================
// FUNÇÃO DE ANIMAÇÃO (JS Slide Toggle) - CORREÇÃO DE LAYOUT
// Necessária para animar a altura sem impedir o overflow horizontal quando aberto.
// =================================================================
function slideToggle(element) {
    // Previne múltiplas animações simultâneas
    if (element.dataset.animating === 'true') return;
    
    // Acessa o conteúdo diretamente (o CSS foi ajustado para não usar card-content-wrapper)
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
        
        // Usamos double requestAnimationFrame (rAF) para garantir que o navegador processe o display:block antes de animar a altura
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

        // Usamos double rAF para garantir que o navegador processe a altura atual antes de animar para 0
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

    const { role } = await getSession();
    if (role !== 'admin') {
        window.location.href = 'login.html';
        return;
    }

    // ESTADO GLOBAL
    let services = [], priceTables = [], servicePrices = [], quotes = [], paymentMethods = [], cardapioItems = [], cardapioComposition = [], units = [];
    let selectedCardapioId = null;
    let calendarInstance = null;

    // SELETORES DO DOM
    // ... (Seletores preservados do original)

    // =================================================================
    // FUNÇÕES UTILITÁRIAS (Código original preservado)
    // =================================================================
    // ... (showNotification, showFlash, createUnitSelect, aggregateQuoteMetrics, createKpiCard) ...

    // =================================================================
    // INICIALIZAÇÃO E DADOS
    // =================================================================
    async function initialize() {
        addEventListeners();
        await fetchData();
    }

    async function fetchData() {
        // ... (Lógica de fetchData completa como no original) ...
    }
    
    // =================================================================
    // RENDERIZAÇÃO (Código original preservado)
    // =================================================================
    // ... (renderAll, renderSimpleTable, createQuoteRow, etc.) ...

    // =================================================================
    // EVENT LISTENERS E AÇÕES
    // =================================================================
    function addEventListeners() {
        // Listener de Tabs (Preservado)
        document.querySelector('.tabs-nav')?.addEventListener('click', (e) => {
             // ... (Lógica de troca de abas)
        });
        
        // CORREÇÃO: Substitui o toggle simples pela função de animação JS
        document.body.addEventListener('click', (e) => {
            const header = e.target.closest('.collapsible-card > .card-header');
            if (header) {
                const card = header.closest('.collapsible-card');
                // Antes: if (header) header.closest('.collapsible-card')?.classList.toggle('collapsed');
                // Agora:
                if (card) {
                    slideToggle(card);
                }
            }
        });
        
        // ... (Listeners de formulários e ações de tabela como no original) ...
    }

    // ... (Restante das funções: handleFormSubmit, handleTableActions, handleTableEdits, duplicateCardapio) ...

    initialize();
});
