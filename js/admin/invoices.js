// js/admin/invoices.js
import { supabase } from '../config/supabase.js'; 
import { showToast, formatCurrency, formatDate } from '../utils/helpers.js'; 

export async function loadInvoices(status = 'all', limit = 50) { 
    try {
        let query = supabase
            .from('invoices')
            .select(`
                *,
                customer:customer_id (
                    id,
                    profiles (full_name, phone, email)
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
        console.error('Invoices error:', error);
        return [];
    }
}

// ✅ ADD THIS MISSING FUNCTION
export async function getInvoiceStats() {
    try {
        const { data, error } = await supabase
            .from('invoices')
            .select('status, amount');

        if (error) throw error;

        const stats = {
            total: data?.length || 0,
            pending: data?.filter(i => i.status === 'pending').length || 0,
            paid: data?.filter(i => i.status === 'paid').length || 0,
            overdue: data?.filter(i => i.status === 'overdue').length || 0,
            cancelled: data?.filter(i => i.status === 'cancelled').length || 0,
            totalPending: data?.filter(i => i.status === 'pending')
                .reduce((sum, i) => sum + Number(i.amount), 0) || 0,
            totalOverdue: data?.filter(i => i.status === 'overdue')
                .reduce((sum, i) => sum + Number(i.amount), 0) || 0
        };

        return stats;
    } catch (error) {
        console.error('Error getting invoice stats:', error);
        return { 
            total: 0, 
            pending: 0, 
            paid: 0, 
            overdue: 0, 
            cancelled: 0,
            totalPending: 0,
            totalOverdue: 0
        };
    }
}

export async function generateInvoice(customerId, amount, dueDate, items = null) {
    try {
        // Generate unique invoice number
        const invoiceNumber = 'INV-' + Date.now().toString().slice(-8) + '-' + Math.floor(Math.random() * 1000);
        
        const { data, error } = await supabase
            .from('invoices')
            .insert([{
                invoice_number: invoiceNumber,
                customer_id: customerId,
                amount: amount,
                due_date: dueDate,
                items: items || [],
                status: 'pending',
                created_at: new Date().toISOString()
            }])
            .select();

        if (error) throw error;
        
        // Log activity
        await supabase
            .from('activity_logs')
            .insert([{
                action: 'invoice_generated',
                details: { 
                    invoice_number: invoiceNumber, 
                    customer_id: customerId,
                    amount: amount
                },
                created_at: new Date().toISOString()
            }]);

        showToast(`Invoice ${invoiceNumber} generated successfully!`, 'success');
        return data[0];
    } catch (error) {
        console.error('Invoice generation failed:', error);
        showToast('Invoice generation failed: ' + error.message, 'error');
        return null;
    }
}

// ✅ ADD THIS MISSING FUNCTION
export async function updateInvoiceStatus(invoiceId, status) {
    try {
        const updateData = { 
            status: status,
            updated_at: new Date().toISOString()
        };

        // If marking as paid, set paid_at timestamp
        if (status === 'paid') {
            updateData.paid_at = new Date().toISOString();
        }

        const { data, error } = await supabase
            .from('invoices')
            .update(updateData)
            .eq('id', invoiceId)
            .select();

        if (error) throw error;

        // If paid, create a payment record
        if (status === 'paid' && data[0]) {
            const invoice = data[0];
            
            // Check if payment already exists
            const { data: existingPayment } = await supabase
                .from('payments')
                .select('id')
                .eq('invoice_id', invoiceId)
                .single();

            if (!existingPayment) {
                // Create payment record
                await supabase
                    .from('payments')
                    .insert([{
                        customer_id: invoice.customer_id,
                        amount: invoice.amount,
                        method: 'invoice',
                        status: 'completed',
                        reference: invoice.invoice_number,
                        description: `Payment for invoice ${invoice.invoice_number}`,
                        invoice_id: invoiceId,
                        created_at: new Date().toISOString()
                    }]);
            }
        }

        showToast(`Invoice status updated to ${status}`, 'success');
        return data[0];
    } catch (error) {
        console.error('Error updating invoice status:', error);
        showToast('Error updating invoice: ' + error.message, 'error');
        throw error;
    }
}

// ✅ ADD THIS HELPER FUNCTION
export async function getInvoiceById(invoiceId) {
    try {
        const { data, error } = await supabase
            .from('invoices')
            .select(`
                *,
                customer:customer_id (
                    id,
                    profiles (full_name, phone, email)
                )
            `)
            .eq('id', invoiceId)
            .single();

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Error getting invoice:', error);
        return null;
    }
}

// ✅ ADD THIS HELPER FUNCTION
export async function getCustomerInvoices(customerId) {
    try {
        const { data, error } = await supabase
            .from('invoices')
            .select('*')
            .eq('customer_id', customerId)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('Error getting customer invoices:', error);
        return [];
    }
}

// ✅ ADD THIS HELPER FUNCTION
export async function getOverdueInvoices() {
    try {
        const today = new Date().toISOString().split('T')[0];
        
        const { data, error } = await supabase
            .from('invoices')
            .select(`
                *,
                customer:customer_id (
                    id,
                    profiles (full_name, phone, email)
                )
            `)
            .lt('due_date', today)
            .neq('status', 'paid')
            .neq('status', 'cancelled')
            .order('due_date', { ascending: true });

        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('Error getting overdue invoices:', error);
        return [];
    }
}

// ✅ ADD THIS HELPER FUNCTION
export async function deleteInvoice(invoiceId) {
    try {
        const { error } = await supabase
            .from('invoices')
            .update({ 
                status: 'cancelled',
                updated_at: new Date().toISOString()
            })
            .eq('id', invoiceId);

        if (error) throw error;
        showToast('Invoice cancelled successfully', 'success');
        return true;
    } catch (error) {
        console.error('Error cancelling invoice:', error);
        showToast('Error cancelling invoice: ' + error.message, 'error');
        throw error;
    }
}
