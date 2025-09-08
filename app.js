document.addEventListener('DOMContentLoaded', () => {
    let appData;
    let currentQuote = {
        espaco: {},
        gastronomia: [],
        equipamentos: [],
        servicos: []
    };

    const guestCountInput = document.getElementById('guestCount');
    const priceTableSelect = document.getElementById('priceTableSelect');
    
    function loadData() {
        const localData = localStorage.getItem('orcamentoData');
        appData = localData ? JSON.parse(localData) : JSON.parse(JSON.stringify(data));
    }
    
    function populatePriceTables() {
        priceTableSelect.innerHTML = '';
        for (const tableName in appData.tabelas) {
            priceTableSelect.innerHTML += `<option value="${tableName}">${tableName}</option>`;
        }
    }

    function getCalculatedPrices(tableName) {
        const table = appData.tabelas[tableName];
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

    function renderQuote() {
        const guestCount = parseInt(guestCountInput.value) || 0;
        
        // Renderiza tabelas dinâmicas
        renderTable('gastronomia', guestCount);
        renderTable('equipamentos');
        renderTable('servicos');

        calculateTotal();
    }
    
    function renderTable(categoryKey, lockedQuantity = null) {
        const tableBody = document.getElementById(`${categoryKey}-table`).querySelector('tbody');
        const items = currentQuote[categoryKey];
        const prices = getCalculatedPrices(priceTableSelect.value);

        tableBody.innerHTML = '';
        items.forEach((item, index) => {
            const service = appData.servicos.find(s => s.id === item.id);
            const unitPrice = prices[item.id] || 0;
            const quantity = lockedQuantity !== null ? lockedQuantity : item.quantity;
            const total = unitPrice * quantity;

            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${service.nome}</td>
                <td>R$ ${unitPrice.toFixed(2)}</td>
                <td><input type="number" value="${quantity}" min="1" ${lockedQuantity !== null ? 'disabled' : ''} onchange="updateQuantity('${categoryKey}', ${index}, this.value)"></td>
                <td>R$ ${total.toFixed(2)}</td>
                <td><button class="btn-remove" onclick="removeItem('${categoryKey}', ${index})">&times;</button></td>
            `;
            tableBody.appendChild(row);
        });
    }

    function calculateTotal() {
        const guestCount = parseInt(guestCountInput.value) || 0;
        const prices = getCalculatedPrices(priceTableSelect.value);
        let subtotal = 0;
        let gastronomySubtotal = 0;

        // Soma Espaço
        subtotal += parseFloat(document.getElementById('espacoValor').value) || 0;

        // Soma Gastronomia
        currentQuote.gastronomia.forEach(item => {
            const price = prices[item.id] || 0;
            const itemTotal = price * guestCount;
            subtotal += itemTotal;
            gastronomySubtotal += itemTotal;
        });
        
        // Soma Equipamentos e Serviços
        ['equipamentos', 'servicos'].forEach(categoryKey => {
            currentQuote[categoryKey].forEach(item => {
                const price = prices[item.id] || 0;
                subtotal += price * item.quantity;
            });
        });

        const serviceFee = gastronomySubtotal * 0.10;
        const total = subtotal + serviceFee;
        
        document.getElementById('subtotalValue').textContent = `R$ ${subtotal.toFixed(2)}`;
        document.getElementById('serviceFeeValue').textContent = `R$ ${serviceFee.toFixed(2)}`;
        document.getElementById('totalValue').textContent = `R$ ${total.toFixed(2)}`;
    }

    // --- Lógica do Modal ---
    const modal = document.getElementById('addItemModal');
    const closeButton = document.querySelector('.close-button');
    let currentCategoryToAdd = '';

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
            modal.style.display = 'block';
        });
    });

    closeButton.onclick = () => modal.style.display = 'none';
    window.onclick = (event) => { if (event.target == modal) modal.style.display = 'none'; };

    window.addItemToQuote = (serviceId) => {
        const categoryKey = currentCategoryToAdd.toLowerCase().replace(' / ', '-').replace('ç', 'c').replace('õ', 'o'); // 'servicos-outros'
        currentQuote[categoryKey].push({ id: serviceId, quantity: 1 });
        modal.style.display = 'none';
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

    // --- Inicialização ---
    loadData();
    populatePriceTables();
    renderQuote();
    document.body.addEventListener('input', calculateTotal);
    priceTableSelect.addEventListener('change', renderQuote);
});document.addEventListener('DOMContentLoaded', () => {
    // --- ESTADO DA APLICAÇÃO ---
    let appData;

    // --- FUNÇÕES DE DADOS ---
    function loadData() {
        const localData = localStorage.getItem('orcamentoData');
        if (localData) {
            appData = JSON.parse(localData);
        } else {
            // Se não há nada salvo, usa os dados padrão do dados.js
            alert("Nenhum dado de preço encontrado. Carregando dados padrão. Acesse a página admin.html para configurar.");
            appData = JSON.parse(JSON.stringify(data));
        }
    }
    
    // O restante do app.js da versão anterior pode ser mantido,
    // apenas garantindo que ele use a variável `appData` em vez de `data`.
    // Por clareza, aqui está o código completo e correto:

    const serviceCategoriesContainer = document.getElementById('service-categories');
    const guestCountInput = document.getElementById('guestCount');
    const priceTableSelect = document.getElementById('priceTableSelect');

    function getPrecosCalculados(nomeTabela) {
        const tabela = appData.tabelas[nomeTabela];
        if (!tabela) return {};
        if (tabela.tipo === 'base') return tabela.precos;
        if (tabela.tipo === 'derivada') {
            const basePrecos = getPrecosCalculados(tabela.base);
            const precosCalculados = {};
            for (const idServico in basePrecos) {
                precosCalculados[idServico] = basePrecos[idServico] * tabela.modificador;
            }
            return precosCalculados;
        }
        return {};
    }

    function popularTabelasDePreco() {
        priceTableSelect.innerHTML = '';
        for (const nomeTabela in appData.tabelas) {
            const option = document.createElement('option');
            option.value = nomeTabela;
            option.textContent = nomeTabela;
            priceTableSelect.appendChild(option);
        }
    }

    function renderServices() {
        const nomeTabelaSelecionada = priceTableSelect.value;
        const precosAtuais = getPrecosCalculados(nomeTabelaSelecionada);
        const servicosAgrupados = agruparServicosPorCategoria(appData.servicos);

        serviceCategoriesContainer.innerHTML = '';
        for (const categoria in servicosAgrupados) {
            const categoryDiv = document.createElement('div');
            categoryDiv.className = 'category';
            const categoryTitle = document.createElement('h3');
            categoryTitle.className = 'category-title';
            categoryTitle.textContent = categoria;
            categoryDiv.appendChild(categoryTitle);
            
            servicosAgrupados[categoria].forEach(servico => {
                const preco = precosAtuais[servico.id] || 0;
                const tipoInput = servico.categoria === 'LOCAÇÃO DO ESPAÇO' ? 'radio' : 'checkbox';
                const nomeInput = servico.categoria === 'LOCAÇÃO DO ESPAÇO' ? 'locacao_espaco' : servico.id;

                const itemDiv = document.createElement('div');
                itemDiv.className = 'item';
                itemDiv.innerHTML = `
                    <label class="item-label" for="${servico.id}">
                        <input type="${tipoInput}" id="${servico.id}" name="${nomeInput}" data-id="${servico.id}">
                        <span>${servico.nome}</span>
                    </label>
                    <span class="item-price">R$ ${preco.toFixed(2)} / ${formatUnit(servico.unidade)}</span>
                `;
                categoryDiv.appendChild(itemDiv);
            });
            serviceCategoriesContainer.appendChild(categoryDiv);
        }
        calculateQuote();
    }
    
    function calculateQuote() {
        // (Esta função continua a mesma da versão anterior, sem alterações necessárias)
        const guestCount = parseInt(guestCountInput.value) || 0;
        const nomeTabelaSelecionada = priceTableSelect.value;
        const precosAtuais = getPrecosCalculados(nomeTabelaSelecionada);
        let subtotal = 0, buffetAndBeverageSubtotal = 0;
        const selectedInputs = document.querySelectorAll('input[type="checkbox"]:checked, input[type="radio"]:checked');
        selectedInputs.forEach(input => {
            const servicoId = input.dataset.id;
            const servico = appData.servicos.find(s => s.id === servicoId);
            if (!servico) return;
            const preco = precosAtuais[servicoId] || 0;
            let itemTotal = (servico.unidade === 'por_pessoa') ? preco * guestCount : preco;
            subtotal += itemTotal;
            if (servico.categoria === "SERVIÇO DE BUFFET" || servico.categoria === "BEBIDAS") {
                buffetAndBeverageSubtotal += itemTotal;
            }
        });
        const serviceFee = buffetAndBeverageSubtotal * 0.10;
        const total = subtotal + serviceFee;
        updateSummary(subtotal, serviceFee, total, guestCount, selectedInputs.length > 0);
    }
    
    function agruparServicosPorCategoria(servicos) { return servicos.reduce((acc, servico) => { (acc[servico.categoria] = acc[servico.categoria] || []).push(servico); return acc; }, {}); }
    function formatUnit(unit) { const units = { "por_pessoa": "Pessoa", "unidade": "Unid.", "diaria": "Pacote" }; return units[unit] || unit; }
    function updateSummary(subtotal, serviceFee, total, guests, hasSelection) {
        document.getElementById('subtotalServicesValue').textContent = `R$ ${subtotal.toFixed(2)}`;
        document.getElementById('serviceFeeValue').textContent = `R$ ${serviceFee.toFixed(2)}`;
        document.getElementById('totalValue').textContent = `R$ ${total.toFixed(2)}`;
        document.getElementById('summary-content').innerHTML = hasSelection ? `<p>Proposta calculada para <strong>${guests}</strong> convidado(s).</p>` : `<p>Selecione os serviços para iniciar.</p>`;
    }
    
    loadData();
    popularTabelasDePreco();
    renderServices();
    priceTableSelect.addEventListener('change', renderServices);
    document.body.addEventListener('change', calculateQuote);
    document.body.addEventListener('input', calculateQuote);
    document.getElementById('printButton').addEventListener('click', () => window.print());
});
