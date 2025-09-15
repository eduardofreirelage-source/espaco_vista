import { supabase } from './supabase-client.js';

document.addEventListener('DOMContentLoaded', async () => {
    const calendarEl = document.getElementById('calendar');
    if (!calendarEl) return;

    // Função para buscar os eventos (reservas)
    async function fetchEvents() {
        const { data, error } = await supabase
            .from('bookings')
            .select('start_date, end_date, title');

        if (error) {
            console.error('Erro ao buscar eventos:', error);
            return [];
        }
        
        // Formata os eventos para o FullCalendar
        return data.map(booking => ({
            title: booking.title,
            start: booking.start_date,
            end: booking.end_date
        }));
    }

    // Inicializa o FullCalendar
    const calendar = new FullCalendar.Calendar(calendarEl, {
        locale: 'pt-br',
        initialView: 'dayGridMonth',
        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay'
        },
        events: await fetchEvents(),
        eventColor: '#8B0000' // Usa a cor primária do sistema
    });

    calendar.render();
});
