// js/admin/whatsapp.js
import { supabase } from '../config/supabase.js';
import { showToast } from '../utils/helpers.js';

export async function sendWhatsAppMessage(phone, message) {
    try {
        // This would integrate with WhatsApp Business API
        const response = await fetch('/api/whatsapp/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone, message })
        });

        const data = await response.json();
        if (!data.success) throw new Error(data.message);

        await supabase.from('whatsapp_logs').insert({
            recipient: phone,
            message: message,
            status: 'sent'
        });

        showToast('WhatsApp message sent!', 'success');
        return data;
    } catch (error) {
        showToast('WhatsApp send failed: ' + error.message, 'error');
        return null;
    }
}
