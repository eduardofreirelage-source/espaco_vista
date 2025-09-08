import { supabase } from './supabase-client.js';

document.addEventListener('DOMContentLoaded', () => {
    // --- ESTADO DA APLICAÇÃO ---
    let appData = { services: [], tabelas: {} };
    let quote = {
        general: { guestCount: 100, priceTable: '', discount: 0, dates: [] },
        items: []
    };

    // --- ORDEM FIXA DAS CATEGORIAS ---
    const CATEGORY_ORDER = ['Espaço', 'Gastronomia', 'Equipamentos', 'Serviços / Outros'];

    // --- ELEMENTOS DO DOM ---
    const guestCountInput = document.getElementById('guestCount');
    const priceTableSelect = document.getElementById('priceTableSelect');
    const discountInput = document.getElementById('discountValue');
    const addDateBtn = document.getElementById('add-date-btn');
    const quoteCategoriesContainer = document.getElementById('quote-categories-container');

    // --- INICIALIZAÇÃO ---
    async function initialize() {
        try {
            await loadDataFromSupabase();
            populatePriceTables();
            render();
            addEventListeners();
        } catch (error) {
            console.error("Falha crítica na inicialização:", error);
            alert("Não foi possível carregar os dados. Verifique o console.");
        }
    }

    async function loadDataFromSupabase() { /* ... (sem alterações) ... */ }
    function populatePriceTables() { /* ... (sem alterações) ... */ }

    // --- LÓGICA DE RENDERIZAÇÃO ---
    function render() {
        renderDateManager();
        renderQuoteCategories();
        calculateTotal();
    }

    function renderQuoteCategories() {
        quoteCategoriesContainer.innerHTML = '';
        const template = document.getElementById('category-template');
        
        CATEGORY_ORDER.forEach(categoryName => {
            const clone = template.content.cloneNode(true);
            const categoryBlock = clone.querySelector('.category-block');
            categoryBlock.dataset.category = categoryName;

            clone.querySelector('.category-title').textContent = categoryName;
            
            const tableBody = clone.querySelector('tbody');
            renderTableForCategory(tableBody, categoryName);

            quoteCategoriesContainer.appendChild(clone);
        });
        
        setupMultiselects();
    }
    
    function renderTableForCategory(tableBody, category) {
        tableBody.innerHTML = '';
        const prices = getCalculatedPrices();
        
        const categoryItems = quote.items.filter(item => {
            const service = appData.services.find(s => s.id === item.id);
            return service && service.category === category;
        });

        categoryItems.forEach(item => {
            const itemIndex = quote.items.indexOf(item);
            const service = appData.services.find(s => s.id === item.id);
            // ... (A lógica de renderização da linha da tabela (<tr>) é a mesma da versão anterior)
            const row = document.createElement('tr');
            // ... (código do innerHTML da linha aqui)
            tableBody.appendChild(row);
        });
    }

    function calculateTotal() {
        const prices = getCalculatedPrices();
        let subtotal = 0;
        let gastronomySubtotal = 0;
        // ... (lógica de cálculo do total e subtotal por categoria)
        // A renderização do subtotal por categoria pode ser feita no final da `renderTableForCategory`
    }

    // --- LÓGICA DO NOVO MENU MULTISELECT ---
    function setupMultiselects() {
        document.querySelectorAll('.multiselect-container').forEach(container => {
            const input = container.querySelector('.multiselect-input');
            const dropdown = container.querySelector('.multiselect-dropdown');
            const list = container.querySelector('.multiselect-list');
            const addButton = container.querySelector('.btn-add-selected');
            const category = container.closest('.category-block').dataset.category;

            // Popula a lista com checkboxes
            list.innerHTML = '';
            appData.services
                .filter(s => s.category === category)
                .forEach(service => {
                    const listItem = document.createElement('div');
                    listItem.className = 'multiselect-list-item';
                    listItem.innerHTML = `
                        <label><input type="checkbox" value="${service.id}"> ${service.name}</label>
                    `;
                    list.appendChild(listItem);
                });

            // Mostra/Esconde o dropdown
            input.onclick = () => container.classList.toggle('open');
            
            // Adiciona os itens selecionados
            addButton.onclick = () => {
                const selected = list.querySelectorAll('input:checked');
                selected.forEach(checkbox => {
                    quote.items.push({ id: checkbox.value, quantity: 1, assignedDate: '', observacoes: '' });
                    checkbox.checked = false; // Desmarca após adicionar
                });
                container.classList.remove('open');
                render();
            };
        });
        // Esconde o dropdown se clicar fora
        document.addEventListener('click', e => {
            if (!e.target.closest('.multiselect-container')) {
                document.querySelectorAll('.multiselect-container.open').forEach(c => c.classList.remove('open'));
            }
        });
    }

    // --- MANIPULADORES DE EVENTOS ---
    function addEventListeners() {
        // ... (Os listeners de `addDateBtn`, `guestCountInput`, etc. são os mesmos)
    }

    // O restante do código (cálculo de total, funções globais, etc.) pode ser mantido da versão anterior,
    // mas a lógica de renderização foi centralizada em `renderQuoteCategories`.
    
    initialize();
});
