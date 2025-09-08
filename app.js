import { supabase } from './supabase-client.js';

document.addEventListener('DOMContentLoaded', () => {
    // --- ESTADO DA APLICAÇÃO ---
    let appData = { services: [], tabelas: {} };
    let quote = {
        general: { guestCount: 100, priceTable: '', discount: 0, dates: [] },
        items: []
    };

    // --- ELEMENTOS DO DOM ---
    const guestCountInput = document.getElementById('guestCount');
    const priceTableSelect = document.getElementById('priceTableSelect');
    const discountInput = document.getElementById('discountValue');
    const addDateBtn = document.getElementById('add-date-btn');
    const addItemModal = document.getElementById('addItemModal');

    // --- INICIALIZAÇÃO ---
    async function initialize() {
        await loadDataFromSupabase();
        populatePriceTables();
        addEventListeners();
        render();
    }

    async function loadDataFromSupabase() {
        const { data: servicesData } = await supabase.from('services').select('*');
        const { data: tablesData } = await supabase.from('price_tables').select('*');
        appData.services = servicesData || [];
        appData.tabelas = (tablesData || []).reduce((acc, table) => {
            acc[table.name] = { modificador: table.modifier };
            return acc;
        }, {});
    }

    function populatePriceTables() {
        priceTableSelect.innerHTML = Object.keys(appData.tabelas).map(name => `<option value="${name}">${name}</option>`).join('');
        if (priceTableSelect.options.length > 0) {
            quote.general.priceTable = priceTableSelect.value;
        }
    }

    // --- LÓGICA DE RENDERIZAÇÃO ---
    function render() {
        renderDateInputs();
        renderQuoteTables();
        calculateTotal();
    }

    function renderQuoteTables() {
        const tables = {
            'Espaço': document.getElementById('espaco-table-body'),
            'Gastronomia': document.getElementById('gastronomia-table-body'),
            'Equipamentos': document.getElementById('equipamentos-table-body'),
            'Serviços / Outros': document.getElementById('servicos-outros-table-body')
        };
        Object.values(tables).forEach(tbody => tbody.innerHTML = '');

        const prices = getCalculatedPrices();
        quote.items.forEach((item, index) => {
            const service = appData.services.find(s => s.id === item.id);
            if (!service || !tables[service.category]) return;

            const tableBody = tables[service.category];
            const unitPrice = prices[item.id] || 0;
            const isPerPerson = service.unit === 'por_pessoa';
            const quantity = isPerPerson ? quote.general.guestCount : item.quantity;
            const total = unitPrice * quantity;
            const dateOptions = quote.general.dates.map((d, i) => `<option value="${d}" ${d === item.assignedDate ? 'selected' : ''}>Data ${i + 1} (${d || 'N/D'})</option>`).join('');

            const row = document.createElement('tr');
            row.innerHTML = `
                <td>
                    <strong>${service.name}</strong>
                    <div class="item-details">
                        <div class="form-group"><label>Data do Serviço:</label><select data-index="${index}" data-field="assignedDate"><option value="">Selecione</option>${dateOptions}</select></div>
                        <div class="form-group"><label>Observações:</label><textarea data-index="${index}" data-field="observacoes" rows="2">${item.observacoes || ''}</textarea></div>
                    </div>
                </td>
                <td>R$ ${unitPrice.toFixed(2)}</td>
                <td><input type="number" value="${quantity}" min="1" ${isPerPerson ? 'disabled' : ''} data-index="${index}" data-field="quantity"></td>
                <td>R$ ${total.toFixed(2)}</td>
                <td class="item-actions">
                    <button class="btn-duplicate" title="Duplicar Item" data-index="${index}">📋</button>
                    <button class="btn-remove" title="Remover Item" data-index="${index}">&times;</button>
                </td>
            `;
            tableBody.appendChild(row);
        });
    }
    
    // ... (As funções calculateTotal, addEventListeners, openAddItemModal permanecem as mesmas da versão anterior, com a adição do listener para o botão de duplicar)

    // --- ADIÇÃO DE EVENT LISTENERS (DENTRO DA FUNÇÃO addEventListeners) ---
    function addEventListeners() {
        // ... (todos os outros listeners: addDateBtn, guestCountInput, etc.)
        
        // Delegação de eventos para botões de duplicar
        document.querySelector('main').addEventListener('click', (e) => {
             if (e.target.classList.contains('btn-duplicate')) {
                duplicateItem(e.target.dataset.index);
            }
        });
    }
    
    // --- NOVA FUNÇÃO PARA DUPLICAR ---
    function duplicateItem(index) {
        const itemToDuplicate = quote.items[parseInt(index)];
        if (!itemToDuplicate) return;
        
        // Cria uma cópia profunda do item
        const newItem = JSON.parse(JSON.stringify(itemToDuplicate));
        
        // Insere a cópia logo após o original
        quote.items.splice(parseInt(index) + 1, 0, newItem);
        
        render(); // Re-renderiza a UI
    }

    // O restante do código (calculateTotal, openAddItemModal, funções globais, etc.)
    // pode ser mantido da versão funcional anterior, pois a lógica central de cálculo não mudou.
    // Apenas a renderização e o novo botão foram adicionados.
    
    initialize(); // Inicia a aplicação
});
