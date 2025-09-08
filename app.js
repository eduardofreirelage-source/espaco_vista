import { supabase } from './supabase-client.js';

document.addEventListener('DOMContentLoaded', () => {
    // ESTADO DA APLICAÇÃO
    let appData = { services: [], tabelas: {} };
    let quote = { /* ... */ };
    let isDirty = false; // Flag para monitorar alterações não salvas

    // ELEMENTOS DO DOM
    const saveBtn = document.getElementById('save-quote-btn');
    const notification = document.getElementById('save-notification');
    
    // --- LÓGICA DE RENDERIZAÇÃO ---
    function renderTableForCategory(tableBody, category, items) {
        // ... (lógica de renderização de linha)
        row.innerHTML = `
            <td style="width:35%;">${service.name}</td>
            <td><select data-field="assignedDate">...</select></td>
            <td style="width:70px;"><input type="number" value="${quantity}" data-field="quantity"></td>
            <td>R$ ${unitPrice.toFixed(2)}</td>
            <td style="width:100px;"><input type="number" value="${itemDiscount}" data-field="discount_percent"></td>
            <td>R$ ${total.toFixed(2)}</td>
            <td class="item-actions" style="width:80px;">
                <button class="btn-icon" data-action="duplicate" data-index="${itemIndex}">📋</button>
                <button class="btn-icon" data-action="remove" data-index="${itemIndex}">&times;</button>
            </td>
        `;
        // OBS: O botão de observações foi removido para simplificar, já que os campos agora são visíveis.
    }

    // --- MANIPULADORES DE EVENTOS ---
    function addEventListeners() {
        // ... (todos os outros listeners)
        
        // Listener unificado para qualquer mudança que "suja" o orçamento
        document.querySelector('main').addEventListener('change', () => setDirty(true));
        document.querySelector('main').addEventListener('input', () => setDirty(true));
    }

    // --- LÓGICA DE SALVAMENTO E ESTADO "DIRTY" ---
    function setDirty(state) {
        isDirty = state;
        if (saveBtn) {
            if (isDirty) {
                saveBtn.classList.add('dirty');
                saveBtn.textContent = 'Salvar Alterações';
            } else {
                saveBtn.classList.remove('dirty');
                saveBtn.textContent = 'Salvo';
            }
        }
    }

    async function saveQuoteToSupabase() {
        if (!isDirty && quote.id) {
            showNotification('Nenhuma alteração para salvar.', false, 2000);
            return;
        }
        // ... (lógica de insert/update no Supabase)
        if (response.error) {
            showNotification('Erro ao salvar!', true);
        } else {
            quote.id = response.data[0].id;
            setDirty(false); // Marca como "limpo" após salvar
            showNotification('Orçamento salvo no banco de dados!');
        }
    }

    // ... (restante do código: initialize, load, render, calculate, etc.)
    // As funções removeItem, duplicateItem, updateItem devem chamar setDirty(true)
});
