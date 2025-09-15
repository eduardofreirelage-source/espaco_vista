import { supabase } from './supabase-client.js';

document.addEventListener('DOMContentLoaded', async () => {
    // ... (Estado inicial e carregamento do quoteId)

    // Helper Functions
    function formatCurrency(value) {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(parseFloat(value) || 0);
    }

    // --- CARREGAMENTO DE DADOS (loadData mantido como original) ---

    // --- RENDERIZAÇÃO ---
    function populatePage() {
        // Resumo do Evento
        document.getElementById('summary-client-name').textContent = currentQuote.client_name;
        document.getElementById('summary-guest-count').textContent = currentQuote.quote_data.guest_count;
        document.getElementById('summary-total-value').textContent = formatCurrency(currentQuote.total_value);
        document.getElementById('view-quote-link').href = `index.html?quote_id=${quoteId}`;
        const eventDates = currentQuote.quote_data.event_dates.map(d => new Date(d.date + 'T12:00:00Z').toLocaleDateString('pt-BR')).join(', ');
        document.getElementById('summary-event-dates').textContent = eventDates;

        // NOVO: Identificar e exibir o Espaço Locado (a partir do snapshot)
        const spaceItem = currentQuote.quote_data.items?.find(item => item.category === 'Espaço');
        document.getElementById('summary-event-space').textContent = spaceItem ? spaceItem.name : 'Não definido';
        
        // ... (Dados do Cliente mantidos)
        
        // Renderiza seções dinâmicas
        renderServicesSummary();
        renderPayments();
    }
    
    // ... (renderPayments mantido, garantindo que o input number receba valor numérico puro)

    // CORREÇÃO: Renderiza o resumo de serviços contratados com detalhamento e placeholder de cardápio
    function renderServicesSummary() {
        const container = document.getElementById('services-summary-container');
        if (!container || !currentQuote?.quote_data?.items) {
            container.innerHTML = '<p>Nenhum serviço encontrado.</p>';
            return;
        }

        // Agrupa os itens por categoria (usando os dados salvos no snapshot)
        const itemsByCategory = currentQuote.quote_data.items.reduce((acc, item) => {
            const category = item.category || 'Outros';
            if (!acc[category]) {
                acc[category] = [];
            }
            acc[category].push(item);
            return acc;
        }, {});

        let html = '';
        const categoryOrder = ['Espaço', 'Gastronomia', 'Equipamentos', 'Serviços / Outros'];

         // Adiciona categorias extras caso não estejam na ordem predefinida
        Object.keys(itemsByCategory).forEach(category => {
            if (!categoryOrder.includes(category)) {
                categoryOrder.push(category);
            }
        });
        
        categoryOrder.forEach(category => {
            if(itemsByCategory[category]) {
                html += `<div class="service-summary-category">`;
                html += `<h3>${category}</h3>`;
                itemsByCategory[category].forEach(item => {
                    // Usa o preço salvo no snapshot (priorizando o calculado, fallback para o unitário se existir)
                    const unitPrice = item.calculated_unit_price || item.unit_price || 0;
                    html += `
                        <div class="service-summary-item">
                            <span>${item.name}</span>
                            <span>${item.quantity} x ${formatCurrency(unitPrice)}</span>
                        </div>
                    `;
                });

                // CORREÇÃO: Adiciona o botão específico para Gastronomia (Placeholder)
                if (category === 'Gastronomia') {
                    html += `<div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px dashed var(--border-color);">`;
                    html += `<p>Seleção de pratos pendente.</p>`;
                    html += `<button class="btn btn-primary" id="define-menu-btn" style="margin-top: 0.5rem;">Definir Cardápio</button>`;
                    html += `</div>`;
                }

                html += `</div>`;
            }
        });

        container.innerHTML = html;

        // Listener para o botão de cardápio (Placeholder)
        const menuBtn = document.getElementById('define-menu-btn');
        if (menuBtn) {
            menuBtn.addEventListener('click', () => {
                alert('Funcionalidade de definição de cardápio será implementada em breve.');
            });
        }
    }

    // --- EVENT LISTENERS E AÇÕES ---
    
    // CORREÇÃO: Listener para controle das seções colapsáveis (Abas)
    document.body.addEventListener('click', e => {
        const header = e.target.closest('.collapsible-card > .card-header');
        if (header) {
            const card = header.closest('.collapsible-card');
            if (card) {
                card.classList.toggle('collapsed');
            }
        }
    });

    // ... (Listeners de formulário e pagamentos mantidos como original)

    // Inicialização (Descomentar ao usar)
    // loadData();
});
