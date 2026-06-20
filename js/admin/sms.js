// js/admin/sms.js
import { supabase } from '../config/supabase.js';
import { showToast } from '../utils/helpers.js';

export async function sendBulkSMS(recipients, message) {
    try {
        // This would integrate with your SMS provider
        const smsData = {
            recipients: recipients,
            message: message,
            sent_at: new Date().toISOString(),
            status: 'queued'
        };

        const { data, error } = await supabase
            .from('sms_logs')
            .insert(smsData)
            .select();

        if (error) throw error;
        showToast(`SMS queued for ${recipients.length} recipients`, 'success');
        return data;
    } catch (error) {
        showToast('SMS send failed: ' + error.message, 'error');
        return null;
    }
}

export async function getSMSStats() {
    try {
        const { data, error } = await supabase
            .from('sms_logs')
            .select('status, count(*)', { count: 'exact' })
            .group('status');

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('SMS stats error:', error);
        return [];
    }
}
