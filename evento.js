import { supabase } from './supabase-client.js';

document.addEventListener('DOMContentLoaded', async () => {
    // (Estado inicial e carregamento do quoteId mantidos)
    
    // Helper Functions
    function formatCurrency(value) {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(parseFloat(value) || 0);
    }
    
    // (showNotification e loadData mantidos do original)

    // --- RENDERIZAÇÃO ---
    function populatePage() {
        // (Resumo do Evento mantido)

        // CORREÇÃO: Identificar e exibir o Espaço Locado (a partir do snapshot dos itens)
        const spaceItem = currentQuote.quote_data.items?.find(item => item.category === 'Espaço');
        // Certifique-se que o elemento exista no HTML antes de tentar acessá-lo
        const spaceEl = document.getElementById('summary-event-space');
        if (spaceEl) {
             spaceEl.textContent = spaceItem ? spaceItem.name : 'Não definido';
        }
       
        // (Dados do Cliente mantidos)
        
        renderServicesSummary();
        renderPayments();
    }
    
    function renderPayments() {
        const tbody = document.getElementById('payments-table').querySelector('tbody');
        tbody.innerHTML = '';
        const payments = currentQuote.quote_data.payments || [];
        
        payments.forEach((payment, index) => {
            const row = document.createElement('tr');
            // CORREÇÃO CRÍTICA: O input type="number" deve receber um valor numérico puro (float), não formatado como moeda.
            // O código anterior usava formatCurrency() aqui, o que causava o erro.
            const amountValue = parseFloat(payment.amount) || 0; 

            row.innerHTML = `
                <td><input type="date" class="payment-input" data-index="${index}" data-field="due_date" value="${payment.due_date || ''}"></td>
                <td><input type="number" step="0.01" class="payment-input" data-index="${index}" data-field="amount" value="${amountValue.toFixed(2)}"></td>
                <td><input type="text" class="payment-input" data-index="${index}" data-field="method" value="${payment.method || ''}"></td>
                <td>
                    <select class="payment-input" data-index="${index}" data-field="status">
                        <option value="A Pagar" ${payment.status === 'A Pagar' ? 'selected' : ''}>A Pagar</option>
                        <option value="Pago" ${payment.status === 'Pago' ? 'selected' : ''}>Pago</option>
                    </select>
                </td>
                <td><button class="btn-remove remove-payment-btn" data-index="${index}">&times;</button></td>
            `;
            tbody.appendChild(row);
        });
    }

    // CORREÇÃO: Renderiza o resumo de serviços contratados com detalhamento e placeholder de cardápio
    function renderServicesSummary() {
        const container = document.getElementById('services-summary-container');
        if (!container || !currentQuote?.quote_data?.items) {
            container.innerHTML = '<p>Nenhum serviço encontrado.</p>';
            return;
        }

        // (Lógica de agrupamento e ordenação mantida)

        let html = '';
        
        categoryOrder.forEach(category => {
            if(itemsByCategory[category]) {
                html += `<div class="service-summary-category">`;
                html += `<h3>${category}</h3>`;
                itemsByCategory[category].forEach(item => {
                    // CORREÇÃO: Usa o preço salvo no snapshot ('calculated_unit_price' ou 'unit_price')
                    const unitPrice = item.calculated_unit_price || item.unit_price || 0;
                    html += `
                        <div class="service-summary-item">
                            <span>${item.name}</span>
                            <span>${item.quantity} x ${formatCurrency(unitPrice)}</span>
                        </div>
                    `;
                });

                // CORREÇÃO: Adiciona o placeholder específico para Gastronomia
                if (category === 'Gastronomia') {
                    html += `<div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px dashed var(--border-color);">`;
                    html += `<p>A seleção dos pratos será feita nesta seção.</p>`;
                    html += `<button class="btn btn-primary" id="define-menu-btn" style="margin-top: 0.5rem;">Gerenciar Cardápio do Evento</button>`;
                    html += `</div>`;
                }

                html += `</div>`;
            }
        });

        container.innerHTML = html;

        // (Listener do botão de cardápio mantido)
    }

    // --- EVENT LISTENERS E AÇÕES ---
    
    // CORREÇÃO: Listener essencial para controle das seções colapsáveis (Abas)
    document.body.addEventListener('click', e => {
        const header = e.target.closest('.collapsible-card > .card-header');
        if (header) {
            const card = header.closest('.collapsible-card');
            if (card) {
                card.classList.toggle('collapsed');
            }
        }
    });

    // (Listeners de formulário de cliente e gestão de pagamentos mantidos do original)

    // Inicialização (Chame esta função se o script for carregado corretamente)
    // loadData();
});
