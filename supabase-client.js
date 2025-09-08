import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const supabaseUrl = 'https://wadbknlbrzixuadpuuoz.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndhZGJrbmxicnppeHVhZHB1dW96Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTczNDk3OTgsImV4cCI6MjA3MjkyNTc5OH0.KUu1jUgbhJxUuiZjJmeSViLbf73oNVqhVr7QMj6TPos';

export const supabase = createClient(supabaseUrl, supabaseKey);
