document.addEventListener('DOMContentLoaded', () => {
    // Referências aos elementos da página
    const serviceCategoriesContainer = document.getElementById('service-categories');
    const guestCountInput = document.getElementById('guestCount');
    const priceTableSelect = document.getElementById('priceTableSelect');

    // Função para calcular os preços de uma tabela derivada
    function getPrecosCalculados(nomeTabela) {
        const tabela = data.tabelas[nomeTabela];
        if (tabela.tipo === 'base') {
            return tabela.precos;
        }
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

    // Função para popular o seletor de tabelas de preço
    function popularTabelasDePreco() {
        for (const nomeTabela in data.tabelas) {
            const option = document.createElement('option');
            option.value = nomeTabela;
            option.textContent = nomeTabela;
            priceTableSelect.appendChild(option);
        }
    }

    // Função para renderizar os serviços na tela com base na tabela de preço selecionada
    function renderServices() {
        const nomeTabelaSelecionada = priceTableSelect.value;
        const precosAtuais = getPrecosCalculados(nomeTabelaSelecionada);
        const servicosAgrupados = agruparServicosPorCategoria(data.servicos);

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
        calculateQuote(); // Recalcula ao renderizar
    }

    function calculateQuote() {
        const guestCount = parseInt(guestCountInput.value) || 0;
        const nomeTabelaSelecionada = priceTableSelect.value;
        const precosAtuais = getPrecosCalculados(nomeTabelaSelecionada);
        
        let subtotal = 0;
        let buffetAndBeverageSubtotal = 0;
        
        const selectedInputs = document.querySelectorAll('input[type="checkbox"]:checked, input[type="radio"]:checked');
        
        selectedInputs.forEach(input => {
            const servicoId = input.dataset.id;
            const servico = data.servicos.find(s => s.id === servicoId);
            if (!servico) return;

            const preco = precosAtuais[servicoId] || 0;
            let itemTotal = 0;

            if (servico.unidade === 'por_pessoa') {
                itemTotal = preco * guestCount;
            } else {
                itemTotal = preco;
            }
            
            subtotal += itemTotal;

            if (servico.categoria === "SERVIÇOS DE BUFFET" || servico.categoria === "BEBIDAS") {
                buffetAndBeverageSubtotal += itemTotal;
            }
        });

        const serviceFee = buffetAndBeverageSubtotal * 0.10;
        const total = subtotal + serviceFee;
        
        updateSummary(subtotal, serviceFee, total, guestCount, selectedInputs.length > 0);
    }
    
    // Funções auxiliares (não mudaram muito)
    function agruparServicosPorCategoria(servicos) {
        return servicos.reduce((acc, servico) => {
            (acc[servico.categoria] = acc[servico.categoria] || []).push(servico);
            return acc;
        }, {});
    }
    function formatUnit(unit) {
        const units = { "por_pessoa": "Pessoa", "unidade": "Unid.", "diaria": "Pacote" };
        return units[unit] || unit;
    }
    function updateSummary(subtotal, serviceFee, total, guests, hasSelection) {
        document.getElementById('subtotalServicesValue').textContent = `R$ ${subtotal.toFixed(2)}`;
        document.getElementById('serviceFeeValue').textContent = `R$ ${serviceFee.toFixed(2)}`;
        document.getElementById('totalValue').textContent = `R$ ${total.toFixed(2)}`;
        document.getElementById('summary-content').innerHTML = hasSelection ? `<p>Proposta calculada para <strong>${guests}</strong> convidado(s).</p>` : `<p>Selecione os serviços para iniciar.</p>`;
    }

    // Inicialização e Event Listeners
    popularTabelasDePreco();
    renderServices();
    
    priceTableSelect.addEventListener('change', renderServices);
    document.body.addEventListener('change', calculateQuote);
    document.body.addEventListener('input', calculateQuote);
    document.getElementById('printButton').addEventListener('click', () => window.print());
});
