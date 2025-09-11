// Importando o Supabase SDK diretamente do CDN via ESM
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

// Novas Credenciais Fornecidas
const SUPABASE_URL = "https://wadbknlbrzixuadpuuoz.supabase.co";
const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndhZGJrbmxicnppeHVhZHB1dW96Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTczNDk3OTgsImV4cCI6MjA3MjkyNTc5OH0.KUu1jUgbhJxUuiZjJmeSViLbf73oNVqhVr7QMj6TPos";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);

/**
 * Verifica a sessão do usuário e determina o papel.
 * Usuário autenticado = admin; Usuário anônimo = client.
 */
export async function getSession() {
    const { data: { session }, error } = await supabase.auth.getSession();

    if (error) {
        console.error("Erro ao obter sessão:", error);
        return { user: null, role: 'client' };
    }

    if (!session) {
        // Se não houver sessão, é um cliente (acesso anônimo)
        return { user: null, role: 'client' };
    }

    // Se estiver autenticado, é administrador.
    return { user: session.user, role: 'admin' };
}
