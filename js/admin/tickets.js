// js/admin/tickets.js
import { supabase } from '../config/supabase.js';
import { showToast, getTimeAgo, formatDate } from '../utils/helpers.js';

export async function loadTickets(status = 'all', limit = 50) {
    try {
        let query = supabase
            .from('support_tickets')
            .select(`
                *,
                customer:customer_id (
                    id,
                    profiles (full_name, phone, email)
                ),
                assigned_to:assigned_to (
                    id,
                    profiles (full_name, phone)
                ),
                replies:ticket_replies (
                    id,
                    message,
                    created_at,
                    author:author_id (
                        profiles (full_name)
                    )
                )
            `)
            .order('created_at', { ascending: false });

        if (status !== 'all') {
            query = query.eq('status', status);
        }

        if (limit) {
            query = query.limit(limit);
        }

        const { data, error } = await query;
        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('Tickets error:', error);
        return [];
    }
}

// ✅ FIX THIS FUNCTION - The column name might be wrong
export async function updateTicketStatus(ticketId, status, response = null) {
    try {
        const updateData = {
            status: status,
            updated_at: new Date().toISOString()
        };

        // If status is resolved, set resolved_at
        if (status === 'resolved' || status === 'closed') {
            updateData.resolved_at = new Date().toISOString();
        }

        // If there's a response, add it as a reply
        if (response) {
            // Get the ticket first to get customer_id
            const { data: ticket } = await supabase
                .from('support_tickets')
                .select('customer_id')
                .eq('id', ticketId)
                .single();

            if (ticket) {
                // Add reply
                await supabase
                    .from('ticket_replies')
                    .insert([{
                        ticket_id: ticketId,
                        author_id: ticket.customer_id,
                        message: response,
                        is_internal: false,
                        created_at: new Date().toISOString()
                    }]);
            }
        }

        const { data, error } = await supabase
            .from('support_tickets')
            .update(updateData)
            .eq('id', ticketId)
            .select();

        if (error) throw error;

        // Log activity
        await supabase
            .from('activity_logs')
            .insert([{
                action: 'ticket_status_updated',
                details: { 
                    ticket_id: ticketId, 
                    status: status,
                    has_response: !!response
                },
                created_at: new Date().toISOString()
            }]);

        showToast(`Ticket ${status} successfully`, 'success');
        return data[0];
    } catch (error) {
        console.error('Update ticket error:', error);
        showToast('Update failed: ' + error.message, 'error');
        return null;
    }
}

export async function getTicketStats() {
    try {
        const { data, error } = await supabase
            .from('support_tickets')
            .select('status, priority');

        if (error) throw error;

        const stats = {
            total: data?.length || 0,
            open: data?.filter(t => t.status === 'open').length || 0,
            in_progress: data?.filter(t => t.status === 'in_progress').length || 0,
            resolved: data?.filter(t => t.status === 'resolved').length || 0,
            closed: data?.filter(t => t.status === 'closed').length || 0,
            // Priority breakdown
            urgent: data?.filter(t => t.priority === 'urgent').length || 0,
            high: data?.filter(t => t.priority === 'high').length || 0,
            normal: data?.filter(t => t.priority === 'normal').length || 0,
            low: data?.filter(t => t.priority === 'low').length || 0
        };

        return stats;
    } catch (error) {
        console.error('Ticket stats error:', error);
        return { 
            total: 0, 
            open: 0, 
            in_progress: 0, 
            resolved: 0,
            closed: 0,
            urgent: 0,
            high: 0,
            normal: 0,
            low: 0
        };
    }
}

// ✅ ADD THIS MISSING FUNCTION
export async function createTicket(customerId, subject, message, priority = 'normal') {
    try {
        if (!customerId || !subject || !message) {
            throw new Error('Customer, subject, and message are required');
        }

        const { data, error } = await supabase
            .from('support_tickets')
            .insert([{
                customer_id: customerId,
                subject: subject,
                message: message,
                priority: priority,
                status: 'open',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            }])
            .select();

        if (error) throw error;

        // Log activity
        await supabase
            .from('activity_logs')
            .insert([{
                user_id: customerId,
                action: 'ticket_created',
                details: { 
                    ticket_id: data[0].id, 
                    subject: subject,
                    priority: priority
                },
                created_at: new Date().toISOString()
            }]);

        showToast(`Ticket #${data[0].id.slice(0, 8)} created successfully`, 'success');
        return data[0];
    } catch (error) {
        console.error('Create ticket error:', error);
        showToast('Failed to create ticket: ' + error.message, 'error');
        return null;
    }
}

// ✅ ADD THIS HELPER FUNCTION
export async function addTicketReply(ticketId, authorId, message, isInternal = false) {
    try {
        if (!ticketId || !authorId || !message) {
            throw new Error('Ticket ID, author, and message are required');
        }

        const { data, error } = await supabase
            .from('ticket_replies')
            .insert([{
                ticket_id: ticketId,
                author_id: authorId,
                message: message,
                is_internal: isInternal,
                created_at: new Date().toISOString()
            }])
            .select();

        if (error) throw error;

        // Update ticket status if it was resolved
        const { data: ticket } = await supabase
            .from('support_tickets')
            .select('status')
            .eq('id', ticketId)
            .single();

        if (ticket && ticket.status === 'resolved') {
            await supabase
                .from('support_tickets')
                .update({
                    status: 'in_progress',
                    updated_at: new Date().toISOString()
                })
                .eq('id', ticketId);
        }

        showToast('Reply added successfully', 'success');
        return data[0];
    } catch (error) {
        console.error('Add reply error:', error);
        showToast('Failed to add reply: ' + error.message, 'error');
        return null;
    }
}

// ✅ ADD THIS HELPER FUNCTION
export async function getTicketById(ticketId) {
    try {
        const { data, error } = await supabase
            .from('support_tickets')
            .select(`
                *,
                customer:customer_id (
                    id,
                    profiles (full_name, phone, email)
                ),
                assigned_to:assigned_to (
                    id,
                    profiles (full_name, phone)
                ),
                replies:ticket_replies (
                    id,
                    message,
                    is_internal,
                    created_at,
                    author:author_id (
                        id,
                        profiles (full_name, phone)
                    )
                )
            `)
            .eq('id', ticketId)
            .single();

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Get ticket error:', error);
        return null;
    }
}

// ✅ ADD THIS HELPER FUNCTION
export async function assignTicket(ticketId, assignToId) {
    try {
        const { data, error } = await supabase
            .from('support_tickets')
            .update({
                assigned_to: assignToId,
                updated_at: new Date().toISOString()
            })
            .eq('id', ticketId)
            .select();

        if (error) throw error;

        // Log activity
        await supabase
            .from('activity_logs')
            .insert([{
                action: 'ticket_assigned',
                details: { 
                    ticket_id: ticketId, 
                    assigned_to: assignToId
                },
                created_at: new Date().toISOString()
            }]);

        showToast('Ticket assigned successfully', 'success');
        return data[0];
    } catch (error) {
        console.error('Assign ticket error:', error);
        showToast('Failed to assign ticket: ' + error.message, 'error');
        return null;
    }
}

// ✅ ADD THIS HELPER FUNCTION
export async function getTicketsByPriority(priority) {
    try {
        const { data, error } = await supabase
            .from('support_tickets')
            .select(`
                *,
                customer:customer_id (
                    profiles (full_name, phone)
                )
            `)
            .eq('priority', priority)
            .neq('status', 'closed')
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('Get tickets by priority error:', error);
        return [];
    }
}

// ✅ ADD THIS HELPER FUNCTION
export async function getTicketResolutionTime(ticketId) {
    try {
        const { data, error } = await supabase
            .from('support_tickets')
            .select('created_at, resolved_at')
            .eq('id', ticketId)
            .single();

        if (error) throw error;

        if (!data.resolved_at) {
            return null;
        }

        const created = new Date(data.created_at);
        const resolved = new Date(data.resolved_at);
        const hours = (resolved - created) / (1000 * 60 * 60);

        return {
            hours: Math.round(hours * 10) / 10,
            days: Math.round(hours / 24 * 10) / 10,
            created_at: data.created_at,
            resolved_at: data.resolved_at
        };
    } catch (error) {
        console.error('Get resolution time error:', error);
        return null;
    }
}

// ✅ ADD THIS HELPER FUNCTION
export async function getTicketsByCustomer(customerId) {
    try {
        const { data, error } = await supabase
            .from('support_tickets')
            .select(`
                *,
                assigned_to:assigned_to (
                    profiles (full_name)
                )
            `)
            .eq('customer_id', customerId)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('Get tickets by customer error:', error);
        return [];
    }
}

// ✅ ADD THIS HELPER FUNCTION
export async function getTicketMetrics() {
    try {
        const tickets = await loadTickets('all', 1000);
        
        if (!tickets || tickets.length === 0) {
            return {
                total: 0,
                avgResponseTime: 0,
                avgResolutionTime: 0,
                satisfactionRate: 0
            };
        }

        // Calculate average resolution time for resolved tickets
        const resolvedTickets = tickets.filter(t => t.status === 'resolved' || t.status === 'closed');
        let totalResolutionTime = 0;
        resolvedTickets.forEach(t => {
            if (t.created_at && t.resolved_at) {
                const created = new Date(t.created_at);
                const resolved = new Date(t.resolved_at);
                const hours = (resolved - created) / (1000 * 60 * 60);
                totalResolutionTime += hours;
            }
        });

        const avgResolutionTime = resolvedTickets.length > 0 
            ? Math.round((totalResolutionTime / resolvedTickets.length) * 10) / 10 
            : 0;

        return {
            total: tickets.length,
            open: tickets.filter(t => t.status === 'open').length,
            inProgress: tickets.filter(t => t.status === 'in_progress').length,
            resolved: resolvedTickets.length,
            avgResolutionTime: avgResolutionTime,
            avgResolutionDays: Math.round((avgResolutionTime / 24) * 10) / 10
        };
    } catch (error) {
        console.error('Get ticket metrics error:', error);
        return null;
    }
}
