import { supabase } from './supabase-client.js';

// =================================================================
// FUNÇÃO DE ANIMAÇÃO (JS Slide Toggle) - CORREÇÃO DE LAYOUT
// (Copiada de auth.js para garantir funcionalidade nesta página)
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
    const notification = document.getElementById('save-notification');
    let currentQuote = null;
    let currentClient = null;
    let services = [];
    let hasInitializedListeners = false;
    
    const urlParams = new URLSearchParams(window.location.search);
    const quoteId = urlParams.get('quote_id');

    /*
    if (!quoteId) {
        document.querySelector('main').innerHTML = '<h1>Orçamento não encontrado.</h1>';
        return;
    }
    */

    // --- FUNÇÕES UTILITÁRIAS ---
    function showNotification(message, isError = false) {
        // ... (Implementação de showNotification como no original)
    }
    
    function formatCurrency(value) {
        // ... (Implementação de formatCurrency como no original)
    }

    // --- CARREGAMENTO DE DADOS ---
    async function loadData() {
        /*
        try {
            // ... (Lógica de loadData como no original) ...
            
            populatePage();
            if (!hasInitializedListeners) {
                setupEventListeners();
                hasInitializedListeners = true;
            }

        } catch (error) {
            showNotification('Erro ao carregar dados do evento.', true);
            console.error(error);
        }
        */
       // Chamar setupEventListeners mesmo sem dados para garantir que a UI responda
       if (!hasInitializedListeners) {
            setupEventListeners();
            hasInitializedListeners = true;
        }
    }

    // --- RENDERIZAÇÃO (Código original preservado) ---
    function populatePage() {
        // ... (Lógica de preenchimento da página)
    }

    function populateClientForm() {
        // ... (Lógica de preenchimento do formulário do cliente)
    }

    function renderServicesSummary() {
        // ... (Lógica de renderização dos serviços)
    }

    function renderPayments() {
        // ... (Lógica de renderização dos pagamentos)
    }

    // --- EVENT LISTENERS ---
    function setupEventListeners() {
        
        // CORREÇÃO: Gerenciamento de Cards Colapsáveis via JS Animation
        document.addEventListener('click', (e) => {
            const header = e.target.closest('.collapsible-card > .card-header');
            if (header) {
                const card = header.parentElement;
                slideToggle(card); // Chama a função de animação JS
                return;
            }
            
            // ... (Outros handlers de clique, como botões de pagamento, etc.) ...
        });

        // ... (Listeners de formulários e botões específicos como no original) ...
    }

    // --- LÓGICA DE NEGÓCIOS (Save/Update) ---
    
    // ... (Funções para salvar dados do cliente, gerenciar pagamentos, etc.) ...

    // Inicialização
    loadData();
});
