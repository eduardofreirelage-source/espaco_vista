const data = {
    // CATÁLOGO DE SERVIÇOS: Cada item agora tem um "precoBase".
    servicos: [
        { id: "esp01", nome: "Salão Nobre (Sexta/Sábado)", categoria: "Espaço", unidade: "diaria", precoBase: 13636.36 },
        { id: "esp02", nome: "Salão Nobre (Domingo a Quinta)", categoria: "Espaço", unidade: "diaria", precoBase: 10909.09 },
        { id: "buf01", nome: "Cardápio Coquetel", categoria: "Gastronomia", unidade: "por_pessoa", precoBase: 150.00 },
        { id: "buf02", nome: "Cardápio Butiquim", categoria: "Gastronomia", unidade: "por_pessoa", precoBase: 168.18 },
        { id: "eqp01", nome: "DJ e Iluminação", categoria: "Equipamentos", unidade: "unidade", precoBase: 2272.73 },
        { id: "srv02", nome: "Garçom (por profissional)", categoria: "Serviços / Outros", unidade: "unidade", precoBase: 181.82 }
    ],

    // TABELAS DE PREÇOS: Agora são apenas modificadores do Preço Base.
    // Ex: Tabela Padrão aplica um markup de 10% (multiplicador 1.1) sobre o preço base.
    tabelas: {
        "Tabela Padrão (Markup 10%)": {
            modificador: 1.10
        },
        "Tabela Parceiros (Markup 20%)": {
            modificador: 1.20
        }
    }
};
