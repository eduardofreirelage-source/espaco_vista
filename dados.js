const data = {
    // CATÁLOGO DE SERVIÇOS
    servicos: [
        // Itens de Espaço
        { id: "esp01", nome: "Salão Nobre (Sexta/Sábado)", categoria: "Espaço", unidade: "diaria" },
        { id: "esp02", nome: "Salão Nobre (Domingo a Quinta)", categoria: "Espaço", unidade: "diaria" },
        { id: "esp03", nome: "Área Externa (Deck)", categoria: "Espaço", unidade: "diaria" },

        // Itens de Gastronomia
        { id: "buf01", nome: "Cardápio Coquetel", categoria: "Gastronomia", unidade: "por_pessoa" },
        { id: "buf02", nome: "Cardápio Butiquim", categoria: "Gastronomia", unidade: "por_pessoa" },
        { id: "opc01", nome: "Mesa de Café da Manhã", categoria: "Gastronomia", unidade: "por_pessoa" },
        { id: "beb01", nome: "Pacote de Bebidas (Não Alcoólicos)", categoria: "Gastronomia", unidade: "por_pessoa" },

        // Itens de Equipamentos
        { id: "eqp01", nome: "DJ e Iluminação", categoria: "Equipamentos", unidade: "unidade" },
        { id: "eqp02", nome: "Música ao Vivo", categoria: "Equipamentos", unidade: "unidade" },

        // Itens de Serviços / Outros
        { id: "srv01", nome: "Decoração Padrão", categoria: "Serviços / Outros", unidade: "unidade" },
        { id: "srv02", nome: "Garçom (por profissional)", categoria: "Serviços / Outros", unidade: "unidade" },
        { id: "srv03", nome: "Segurança (por profissional)", categoria: "Serviços / Outros", unidade: "unidade" }
    ],

    // TABELAS DE PREÇOS
    tabelas: {
        "Tabela Padrão": {
            tipo: "base",
            precos: {
                "esp01": 15000.00, "esp02": 12000.00, "esp03": 7000.00,
                "buf01": 165.00, "buf02": 185.00, "opc01": 15.00, "beb01": 20.00,
                "eqp01": 2500.00, "eqp02": 3500.00,
                "srv01": 5000.00, "srv02": 200.00, "srv03": 250.00
            }
        },
        "Tabela Parceiros (+10%)": {
            tipo: "derivada",
            base: "Tabela Padrão",
            modificador: 1.10
        }
    }
};
