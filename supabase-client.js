// Importando o Supabase SDK diretamente do CDN via ESM
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

// Credenciais fornecidas.
const SUPABASE_URL = "https://msmyfxgrnuusnvoqyeuo.supabase.co";
// Use a sua chave ANNON real aqui.
const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1zbXlmeGdybnV1c252b3F5ZXVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY2NTYzMTEsImV4cCI6MjA3MjIzMjMxMX0.21NV7RdrdXLqA9-PIG9TP2aZMgIseW7_qM1LDZzkO7U";

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
