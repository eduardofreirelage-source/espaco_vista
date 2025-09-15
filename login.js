import { supabase } from './supabase-client.js';

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const errorMessage = document.getElementById('errorMessage');

    // Redireciona para o painel de admin se o usuário já estiver logado
    supabase.auth.onAuthStateChange((event, session) => {
        if (session) {
            // Um pequeno delay para garantir que a sessão foi estabelecida
            setTimeout(() => {
                window.location.href = 'admin.html';
            }, 100);
        }
    });

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            errorMessage.textContent = ''; // Limpa erros anteriores

            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            const submitButton = loginForm.querySelector('button[type="submit"]');

            // Desabilita o botão para evitar múltiplos envios
            submitButton.disabled = true;
            submitButton.textContent = 'Entrando...';

            try {
                const { data, error } = await supabase.auth.signInWithPassword({
                    email: email,
                    password: password,
                });

                if (error) {
                    throw error;
                }

                // O redirecionamento será tratado pelo onAuthStateChange
                
            } catch (error) {
                console.error('Login failed:', error.message);
                errorMessage.textContent = 'E-mail ou senha inválidos. Tente novamente.';
                // Reabilita o botão em caso de erro
                submitButton.disabled = false;
                submitButton.textContent = 'Entrar';
            }
        });
    }
});
