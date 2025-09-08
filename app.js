document.addEventListener('DOMContentLoaded', () => {
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
