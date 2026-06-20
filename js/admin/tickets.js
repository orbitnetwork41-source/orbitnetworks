// js/admin/tickets.js
import { supabase } from '../config/supabase.js';
import { showToast, getTimeAgo } from '../utils/helpers.js';

export async function loadTickets(status = 'all') {
    try {
        let query = supabase
            .from('support_tickets')
            .select(`
                *,
                customer:customer_id (
                    profiles (full_name, phone)
                ),
                assigned_to:assigned_to_id (
                    profiles (full_name)
                )
            `)
            .order('created_at', { ascending: false });

        if (status !== 'all') {
            query = query.eq('status', status);
        }

        const { data, error } = await query;
        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Tickets error:', error);
        return [];
    }
}

export async function updateTicketStatus(ticketId, status, response) {
    try {
        const { data, error } = await supabase
            .from('support_tickets')
            .update({
                status: status,
                response: response,
                resolved_at: status === 'resolved' ? new Date().toISOString() : null
            })
            .eq('id', ticketId)
            .select();

        if (error) throw error;
        showToast(`Ticket ${status} successfully`, 'success');
        return data;
    } catch (error) {
        showToast('Update failed: ' + error.message, 'error');
        return null;
    }
}

export async function getTicketStats() {
    try {
        const { data, error } = await supabase
            .from('support_tickets')
            .select('status');

        if (error) throw error;

        const stats = {
            total: data.length,
            open: data.filter(t => t.status === 'open').length,
            in_progress: data.filter(t => t.status === 'in_progress').length,
            resolved: data.filter(t => t.status === 'resolved').length
        };

        return stats;
    } catch (error) {
        console.error('Ticket stats error:', error);
        return { total: 0, open: 0, in_progress: 0, resolved: 0 };
    }
}
