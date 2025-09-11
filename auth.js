import { supabase, getSession } from './supabase-client.js';

document.addEventListener('DOMContentLoaded', async () => {
    const loginForm = document.getElementById('loginForm');
    const errorMessage = document.getElementById('errorMessage');

    // Se estiver na página de login (verifica se o formulário existe)
    if (loginForm) {
        // Verifica se já está logado e redireciona imediatamente
        const { role } = await getSession();
        if (role === 'admin') {
            window.location.href = 'admin.html';
            return;
        }

        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            errorMessage.textContent = 'Entrando...';

            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;

            // Tenta fazer o login com o Supabase Auth
            const { data, error } = await supabase.auth.signInWithPassword({
                email: email,
                password: password,
            });

            if (error) {
                // Exibe o erro (ex: "Invalid login credentials")
                errorMessage.textContent = `Erro ao fazer login: ${error.message}`;
            } else {
                // Redireciona para o painel de administração após o login bem-sucedido
                window.location.href = 'admin.html';
            }
        });
    }

    // Lógica de logout (usada em index.html e admin.html)
    const logoutButton = document.getElementById('logout-btn');
    if (logoutButton) {
        logoutButton.addEventListener('click', async () => {
            const { error } = await supabase.auth.signOut();
            if (error) {
                alert(`Erro ao sair: ${error.message}`);
            } else {
                // Redireciona para a página inicial (que mostrará a visão de cliente)
                window.location.href = 'index.html';
            }
        });
    }
});
