document.addEventListener('DOMContentLoaded', () => {
    let appData;
    let currentQuote = {
        general: {
            guestCount: 100,
            priceTable: '',
            discount: 0
        },
        dates: [] // Ex: [{ date: '2025-10-20', espaco: [], gastronomia: [], ... }]
    };

    // --- ELEMENTOS DO DOM ---
    const datesContainer = document.getElementById('event-dates-container');
    const addDateBtn = document.getElementById('add-date-btn');
    const quotesContainer = document.getElementById('quotes-container');
    // ... (outros seletores como guestCountInput, etc.)

    // --- FUNÇÕES DE INICIALIZAÇÃO ---
    function initialize() {
        loadData();
        populatePriceTables();
        addEventListeners();
        renderAll();
    }

    function loadData() {
        const localData = localStorage.getItem('orcamentoData');
        appData = localData ? JSON.parse(localData) : JSON.parse(JSON.stringify(data));
    }
    
    function populatePriceTables() {
        const priceTableSelect = document.getElementById('priceTableSelect');
        priceTableSelect.innerHTML = Object.keys(appData.tabelas).map(name => `<option value="${name}">${name}</option>`).join('');
        currentQuote.general.priceTable = priceTableSelect.value;
    }

    // --- FUNÇÕES DE RENDERIZAÇÃO ---
    function renderAll() {
        renderDateInputs();
        renderQuoteSections();
        calculateTotal();
    }

    function renderDateInputs() {
        datesContainer.innerHTML = '';
        currentQuote.dates.forEach((dateObj, index) => {
            const div = document.createElement('div');
            div.className = 'date-entry';
            div.innerHTML = `
                <input type="date" value="${dateObj.date}" onchange="updateDate(${index}, this.value)">
                <button class="btn-remove" onclick="removeDate(${index})">&times;</button>
            `;
            datesContainer.appendChild(div);
        });
    }

    function renderQuoteSections() {
        quotesContainer.innerHTML = '';
        currentQuote.dates.forEach((dateObj, dateIndex) => {
            const template = document.getElementById('date-section-template');
            const clone = template.content.cloneNode(true);
            const dateTitle = clone.querySelector('.date-title');
            const formattedDate = dateObj.date ? new Date(dateObj.date + 'T00:00:00').toLocaleDateString('pt-BR') : `(Data #${dateIndex + 1})`;
            dateTitle.textContent += formattedDate;

            // Configura os botões de adicionar
            clone.querySelectorAll('.btn-add').forEach(btn => {
                btn.dataset.dateIndex = dateIndex;
            });
            
            quotesContainer.appendChild(clone);
            
            // Renderiza as tabelas para esta data
            renderTableForDate(dateIndex);
        });
    }

    function renderTableForDate(dateIndex) {
        const dateObj = currentQuote.dates[dateIndex];
        const dateSection = quotesContainer.children[dateIndex];
        const prices = getCalculatedPrices(currentQuote.general.priceTable);
        const guestCount = currentQuote.general.guestCount;

        for (const category in dateObj) {
            if (category === 'date') continue;
            
            const tableBody = dateSection.querySelector(`[data-category="${getCategoryDisplayName(category)}"]`).closest('.category-card').querySelector('tbody');
            tableBody.innerHTML = '';
            
            dateObj[category].forEach((item, itemIndex) => {
                const service = appData.servicos.find(s => s.id === item.id);
                const unitPrice = prices[service.id] || 0;
                
                let quantity, total, quantityHTML, columns;

                if (service.categoria === 'Espaço') {
                    quantity = item.quantity || 1;
                    total = unitPrice * quantity;
                    columns = `
                        <td>${service.nome}</td>
                        <td>R$ ${total.toFixed(2)}</td>
                    `;
                } else {
                    quantity = service.unidade === 'por_pessoa' ? guestCount : (item.quantity || 1);
                    total = unitPrice * quantity;
                    columns = `
                        <td>${service.nome}</td>
                        <td>R$ ${unitPrice.toFixed(2)}</td>
                        <td><input type="number" value="${quantity}" min="1" ${service.unidade === 'por_pessoa' ? 'disabled' : ''} onchange="updateQuantity(${dateIndex}, '${category}', ${itemIndex}, this.value)"></td>
                        <td>R$ ${total.toFixed(2)}</td>
                    `;
                }
                
                const row = document.createElement('tr');
                row.innerHTML = `
                    ${columns}
                    <td><button class="btn-details" onclick="openDetailsModal(${dateIndex}, '${category}', ${itemIndex})">...</button></td>
                    <td><button class="btn-remove" onclick="removeItem(${dateIndex}, '${category}', ${itemIndex})">&times;</button></td>
                `;
                tableBody.appendChild(row);
            });
        }
    }
    
    // --- LÓGICA DE CÁLCULO ---
    function calculateTotal() {
        //... (lógica para iterar sobre currentQuote.dates, somar tudo e atualizar o resumo)
    }

    // --- MANIPULADORES DE EVENTOS ---
    function addEventListeners() {
        addDateBtn.addEventListener('click', () => {
            currentQuote.dates.push({
                date: '',
                espaco: [],
                gastronomia: [],
                equipamentos: [],
                servicosoutros: [] // Chave simplificada
            });
            renderAll();
        });
        // ... (outros listeners para guestCount, priceTable, discount, etc.)
    }

    // --- FUNÇÕES GLOBAIS (window.) PARA INTERAÇÃO DO HTML ---
    window.updateDate = (index, value) => {
        currentQuote.dates[index].date = value;
        renderAll();
    };
    window.removeDate = (index) => {
        currentQuote.dates.splice(index, 1);
        renderAll();
    };
    // ... (outras funções globais como removeItem, updateQuantity, openDetailsModal)

    // --- FUNÇÕES AUXILIARES ---
    function getCategoryDisplayName(key) {
        if(key === 'servicosoutros') return 'Serviços / Outros';
        return key.charAt(0).toUpperCase() + key.slice(1);
    }
    function getCalculatedPrices(tableName) {
        // ... (função mantida da versão anterior)
    }

    // --- INICIALIZAÇÃO ---
    initialize();
});
