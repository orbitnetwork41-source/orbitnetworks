// js/admin/invoices.js
import { supabase } from '../config/supabase.js'; 
import { showToast, formatCurrency, formatDate } from '../utils/helpers.js'; 

export async function loadInvoices(status = 'all') {
    try {
        let query = supabase
            .from('invoices')
            .select(`
                *,
                customer:customer_id (
                    profiles (full_name, phone)
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
        console.error('Invoices error:', error);
        return [];
    }
}

export async function generateInvoice(customerId, amount, dueDate, items) {
    try {
        const invoiceNumber = 'INV-' + Date.now().toString().slice(-8);
        const { data, error } = await supabase
            .from('invoices')
            .insert({
                invoice_number: invoiceNumber,
                customer_id: customerId,
                amount: amount,
                due_date: dueDate,
                items: items,
                status: 'pending'
            })
            .select();

        if (error) throw error;
        showToast(`Invoice ${invoiceNumber} generated!`, 'success');
        return data;
    } catch (error) {
        showToast('Invoice generation failed: ' + error.message, 'error');
        return null;
    }
}
