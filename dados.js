const data = {
    // CATÁLOGO DE SERVIÇOS: A lista de todos os "produtos" que você pode adicionar a um orçamento.
    servicos: [
        // Itens de Gastronomia
        { id: "buf01", nome: "Cardápio Coquetel", categoria: "Gastronomia" },
        { id: "buf02", nome: "Cardápio Butiquim", categoria: "Gastronomia" },
        { id: "buf03", nome: "Cardápio Personalizado", categoria: "Gastronomia" },
        { id: "opc01", nome: "Mesa de Café da Manhã", categoria: "Gastronomia" },
        { id: "beb01", nome: "Pacote de Bebidas 1 (Refrigerante, Suco, Água)", categoria: "Gastronomia" },
        { id: "beb02", nome: "Chopp", categoria: "Gastronomia" },

        // Itens de Equipamentos
        { id: "eqp01", nome: "DJ e Iluminação", categoria: "Equipamentos" },
        { id: "eqp02", nome: "Música ao Vivo", categoria: "Equipamentos" },
        { id: "eqp03", nome: "Projetor e Telão", categoria: "Equipamentos" },

        // Itens de Serviços / Outros
        { id: "srv01", nome: "Decoração Padrão", categoria: "Serviços / Outros" },
        { id: "srv02", nome: "Garçom (por profissional)", categoria: "Serviços / Outros" },
        { id: "srv03", nome: "Segurança (por profissional)", categoria: "Serviços / Outros" },
        { id: "srv04", nome: "Recepcionista (por profissional)", categoria: "Serviços / Outros" }
    ],

    // TABELAS DE PREÇOS: Contém o VALOR UNITÁRIO de cada serviço do catálogo.
    tabelas: {
        "Tabela A (Padrão 2025)": {
            tipo: "base",
            precos: {
                "buf01": 165.00, "buf02": 185.00, "buf03": 215.00, "opc01": 15.00, "beb01": 20.00, "beb02": 30.00,
                "eqp01": 2500.00, "eqp02": 3500.00, "eqp03": 800.00,
                "srv01": 5000.00, "srv02": 200.00, "srv03": 250.00, "srv04": 250.00
            }
        },
        "Tabela B (Parceiros +10%)": {
            tipo: "derivada",
            base: "Tabela A (Padrão 2025)",
            modificador: 1.10
        }
    }
};
