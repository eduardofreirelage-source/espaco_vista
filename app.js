document.addEventListener('DOMContentLoaded', () => {

    // ===================================================================================
    // BANCO DE DADOS EXTRAÍDO DIRETAMENTE DA SUA PLANILHA "Investimento"
    // A estrutura de categorias, itens, preços e unidades foi replicada.
    // ===================================================================================
    const database = {
        "LOCAÇÃO DO ESPAÇO": [
            { id: "loc01", nome: "Sexta e Sábado - Horário Nobre (08 horas)", preco: 15000.00, unidade: "diaria" },
            { id: "loc02", nome: "Sexta e Sábado - Outros Horários (05 horas)", preco: 10000.00, unidade: "diaria" },
            { id: "loc03", nome: "Domingo a Quinta - Horário Nobre (08 horas)", preco: 12000.00, unidade: "diaria" },
            { id: "loc04", nome: "Domingo a Quinta - Outros Horários (05 horas)", preco: 8000.00, unidade: "diaria" }
        ],
        "SERVIÇOS DE BUFFET": [
            { id: "buf01", nome: "Cardápio Coquetel", preco: 165.00, unidade: "por_pessoa" },
            { id: "buf02", nome: "Cardápio Butiquim", preco: 185.00, unidade: "por_pessoa" },
            { id: "buf03", nome: "Cardápio Personalizado", preco: 215.00, unidade: "por_pessoa" }
        ],
        "BEBIDAS": [
            { id: "beb01", nome: "Pacote de Bebidas 1 (Refrigerante, Suco, Água)", preco: 20.00, unidade: "por_pessoa" },
            { id: "beb02", nome: "Chopp", preco: 30.00, unidade: "por_pessoa" }
        ],
        "SERVIÇOS OPCIONAIS": [
            { id: "opc01", nome: "Mesa de Café da Manhã", preco: 15.00, unidade: "por_pessoa" },
            { id: "opc02", nome: "Música ao Vivo", preco: 3500.00, unidade: "unidade" },
            { id: "opc03", nome: "DJ", preco: 2500.00, unidade: "unidade" },
            { id: "opc04", nome: "Decoração", preco: 5000.00, unidade: "unidade" }
        ],
        "EQUIPE": [
            { id: "equ01", nome: "Garçom", preco: 200.00, unidade: "unidade" },
            { id: "equ02", nome: "Segurança", preco: 250.00, unidade: "unidade" },
            { id: "equ03", nome: "Recepcionista", preco: 250.00, unidade: "unidade" }
        ]
    };
    // ===================================================================================

    const serviceCategoriesContainer = document.getElementById('service-categories');
    const guestCountInput = document.getElementById('guestCount');

    function renderServices() {
        serviceCategoriesContainer.innerHTML = '';
        for (const category in database) {
            const categoryDiv = document.createElement('div');
            categoryDiv.className = 'category';

            const categoryTitle = document.createElement('h3');
            categoryTitle.className = 'category-title';
            categoryTitle.textContent = category;
            categoryDiv.appendChild(categoryTitle);

            // REGRA ESPECIAL: Locação do Espaço usa radio buttons (escolha única)
            if (category === "LOCAÇÃO DO ESPAÇO") {
                database[category].forEach(item => {
                    const itemDiv = document.createElement('div');
                    itemDiv.className = 'radio-item';
                    itemDiv.innerHTML = `
                        <label class="radio-label" for="${item.id}">
                            <input type="radio" id="${item.id}" name="locacao_espaco" data-price="${item.preco}" data-unit="${item.unidade}" data-category="${category}">
                            <span>${item.nome}</span>
                        </label>
                        <span class="item-price">R$ ${item.preco.toFixed(2)}</span>
                    `;
                    categoryDiv.appendChild(itemDiv);
                });
            } else { // Outras categorias usam checkboxes (múltipla escolha)
                database[category].forEach(item => {
                    const itemDiv = document.createElement('div');
                    itemDiv.className = 'item';
                    itemDiv.innerHTML = `
                        <label class="item-label" for="${item.id}">
                            <input type="checkbox" id="${item.id}" data-price="${item.preco}" data-unit="${item.unidade}" data-category="${category}">
                            <span>${item.nome}</span>
                        </label>
                        <span class="item-price">R$ ${item.preco.toFixed(2)} / ${formatUnit(item.unidade)}</span>
                    `;
                    categoryDiv.appendChild(itemDiv);
                });
            }
            serviceCategoriesContainer.appendChild(categoryDiv);
        }
    }

    function formatUnit(unit) {
        const units = { "por_pessoa": "Pessoa", "unidade": "Unid.", "diaria": "Pacote" };
        return units[unit] || unit;
    }

    function calculateQuote() {
        const guestCount = parseInt(guestCountInput.value) || 0;
        let subtotal = 0;
        let buffetAndBeverageSubtotal = 0;

        const selectedItems = document.querySelectorAll('input[type="checkbox"]:checked, input[type="radio"]:checked');
        
        selectedItems.forEach(item => {
            const price = parseFloat(item.dataset.price);
            const unit = item.dataset.unit;
            const category = item.dataset.category;
            let itemTotal = 0;

            if (unit === 'por_pessoa') {
                itemTotal = price * guestCount;
            } else { // unidade, diaria, por_hora
                itemTotal = price;
            }
            
            subtotal += itemTotal;

            // REGRA ESPECIAL: Soma em separado para a taxa de serviço
            if (category === "SERVIÇOS DE BUFFET" || category === "BEBIDAS") {
                buffetAndBeverageSubtotal += itemTotal;
            }
        });

        const serviceFee = buffetAndBeverageSubtotal * 0.10; // Taxa de serviço de 10% sobre Buffet e Bebidas
        const total = subtotal + serviceFee;
        
        updateSummary(subtotal, serviceFee, total, guestCount, selectedItems.length > 0);
    }

    function updateSummary(subtotal, serviceFee, total, guests, hasSelection) {
        const subtotalEl = document.getElementById('subtotalServicesValue');
        const serviceFeeEl = document.getElementById('serviceFeeValue');
        const totalEl = document.getElementById('totalValue');
        const summaryContent = document.getElementById('summary-content');

        if (!hasSelection) {
            summaryContent.innerHTML = `<p>Selecione os serviços para iniciar.</p>`;
            subtotalEl.textContent = 'R$ 0,00';
            serviceFeeEl.textContent = 'R$ 0,00';
            totalEl.textContent = 'R$ 0,00';
            return;
        }

        summaryContent.innerHTML = `<p>Proposta calculada para <strong>${guests}</strong> convidado(s).</p>`;
        subtotalEl.textContent = `R$ ${subtotal.toFixed(2)}`;
        serviceFeeEl.textContent = `R$ ${serviceFee.toFixed(2)}`;
        totalEl.textContent = `R$ ${total.toFixed(2)}`;
    }
    
    // Inicia a aplicação e adiciona os "escutadores" para recalcular
    renderServices();
    document.body.addEventListener('change', calculateQuote);
    document.body.addEventListener('input', calculateQuote);

    // Funcionalidade de impressão (simplificada)
    document.getElementById('printButton').addEventListener('click', () => {
        window.print();
    });
});
