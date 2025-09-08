document.addEventListener('DOMContentLoaded', () => {
    const adminContent = document.getElementById('admin-content');
    const exportButton = document.getElementById('exportButton');
    const exportDataTextarea = document.getElementById('exportData');

    function renderTables() {
        adminContent.innerHTML = '';
        const { servicos, tabelas } = data;

        for (const nomeTabela in tabelas) {
            const tabela = tabelas[nomeTabela];
            const tableContainer = document.createElement('div');
            
            let headerHTML = `<h2>${nomeTabela}</h2>`;
            if (tabela.tipo === 'derivada') {
                headerHTML += `<p>Tabela Derivada: Baseada em <strong>${tabela.base}</strong> com modificador de <strong>${(tabela.modificador * 100 - 100).toFixed(0)}%</strong></p>`;
                tableContainer.innerHTML = headerHTML;
            } else {
                let tableHTML = `
                    ${headerHTML}
                    <table>
                        <thead>
                            <tr><th>Serviço</th><th>Preço Atual</th></tr>
                        </thead>
                        <tbody>
                `;
                for (const servico of servicos) {
                    const preco = tabela.precos[servico.id] || 0;
                    tableHTML += `
                        <tr>
                            <td>${servico.nome}</td>
                            <td>R$ ${preco.toFixed(2)}</td>
                        </tr>
                    `;
                }
                tableHTML += `</tbody></table>`;
                tableContainer.innerHTML = tableHTML;
            }
            adminContent.appendChild(tableContainer);
        }
    }

    exportButton.addEventListener('click', () => {
        // Em uma versão futura, leríamos os dados da tela.
        // Por agora, apenas exportamos a estrutura atual para o usuário copiar.
        const dataString = `const data = ${JSON.stringify(data, null, 4)};`;
        exportDataTextarea.value = dataString;
        exportDataTextarea.select();
        alert("Código gerado! Copie o texto da caixa e cole no seu arquivo 'dados.js'.");
    });
    
    renderTables();
});
