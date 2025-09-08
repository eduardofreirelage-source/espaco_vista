// ===================================================================================
// ARQUIVO CENTRAL DE DADOS DO SISTEMA
// ===================================================================================

const data = {
    // 1. LISTA MESTRA DE SERVIÇOS
    // Contém todos os serviços que sua empresa oferece. O preço não fica aqui.
    servicos: [
        // Locação
        { id: "loc01", categoria: "LOCAÇÃO DO ESPAÇO", nome: "Sexta e Sábado - Horário Nobre (08 horas)", unidade: "diaria" },
        { id: "loc02", categoria: "LOCAÇÃO DO ESPAÇO", nome: "Sexta e Sábado - Outros Horários (05 horas)", unidade: "diaria" },
        { id: "loc03", categoria: "LOCAÇÃO DO ESPAÇO", nome: "Domingo a Quinta - Horário Nobre (08 horas)", unidade: "diaria" },
        { id: "loc04", categoria: "LOCAÇÃO DO ESPAÇO", nome: "Domingo a Quinta - Outros Horários (05 horas)", unidade: "diaria" },
        // Buffet
        { id: "buf01", categoria: "SERVIÇOS DE BUFFET", nome: "Cardápio Coquetel", unidade: "por_pessoa" },
        { id: "buf02", categoria: "SERVIÇOS DE BUFFET", nome: "Cardápio Butiquim", unidade: "por_pessoa" },
        { id: "buf03", categoria: "SERVIÇOS DE BUFFET", nome: "Cardápio Personalizado", unidade: "por_pessoa" },
        // Bebidas
        { id: "beb01", categoria: "BEBIDAS", nome: "Pacote de Bebidas 1 (Refrigerante, Suco, Água)", unidade: "por_pessoa" },
        { id: "beb02", categoria: "BEBIDAS", nome: "Chopp", unidade: "por_pessoa" },
        // Opcionais
        { id: "opc01", categoria: "SERVIÇOS OPCIONAIS", nome: "Mesa de Café da Manhã", unidade: "por_pessoa" },
        { id: "opc02", categoria: "SERVIÇOS OPCIONAIS", nome: "Música ao Vivo", unidade: "unidade" },
        { id: "opc03", categoria: "SERVIÇOS OPCIONAIS", nome: "DJ", unidade: "unidade" },
        { id: "opc04", categoria: "SERVIÇOS OPCIONAIS", nome: "Decoração", unidade: "unidade" },
        // Equipe
        { id: "equ01", categoria: "EQUIPE", nome: "Garçom", unidade: "unidade" },
        { id: "equ02", categoria: "EQUIPE", nome: "Segurança", unidade: "unidade" },
        { id: "equ03", categoria: "EQUIPE", nome: "Recepcionista", unidade: "unidade" }
    ],

    // 2. TABELAS DE PREÇOS
    // Cada tabela contém os preços para os serviços listados acima.
    tabelas: {
        "Tabela A (Padrão 2025)": {
            tipo: "base",
            precos: {
                "loc01": 15000.00, "loc02": 10000.00, "loc03": 12000.00, "loc04": 8000.00,
                "buf01": 165.00, "buf02": 185.00, "buf03": 215.00,
                "beb01": 20.00, "beb02": 30.00,
                "opc01": 15.00, "opc02": 3500.00, "opc03": 2500.00, "opc04": 5000.00,
                "equ01": 200.00, "equ02": 250.00, "equ03": 250.00
            }
        },
        "Tabela B (Parceiros +10%)": {
            tipo: "derivada",
            base: "Tabela A (Padrão 2025)", // Baseada na Tabela A
            modificador: 1.10 // +10%
        },
        "Tabela C (Eventos Corporativos -5%)": {
            tipo: "derivada",
            base: "Tabela A (Padrão 2025)",
            modificador: 0.95 // -5%
        }
    }
};
