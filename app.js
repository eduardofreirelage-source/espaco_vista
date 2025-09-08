import { supabase } from './supabase-client.js';

document.addEventListener('DOMContentLoaded', () => {
    // ESTADO DA APLICAÇÃO
    let appData = { services: [], tabelas: {} };
    let quote = { /* ... */ };
    const CATEGORY_ORDER = ['Espaço', 'Gastronomia', 'Equipamentos', 'Serviços / Outros'];
    let isDirty = false;

    // ELEMENTOS DO DOM
    const clientCnpjInput = document.getElementById('clientCnpj');

    // --- INICIALIZAÇÃO ---
    async function initialize() { /* ... */ }
    async function loadDataFromSupabase() { /* ... */ }
    function populatePriceTables() { /* ... */ }

    // --- LÓGICA DE RENDERIZAÇÃO ---
    function render() { /* ... */ }
    function renderDateManager() { /* ... */ }
    function renderQuoteCategories() { /* ... */ }

    function renderTableForCategory(tableBody, category, items) {
        // ... Lógica de renderização de linha ...
        // O botão de observações é alterado:
        row.innerHTML = `
            ...
            <td class="item-actions">
                <button class="btn-icon" data-action="showObs" data-index="${itemIndex}" title="Observações">💬</button>
                <button class="btn-icon" data-action="duplicate" data-index="${itemIndex}" title="Duplicar">📋</button>
                <button class="btn-icon" data-action="remove" data-index="${itemIndex}" title="Remover">&times;</button>
            </td>
        `;
        // A linha de observações (<tr>) foi removida daqui
    }

    // --- MANIPULADORES DE EVENTOS ---
    function addEventListeners() {
        // ... (outros listeners) ...
        clientCnpjInput?.addEventListener('input', handleCnpjMask);

        document.body.addEventListener('click', e => {
            const button = e.target.closest('button');
            if (!button) {
                // Se clicar fora do popover, fecha ele
                closeObsPopover();
                return;
            }
            const { action, index } = button.dataset;
            if (action === 'showObs') {
                e.stopPropagation(); // Impede que o click feche o popover imediatamente
                openObsPopover(index, button);
            }
            // ... (outros actions do click)
        });
    }

    // --- NOVA LÓGICA DO POPOVER DE OBSERVAÇÕES ---
    function openObsPopover(index, button) {
        closeObsPopover(); // Fecha qualquer outro que esteja aberto
        const item = quote.items[parseInt(index)];
        if (!item) return;

        const popover = document.createElement('div');
        popover.className = 'obs-popover show';
        popover.id = 'active-popover';
        popover.innerHTML = `
            <div class="form-group">
                <label>Observações</label>
                <textarea id="popover-obs-textarea">${item.observacoes || ''}</textarea>
            </div>
            <button class="btn" id="popover-save-btn">Salvar</button>
        `;
        
        button.parentElement.appendChild(popover); // Anexa o popover dentro do `td`

        document.getElementById('popover-save-btn').onclick = () => {
            const newObs = document.getElementById('popover-obs-textarea').value;
            updateItem(index, 'observacoes', newObs);
            closeObsPopover();
        };
    }

    function closeObsPopover() {
        const existingPopover = document.getElementById('active-popover');
        if (existingPopover) {
            existingPopover.remove();
        }
    }

    // --- NOVA FUNÇÃO DE MÁSCARA DE CNPJ ---
    function handleCnpjMask(e) {
        let value = e.target.value;
        value = value.replace(/\D/g, ""); // Remove tudo que não é dígito
        value = value.replace(/^(\d{2})(\d)/, "$1.$2");
        value = value.replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3");
        value = value.replace(/\.(\d{3})(\d)/, ".$1/$2");
        value = value.replace(/(\d{4})(\d)/, "$1-$2");
        e.target.value = value;
    }

    // ... (O restante completo do código do app.js da última versão funcional)
    
    initialize();
});
