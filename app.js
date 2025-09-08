document.addEventListener('DOMContentLoaded', () => {
    let appData;
    let currentQuote = {
        espaco: [],
        gastronomia: [],
        equipamentos: [],
        'servicos-outros': []
    };

    // --- ELEMENTOS DO DOM ---
    const guestCountInput = document.getElementById('guestCount');
    const dayCountInput = document.getElementById('dayCount');
    const priceTableSelect = document.getElementById('priceTableSelect');
    const quoteSections = document.getElementById('quote-sections');
    const discountInput = document.getElementById('discountValue');

    // --- FUNÇÕES DE DADOS ---
    function loadData() {
        const localData = localStorage.getItem('orcamentoData');
        appData = localData ? JSON.parse(localData) : JSON.parse(JSON.stringify(data));
    }
    
    function getCalculatedPrices(tableName) {
        const table = appData.tabelas[tableName];
        if (!table) return {};
        if (table.tipo === 'base') return table.precos;
        if (table.tipo === 'derivada') {
            const basePrices = getCalculatedPrices(table.base);
            const calculatedPrices = {};
            for (const serviceId in basePrices) {
                calculatedPrices[serviceId] = basePrices[serviceId] * table.modificador;
            }
            return calculatedPrices;
        }
        return {};
    }

    // --- FUNÇÕES DE RENDERIZAÇÃO ---
    function renderApp() {
        renderQuoteSections();
        renderQuote();
    }
    
    function renderQuoteSections() {
        quoteSections.innerHTML = '';
        const categories = ['Espaço', 'Gastronomia', 'Equipamentos', 'Serviços / Outros'];
        categories.forEach(category => {
            const categoryKey = category.toLowerCase().replace(' / ', '-');
            quoteSections.innerHTML += `
            <section class="card">
                <div class="category-header">
                    <h2>${category}</h2>
                    <button class="btn btn-add" data-category="${category}">+ Adicionar Item</button>
                </div>
                <table class="quote-table" id="${categoryKey}-table">
                    <thead><tr><th>Descrição</th><th>Vlr. Unitário</th><th>Qtde.</th><th>Dias</th><th>Total</th><th></th></tr></thead>
                    <tbody></tbody>
                </table>
            </section>`;
        });
        addEventListenersToAddButtons();
    }
    
    function renderQuote() {
        const guestCount = parseInt(guestCountInput.value) || 0;
        const dayCount = parseInt(dayCountInput.value) || 1;
        
        for (const categoryKey in currentQuote) {
            renderTable(categoryKey, guestCount, dayCount);
        }
        calculateTotal();
    }
    
    function renderTable(categoryKey, guestCount, dayCount) {
        const tableBody = document.getElementById(`${categoryKey}-table`)?.querySelector('tbody');
        if (!tableBody) return;
        
        const items = currentQuote[categoryKey];
        const prices = getCalculatedPrices(priceTableSelect.value);
        tableBody.innerHTML = '';
        
        items.forEach((item, index) => {
            const service = appData.servicos.find(s => s.id === item.id);
            const unitPrice = prices[item.id] || 0;
            const isPerDay = service.unidade === 'diaria';
            const isPerPerson = service.unidade === 'por_pessoa';
            
            const quantity = isPerPerson ? guestCount : item.quantity;
            const days = isPerDay ? dayCount : 1;
            const total = unitPrice * quantity * days;

            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${service.nome}</td>
                <td>R$ ${unitPrice.toFixed(2)}</td>
                <td><input type="number" value="${quantity}" min="1" ${isPerPerson ? 'disabled' : ''} onchange="updateQuantity('${categoryKey}', ${index}, this.value)"></td>
                <td>${days}</td>
                <td>R$ ${total.toFixed(2)}</td>
                <td class="actions">
                    <button class="btn-details" onclick="openDetailsModal('${categoryKey}', ${index})">...</button>
                    <button class="btn-remove" onclick="removeItem('${categoryKey}', ${index})">&times;</button>
                </td>
            `;
            tableBody.appendChild(row);
        });
    }

    function calculateTotal() {
        const guestCount = parseInt(guestCountInput.value) || 0;
        const dayCount = parseInt(dayCountInput.value) || 1;
        const prices = getCalculatedPrices(priceTableSelect.value);
        const discount = parseFloat(discountInput.value) || 0;
        let subtotal = 0;
        let gastronomySubtotal = 0;

        for (const categoryKey in currentQuote) {
            currentQuote[categoryKey].forEach(item => {
                const service = appData.servicos.find(s => s.id === item.id);
                const price = prices[item.id] || 0;
                const isPerDay = service.unidade === 'diaria';
                const isPerPerson = service.unidade === 'por_pessoa';

                const quantity = isPerPerson ? guestCount : item.quantity;
                const days = isPerDay ? dayCount : 1;
                const itemTotal = price * quantity * days;

                subtotal += itemTotal;
                if (service.categoria === 'Gastronomia') {
                    gastronomySubtotal += itemTotal;
                }
            });
        }
        
        const serviceFee = gastronomySubtotal * 0.10;
        const total = subtotal + serviceFee - discount;

        document.getElementById('subtotalValue').textContent = `R$ ${subtotal.toFixed(2)}`;
        document.getElementById('serviceFeeValue').textContent = `R$ ${serviceFee.toFixed(2)}`;
        document.getElementById('totalValue').textContent = `R$ ${total.toFixed(2)}`;
    }

    // --- LÓGICA DOS MODAIS ---
    const addItemModal = document.getElementById('addItemModal');
    const detailsModal = document.getElementById('detailsModal');
    let currentCategoryToAdd = '';
    let currentItemToEdit = { categoryKey: null, index: null };

    function addEventListenersToAddButtons() {
        document.querySelectorAll('.btn-add').forEach(button => {
            button.addEventListener('click', () => {
                currentCategoryToAdd = button.dataset.category;
                document.getElementById('modalCategoryTitle').textContent = currentCategoryToAdd;
                const itemList = document.getElementById('modalItemList');
                itemList.innerHTML = '';
                appData.servicos
                    .filter(s => s.categoria === currentCategoryToAdd)
                    .forEach(service => {
                        const itemDiv = document.createElement('div');
                        itemDiv.className = 'modal-item';
                        itemDiv.textContent = service.nome;
                        itemDiv.onclick = () => addItemToQuote(service.id);
                        itemList.appendChild(itemDiv);
                    });
                addItemModal.style.display = 'block';
            });
        });
    }

    window.openDetailsModal = (categoryKey, index) => {
        currentItemToEdit = { categoryKey, index };
        const item = currentQuote[categoryKey][index];
        const service = appData.servicos.find(s => s.id === item.id);
        const modalBody = document.getElementById('detailsModalBody');
        
        // Define campos com base na categoria
        let fieldsHTML = `
            <div class="form-group">
                <label>Data</label><input type="date" id="detailsData" value="${item.data || ''}">
            </div>
            <div class="form-group">
                <label>Observações</label><textarea id="detailsObs" rows="3">${item.observacoes || ''}</textarea>
            </div>
        `;
        if (service.categoria === 'Espaço') {
            fieldsHTML += `<div class="form-group"><label>Montagem</label><input type="text" id="detailsMontagem" value="${item.montagem || ''}"></div>`;
        }
        if (service.categoria === 'Gastronomia') {
            fieldsHTML += `<div class="form-group"><label>Horário</label><input type="time" id="detailsHorario" value="${item.horario || ''}"></div>`;
        }
        
        modalBody.innerHTML = fieldsHTML;
        document.getElementById('detailsModalTitle').textContent = `Detalhes de: ${service.nome}`;
        detailsModal.style.display = 'block';
    };

    document.getElementById('saveDetailsButton').addEventListener('click', () => {
        const { categoryKey, index } = currentItemToEdit;
        const item = currentQuote[categoryKey][index];
        const service = appData.servicos.find(s => s.id === item.id);

        item.data = document.getElementById('detailsData').value;
        item.observacoes = document.getElementById('detailsObs').value;
        if (service.categoria === 'Espaço') {
            item.montagem = document.getElementById('detailsMontagem').value;
        }
        if (service.categoria === 'Gastronomia') {
            item.horario = document.getElementById('detailsHorario').value;
        }
        detailsModal.style.display = 'none';
    });

    // --- FUNÇÕES GLOBAIS DE MANIPULAÇÃO DO ORÇAMENTO ---
    window.addItemToQuote = (serviceId) => {
        const service = appData.servicos.find(s => s.id === serviceId);
        const categoryKey = service.categoria.toLowerCase().replace(' / ', '-');
        currentQuote[categoryKey].push({ id: serviceId, quantity: 1 });
        addItemModal.style.display = 'none';
        renderQuote();
    };
    
    window.removeItem = (categoryKey, index) => {
        currentQuote[categoryKey].splice(index, 1);
        renderQuote();
    };

    window.updateQuantity = (categoryKey, index, newQuantity) => {
        currentQuote[categoryKey][index].quantity = parseInt(newQuantity);
        renderQuote();
    };

    // --- INICIALIZAÇÃO E EVENT LISTENERS ---
    loadData();
    document.getElementById('priceTableSelect').innerHTML = Object.keys(appData.tabelas).map(name => `<option value="${name}">${name}</option>`).join('');
    renderApp();
    
    document.body.addEventListener('input', (e) => {
        if (e.target.closest('.summary-card') || e.target.closest('#dados-evento')) {
            renderQuote();
        }
    });

    // Fechar modais
    document.querySelectorAll('.close-button').forEach(btn => btn.onclick = () => {
        addItemModal.style.display = 'none';
        detailsModal.style.display = 'none';
    });
    window.onclick = (event) => {
        if (event.target == addItemModal) addItemModal.style.display = 'none';
        if (event.target == detailsModal) detailsModal.style.display = 'none';
    };
});
