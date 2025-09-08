document.addEventListener('DOMContentLoaded', () => {
    // --- ELEMENTOS DO DOM ---
    const adminContent = document.getElementById('admin-content');
    const exportButton = document.getElementById('exportButton');
    const importFile = document.getElementById('importFile');
    const addServiceForm = document.getElementById('addServiceForm');
    const addPriceTableForm = document.getElementById('addPriceTableForm');
    const tableTypeSelect = document.getElementById('tableType');
    
    // --- ESTADO DA APLICAÇÃO ---
    let appData;

    // --- FUNÇÕES DE DADOS ---
    function loadData() {
        const localData = localStorage.getItem('orcamentoData');
        appData = localData ? JSON.parse(localData) : JSON.parse(JSON.stringify(data)); // Usa dados locais ou padrão
        saveData(); // Garante que o localStorage esteja sempre populado
    }

    function saveData() {
        localStorage.setItem('orcamentoData', JSON.stringify(appData));
    }

    function generateUniqueId(prefix) {
        return prefix + Date.now();
    }
    
    // --- LÓGICA DE RENDERIZAÇÃO ---
    function renderAll() {
        renderPriceTables();
        populateBaseTableSelect();
    }

    function renderPriceTables() {
        adminContent.innerHTML = '';
        const { servicos, tabelas } = appData;

        for (const nomeTabela in tabelas) {
            const tabela = tabelas[nomeTabela];
            const section = document.createElement('section');
            section.className = 'card';

            let headerHTML = `<h3>${nomeTabela} <button class="btn btn-danger btn-sm" onclick="deleteTable('${nomeTabela}')">Excluir</button></h3>`;
            if (tabela.tipo === 'derivada') {
                headerHTML += `<p>Tabela Derivada: Baseada em <strong>${tabela.base}</strong> com modificador de <strong>${(tabela.modificador * 100 - 100).toFixed(0)}%</strong></p>`;
                section.innerHTML = headerHTML;
            } else {
                let tableHTML = `
                    ${headerHTML}
                    <table><thead><tr><th>Serviço</th><th>Preço (R$)</th><th>Ações</th></tr></thead><tbody>`;
                
                servicos.forEach(servico => {
                    const preco = tabela.precos[servico.id] || 0;
                    tableHTML += `
                        <tr>
                            <td>${servico.nome} (${servico.categoria})</td>
                            <td><input type="number" class="price-input" value="${preco.toFixed(2)}" step="0.01" onchange="updatePrice('${nomeTabela}', '${servico.id}', this.value)"></td>
                            <td><button class="btn btn-danger btn-sm" onclick="deleteService('${servico.id}')">Excluir</button></td>
                        </tr>`;
                });
                tableHTML += `</tbody></table>`;
                section.innerHTML = tableHTML;
            }
            adminContent.appendChild(section);
        }
    }
    
    function populateBaseTableSelect() {
        const baseTableSelect = document.getElementById('baseTable');
        baseTableSelect.innerHTML = '';
        Object.keys(appData.tabelas).forEach(tableName => {
            if (appData.tabelas[tableName].tipo === 'base') {
                const option = document.createElement('option');
                option.value = tableName;
                option.textContent = tableName;
                baseTableSelect.appendChild(option);
            }
        });
    }

    // --- MANIPULADORES DE EVENTOS GLOBAIS (Expostos via window) ---
    window.updatePrice = (tableName, serviceId, newPrice) => {
        appData.tabelas[tableName].precos[serviceId] = parseFloat(newPrice);
        saveData();
    };

    window.deleteService = (serviceId) => {
        if (!confirm('Tem certeza que deseja excluir este serviço de TODAS as tabelas?')) return;
        appData.servicos = appData.servicos.filter(s => s.id !== serviceId);
        Object.values(appData.tabelas).forEach(tabela => {
            if (tabela.tipo === 'base') delete tabela.precos[serviceId];
        });
        saveData();
        renderAll();
    };
    
    window.deleteTable = (tableName) => {
        if (!confirm(`Tem certeza que deseja excluir a tabela "${tableName}"?`)) return;
        // Verifica se a tabela é base para alguma outra
        const isBaseForOther = Object.values(appData.tabelas).some(t => t.tipo === 'derivada' && t.base === tableName);
        if (isBaseForOther) {
            alert('Não é possível excluir esta tabela, pois ela é usada como base para outra tabela derivada.');
            return;
        }
        delete appData.tabelas[tableName];
        saveData();
        renderAll();
    };

    // --- EVENT LISTENERS ---
    tableTypeSelect.addEventListener('change', (e) => {
        const isDerived = e.target.value === 'derivada';
        document.getElementById('baseTableGroup').style.display = isDerived ? 'block' : 'none';
        document.getElementById('modifierGroup').style.display = isDerived ? 'block' : 'none';
    });

    addServiceForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const newService = {
            id: generateUniqueId('serv'),
            nome: document.getElementById('serviceName').value,
            categoria: document.getElementById('serviceCategory').value,
            unidade: document.getElementById('serviceUnit').value,
        };
        appData.servicos.push(newService);
        // Adiciona o novo serviço com preço 0 em todas as tabelas base
        Object.values(appData.tabelas).forEach(tabela => {
            if (tabela.tipo === 'base') tabela.precos[newService.id] = 0;
        });
        saveData();
        renderAll();
        addServiceForm.reset();
    });
    
    addPriceTableForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const tableName = document.getElementById('tableName').value;
        if (appData.tabelas[tableName]) {
            alert('Já existe uma tabela com este nome.');
            return;
        }
        const tableType = document.getElementById('tableType').value;
        if (tableType === 'base') {
            appData.tabelas[tableName] = {
                tipo: 'base',
                precos: Object.fromEntries(appData.servicos.map(s => [s.id, 0]))
            };
        } else {
            appData.tabelas[tableName] = {
                tipo: 'derivada',
                base: document.getElementById('baseTable').value,
                modificador: 1 + (parseFloat(document.getElementById('modifier').value) / 100)
            };
        }
        saveData();
        renderAll();
        addPriceTableForm.reset();
    });

    exportButton.addEventListener('click', () => {
        const dataStr = JSON.stringify(appData, null, 2);
        const blob = new Blob([dataStr], {type: "application/json"});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'backup_orcamento_data.json';
        a.click();
        URL.revokeObjectURL(url);
    });

    importFile.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const importedData = JSON.parse(event.target.result);
                // Validação básica
                if (importedData.servicos && importedData.tabelas) {
                    if (confirm("Deseja substituir todos os dados atuais pelos dados do arquivo?")) {
                        appData = importedData;
                        saveData();
                        renderAll();
                    }
                } else { throw new Error("Formato inválido."); }
            } catch (err) { alert("Erro ao importar o arquivo. Verifique se o arquivo é um backup válido."); }
        };
        reader.readAsText(file);
    });

    // --- INICIALIZAÇÃO ---
    loadData();
    renderAll();
});
