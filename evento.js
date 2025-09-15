import { supabase } from './supabase-client.js';

document.addEventListener('DOMContentLoaded', async () => {
    const notification = document.getElementById('save-notification');
    let currentQuote = null;
    let currentClient = null;
    
    const urlParams = new URLSearchParams(window.location.search);
    const quoteId = urlParams.get('quote_id');

    if (!quoteId) {
        document.querySelector('main').innerHTML = '<h1>Orçamento não encontrado.</h1>';
        return;
    }

    // --- CARREGAMENTO DE DADOS ---
    async function loadData() {
        const { data, error } = await supabase
            .from('quotes')
            .select('*, clients(*)')
            .eq('id', quoteId)
            .single();

        if (error || !data) {
            showNotification('Erro ao carregar dados do evento.', true);
            console.error(error);
            return;
        }
        currentQuote = data;
        currentClient = data.clients;
        populatePage();
    }

    // --- RENDERIZAÇÃO ---
    function populatePage() {
        // Resumo do Evento
        document.getElementById('summary-client-name').textContent = currentQuote.client_name;
        document.getElementById('summary-guest-count').textContent = currentQuote.quote_data.guest_count;
        document.getElementById('summary-total-value').textContent = formatCurrency(currentQuote.total_value);
        document.getElementById('view-quote-link').href = `index.html?quote_id=${quoteId}`;
        const eventDates = currentQuote.quote_data.event_dates.map(d => new Date(d.date + 'T12:00:00Z').toLocaleDateString('pt-BR')).join(', ');
        document.getElementById('summary-event-dates').textContent = eventDates;
        
        // Dados do Cliente
        document.getElementById('client-name').value = currentQuote.client_name || '';
        document.getElementById('client-cnpj').value = currentQuote.quote_data.client_cnpj || '';
        document.getElementById('client-email').value = currentQuote.quote_data.client_email || '';
        document.getElementById('client-phone').value = currentQuote.quote_data.client_phone || '';
        if (currentClient) {
            document.getElementById('client-legal-name').value = currentClient.legal_name || '';
            document.getElementById('client-state-reg').value = currentClient.state_registration || '';
            document.getElementById('client-rep-name').value = currentClient.legal_rep_name || '';
            document.getElementById('client-rep-cpf').value = currentClient.legal_rep_cpf || '';
            if (currentClient.address) {
                document.getElementById('client-address-street').value = currentClient.address.street || '';
                document.getElementById('client-address-city').value = currentClient.address.city || '';
                document.getElementById('client-address-state').value = currentClient.address.state || '';
                document.getElementById('client-address-zip').value = currentClient.address.zip || '';
            }
        }
        
        // Gestão Financeira
        renderPayments();
    }
    
    function renderPayments() {
        const tbody = document.getElementById('payments-table').querySelector('tbody');
        tbody.innerHTML = '';
        const payments = currentQuote.quote_data.payments || [];
        
        payments.forEach((payment, index) => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td><input type="date" class="payment-input" data-index="${index}" data-field="due_date" value="${payment.due_date || ''}"></td>
                <td><input type="number" step="0.01" class="payment-input" data-index="${index}" data-field="amount" value="${payment.amount || 0}"></td>
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

    // --- EVENT LISTENERS E AÇÕES ---
    document.getElementById('client-details-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const clientData = {
            id: currentClient?.id, // Reutiliza o ID se já existir
            name: document.getElementById('client-name').value,
            cnpj: document.getElementById('client-cnpj').value,
            email: document.getElementById('client-email').value,
            phone: document.getElementById('client-phone').value,
            legal_name: document.getElementById('client-legal-name').value,
            state_registration: document.getElementById('client-state-reg').value,
            legal_rep_name: document.getElementById('client-rep-name').value,
            legal_rep_cpf: document.getElementById('client-rep-cpf').value,
            address: {
                street: document.getElementById('client-address-street').value,
                city: document.getElementById('client-address-city').value,
                state: document.getElementById('client-address-state').value,
                zip: document.getElementById('client-address-zip').value,
            }
        };

        const { data: savedClient, error: clientError } = await supabase
            .from('clients')
            .upsert(clientData)
            .select()
            .single();

        if (clientError) {
            showNotification('Erro ao salvar cliente.', true);
            console.error(clientError);
            return;
        }

        // Se o orçamento ainda não está ligado a este cliente, atualiza a referência
        if (currentQuote.client_id !== savedClient.id) {
            const { error: quoteError } = await supabase
                .from('quotes')
                .update({ client_id: savedClient.id })
                .eq('id', quoteId);
            
            if (quoteError) {
                 showNotification('Erro ao vincular cliente ao orçamento.', true);
                 console.error(quoteError);
                 return;
            }
        }
        
        currentClient = savedClient;
        showNotification('Dados do cliente salvos com sucesso!');
    });
    
    document.getElementById('add-payment-btn').addEventListener('click', () => {
        if (!currentQuote.quote_data.payments) {
            currentQuote.quote_data.payments = [];
        }
        currentQuote.quote_data.payments.push({ due_date: '', amount: 0, method: '', status: 'A Pagar' });
        renderPayments();
    });

    document.getElementById('payments-table').addEventListener('change', async (e) => {
        if (e.target.classList.contains('payment-input')) {
            const index = e.target.dataset.index;
            const field = e.target.dataset.field;
            currentQuote.quote_data.payments[index][field] = e.target.value;
            
            const { error } = await supabase
                .from('quotes')
                .update({ quote_data: currentQuote.quote_data })
                .eq('id', quoteId);
            
            if (error) { showNotification('Erro ao salvar parcela.', true); }
            else { showNotification('Parcela salva!'); }
        }
    });
    
    document.getElementById('payments-table').addEventListener('click', async (e) => {
        if (e.target.classList.contains('remove-payment-btn')) {
            const index = e.target.dataset.index;
            currentQuote.quote_data.payments.splice(index, 1);
            
            const { error } = await supabase
                .from('quotes')
                .update({ quote_data: currentQuote.quote_data })
                .eq('id', quoteId);

            if (error) { showNotification('Erro ao remover parcela.', true); }
            else { showNotification('Parcela removida!'); renderPayments(); }
        }
    });

    // --- FUNÇÕES UTILITÁRIAS ---
    function showNotification(message, isError = false) {
        notification.textContent = message;
        notification.style.backgroundColor = isError ? 'var(--danger-color)' : 'var(--success-color)';
        notification.classList.add('show');
        setTimeout(() => notification.classList.remove('show'), 4000);
    }

    loadData();
});
