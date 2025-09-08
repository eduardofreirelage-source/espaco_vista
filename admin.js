import { supabase } from './supabase-client.js';

document.addEventListener('DOMContentLoaded', () => {
    const notification = document.getElementById('save-notification');
    let services = [];
    let priceTables = [];

    const servicesTbody = document.getElementById('services-table').querySelector('tbody');
    const tablesTbody = document.getElementById('price-tables-table').querySelector('tbody');
    const addServiceForm = document.getElementById('addServiceForm');
    const addPriceTableForm = document.getElementById('addPriceTableForm');

    // --- FUNÇÕES DE DADOS ---
    async function fetchData() {
        const { data: servicesData, error: servicesError } = await supabase.from('services').select('*').order('name');
        if (servicesError) console.error('Erro ao buscar serviços:', servicesError.message);
        else services = servicesData;

        const { data: tablesData, error: tablesError } = await supabase.from('price_tables').select('*').order('name');
        if (tablesError) console.error('Erro ao buscar tabelas:', tablesError.message);
        else priceTables = tablesData;
        
        renderAll();
    }
    
    // --- FUNÇÕES DE RENDERIZAÇÃO ---
    function renderAll() {
        renderServicesTable();
        renderPriceTablesTable();
    }

    function renderServicesTable() {
        servicesTbody.innerHTML = '';
        services.forEach(service => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${service.name}</td>
                <td>${service.category}</td>
                <td>${service.unit}</td>
                <td><input type="number" class="price-input" value="${service.base_price}" step="0.01" onchange="updateServicePrice('${service.id}', this.value)"></td>
                <td class="actions"><button class="btn-remove" onclick="deleteService('${service.id}')">&times;</button></td>
            `;
            servicesTbody.appendChild(row);
        });
    }

    function renderPriceTablesTable() {
        tablesTbody.innerHTML = '';
        priceTables.forEach(table => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${table.name}</td>
                <td>${table.modifier}</td>
                <td class="actions"><button class="btn-remove" onclick="deleteTable('${table.id}')">&times;</button></td>
            `;
            tablesTbody.appendChild(row);
        });
    }
    
    // --- MANIPULADORES DE EVENTOS ---
    addServiceForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const newService = {
            name: document.getElementById('serviceName').value,
            category: document.getElementById('serviceCategory').value,
            unit: document.getElementById('serviceUnit').value,
            base_price: parseFloat(document.getElementById('serviceBasePrice').value)
        };
        
        const { error } = await supabase.from('services').insert([newService]);
        if (error) {
            showNotification('Erro: ' + error.message, true);
        } else {
            e.target.reset();
            fetchData();
            showNotification('Serviço adicionado com sucesso!');
        }
    });

    addPriceTableForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const newTable = {
            name: document.getElementById('tableName').value,
            modifier: parseFloat(document.getElementById('modifier').value)
        };
        
        const { error } = await supabase.from('price_tables').insert([newTable]);
        if (error) {
            showNotification('Erro: ' + error.message, true);
        } else {
            e.target.reset();
            fetchData();
            showNotification('Tabela de preços adicionada!');
        }
    });
    
    // --- FUNÇÕES GLOBAIS ---
    window.updateServicePrice = async (id, newPrice) => {
        const { error } = await supabase.from('services').update({ base_price: parseFloat(newPrice) }).eq('id', id);
        if (error) showNotification('Erro ao atualizar preço: ' + error.message, true);
        else showNotification('Preço salvo!');
    };

    window.deleteService = async (id) => {
        if (!confirm('Tem certeza que deseja excluir este serviço?')) return;
        const { error } = await supabase.from('services').delete().eq('id', id);
        if (error) showNotification('Erro ao excluir: ' + error.message, true);
        else {
            showNotification('Serviço excluído.');
            fetchData();
        }
    };

    window.deleteTable = async (id) => {
        if (!confirm('Tem certeza que deseja excluir esta tabela de preços?')) return;
        const { error } = await supabase.from('price_tables').delete().eq('id', id);
        if (error) showNotification('Erro ao excluir: ' + error.message, true);
        else {
            showNotification('Tabela excluída.');
            fetchData();
        }
    };
    
    // --- FUNÇÃO DE NOTIFICAÇÃO ---
    function showNotification(message, isError = false) {
        notification.textContent = message;
        notification.style.backgroundColor = isError ? 'var(--danger-color)' : 'var(--success-color)';
        notification.classList.add('show');
        setTimeout(() => {
            notification.classList.remove('show');
        }, 3000);
    }

    // --- INICIALIZAÇÃO ---
    fetchData();
});
