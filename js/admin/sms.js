// js/admin/sms.js
import { supabase } from '../config/supabase.js'; 
import { showToast, formatDate } from '../utils/helpers.js';

export async function sendBulkSMS(recipients, message) {
    try {
        if (!Array.isArray(recipients) || recipients.length === 0) {
            throw new Error('No recipients provided');
        }

        // This would integrate with your SMS provider (e.g., Africa's Talking, Twilio, etc.)
        // For now, we'll just log it
        const smsData = {
            recipients: recipients,
            message: message,
            sent_at: new Date().toISOString(),
            status: 'queued',
            created_at: new Date().toISOString()
        };

        const { data, error } = await supabase
            .from('sms_logs')
            .insert([smsData])
            .select();

        if (error) throw error;

        // Log activity
        await supabase
            .from('activity_logs')
            .insert([{
                action: 'bulk_sms_sent',
                details: { 
                    recipients_count: recipients.length,
                    message_preview: message.substring(0, 50)
                },
                created_at: new Date().toISOString()
            }]);

        // Simulate sending (in production, this would call your SMS API)
        simulateSMSSending(data[0].id);

        showToast(`SMS queued for ${recipients.length} recipients`, 'success');
        return data[0];
    } catch (error) {
        console.error('Bulk SMS error:', error);
        showToast('SMS send failed: ' + error.message, 'error');
        return null;
    }
}

// ✅ ADD THIS MISSING FUNCTION
export async function sendSingleSMS(recipient, message) {
    try {
        if (!recipient || !message) {
            throw new Error('Recipient and message are required');
        }

        const smsData = {
            recipients: [recipient],
            message: message,
            sent_at: new Date().toISOString(),
            status: 'queued',
            created_at: new Date().toISOString()
        };

        const { data, error } = await supabase
            .from('sms_logs')
            .insert([smsData])
            .select();

        if (error) throw error;

        // Log activity
        await supabase
            .from('activity_logs')
            .insert([{
                action: 'single_sms_sent',
                details: { 
                    recipient: recipient,
                    message_preview: message.substring(0, 50)
                },
                created_at: new Date().toISOString()
            }]);

        // Simulate sending
        simulateSMSSending(data[0].id);

        showToast(`SMS sent to ${recipient}`, 'success');
        return data[0];
    } catch (error) {
        console.error('Single SMS error:', error);
        showToast('SMS send failed: ' + error.message, 'error');
        return null;
    }
}

export async function getSMSStats() {
    try {
        const { data, error } = await supabase
            .from('sms_logs')
            .select('status');

        if (error) throw error;

        // Calculate stats from the data
        const stats = {
            total: data?.length || 0,
            queued: data?.filter(s => s.status === 'queued').length || 0,
            sent: data?.filter(s => s.status === 'sent').length || 0,
            delivered: data?.filter(s => s.status === 'delivered').length || 0,
            failed: data?.filter(s => s.status === 'failed').length || 0,
            pending: data?.filter(s => s.status === 'pending').length || 0
        };

        return stats;
    } catch (error) {
        console.error('SMS stats error:', error);
        return { 
            total: 0, 
            queued: 0, 
            sent: 0, 
            delivered: 0, 
            failed: 0,
            pending: 0
        };
    }
}

// ✅ ADD THIS MISSING FUNCTION
export async function loadSMSLogs(limit = 50) {
    try {
        const { data, error } = await supabase
            .from('sms_logs')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('Load SMS logs error:', error);
        return [];
    }
}

// ✅ ADD THIS HELPER FUNCTION
export async function getSMSLogsByRecipient(phoneNumber, limit = 20) {
    try {
        // Supabase doesn't support searching JSONB arrays directly easily
        // So we'll get all and filter
        const { data, error } = await supabase
            .from('sms_logs')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(100);

        if (error) throw error;

        // Filter by recipient (case insensitive)
        const filtered = data?.filter(log => {
            return log.recipients?.some(r => 
                r.toLowerCase().includes(phoneNumber.toLowerCase())
            );
        }) || [];

        return filtered.slice(0, limit);
    } catch (error) {
        console.error('Get SMS logs by recipient error:', error);
        return [];
    }
}

// ✅ ADD THIS HELPER FUNCTION
export async function getSMSLogsByDateRange(startDate, endDate) {
    try {
        const { data, error } = await supabase
            .from('sms_logs')
            .select('*')
            .gte('created_at', startDate.toISOString())
            .lte('created_at', endDate.toISOString())
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('Get SMS logs by date range error:', error);
        return [];
    }
}

// ✅ ADD THIS HELPER FUNCTION
export async function getSMSSummary() {
    try {
        const { data, error } = await supabase
            .from('sms_logs')
            .select('status, created_at, recipients');

        if (error) throw error;

        // Today's count
        const today = new Date().toISOString().split('T')[0];
        const todayLogs = data?.filter(log => 
            log.created_at?.startsWith(today)
        ) || [];

        // This month's count
        const thisMonth = new Date().toISOString().slice(0, 7);
        const monthLogs = data?.filter(log => 
            log.created_at?.startsWith(thisMonth)
        ) || [];

        // Total recipients count
        const totalRecipients = data?.reduce((sum, log) => {
            return sum + (log.recipients?.length || 0);
        }, 0) || 0;

        return {
            totalSent: data?.length || 0,
            totalRecipients: totalRecipients,
            sentToday: todayLogs.length,
            sentThisMonth: monthLogs.length,
            queued: data?.filter(s => s.status === 'queued').length || 0,
            failed: data?.filter(s => s.status === 'failed').length || 0,
            delivered: data?.filter(s => s.status === 'delivered').length || 0
        };
    } catch (error) {
        console.error('SMS summary error:', error);
        return null;
    }
}

// ✅ ADD THIS HELPER FUNCTION
export async function resendFailedSMS(logId) {
    try {
        const { data: log, error: fetchError } = await supabase
            .from('sms_logs')
            .select('*')
            .eq('id', logId)
            .single();

        if (fetchError) throw fetchError;

        if (!log) {
            throw new Error('SMS log not found');
        }

        // Reset status and resend
        const { data, error } = await supabase
            .from('sms_logs')
            .update({
                status: 'queued',
                sent_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .eq('id', logId)
            .select();

        if (error) throw error;

        // Simulate resending
        simulateSMSSending(logId);

        showToast('SMS queued for resend', 'success');
        return data[0];
    } catch (error) {
        console.error('Resend SMS error:', error);
        showToast('Resend failed: ' + error.message, 'error');
        return null;
    }
}

// ✅ SIMULATE SMS SENDING (replace with actual SMS API integration)
async function simulateSMSSending(logId) {
    // Simulate sending with a delay
    setTimeout(async () => {
        try {
            // Randomly succeed or fail (90% success rate)
            const success = Math.random() < 0.9;
            
            const status = success ? 'delivered' : 'failed';
            
            await supabase
                .from('sms_logs')
                .update({
                    status: status,
                    updated_at: new Date().toISOString()
                })
                .eq('id', logId);

            if (!success) {
                console.warn(`SMS ${logId} failed to send`);
            }
        } catch (error) {
            console.error('Error updating SMS status:', error);
        }
    }, 2000 + Math.random() * 3000); // Random delay 2-5 seconds
}

// ✅ ADD THIS FUNCTION FOR ACTUAL SMS PROVIDER INTEGRATION
export async function sendSMSViaProvider(recipients, message, provider = 'africastalking') {
    try {
        // This is where you'd integrate with your SMS provider
        // Example: Africa's Talking, Twilio, Vonage, etc.
        
        const providers = {
            africastalking: async (recipients, message) => {
                // Africa's Talking API integration
                // const response = await fetch('https://api.africastalking.com/version1/messaging', {
                //     method: 'POST',
                //     headers: {
                //         'Content-Type': 'application/x-www-form-urlencoded',
                //         'apiKey': process.env.AFRICASTALKING_API_KEY
                //     },
                //     body: new URLSearchParams({
                //         username: process.env.AFRICASTALKING_USERNAME,
                //         to: recipients.join(','),
                //         message: message
                //     })
                // });
                // return await response.json();
                
                // For now, use the simulation
                return { success: true };
            },
            twilio: async (recipients, message) => {
                // Twilio API integration
                // const client = require('twilio')(accountSid, authToken);
                // return await client.messages.create({
                //     body: message,
                //     to: recipients,
                //     from: twilioPhoneNumber
                // });
                
                // For now, use the simulation
                return { success: true };
            }
        };

        const providerFn = providers[provider];
        if (!providerFn) {
            throw new Error(`Unknown SMS provider: ${provider}`);
        }

        // Send via the selected provider
        const result = await providerFn(recipients, message);
        
        // Log the successful send
        const { data, error } = await supabase
            .from('sms_logs')
            .insert([{
                recipients: recipients,
                message: message,
                sent_at: new Date().toISOString(),
                status: 'sent',
                provider: provider,
                provider_response: result,
                created_at: new Date().toISOString()
            }])
            .select();

        if (error) throw error;
        return data[0];
    } catch (error) {
        console.error('SMS provider error:', error);
        throw error;
    }
}

// ✅ ADD THIS FUNCTION FOR SMS TEMPLATES
export async function getSMSTemplates() {
    try {
        // In production, this would fetch from a templates table
        // For now, return some default templates
        return [
            {
                id: 'welcome',
                name: 'Welcome Message',
                template: 'Welcome to Orbit Networks! Your account has been activated. Call 0700-000-000 for support.'
            },
            {
                id: 'payment_received',
                name: 'Payment Confirmation',
                template: 'Payment of {{amount}} received. Thank you for choosing Orbit Networks.'
            },
            {
                id: 'invoice_reminder',
                name: 'Invoice Reminder',
                template: 'Reminder: Your invoice of {{amount}} is due on {{due_date}}. Please pay to avoid service interruption.'
            },
            {
                id: 'service_suspended',
                name: 'Service Suspension',
                template: 'Your Orbit Networks service has been suspended due to non-payment. Please contact support.'
            },
            {
                id: 'service_restored',
                name: 'Service Restored',
                template: 'Your Orbit Networks service has been restored. Thank you for your payment.'
            }
        ];
    } catch (error) {
        console.error('Get SMS templates error:', error);
        return [];
    }
}

// ✅ ADD THIS FUNCTION TO PROCESS SMS TEMPLATES
export function processTemplate(template, variables) {
    let processed = template;
    for (const [key, value] of Object.entries(variables)) {
        processed = processed.replace(new RegExp(`{{${key}}}`, 'g'), value);
    }
    return processed;
}
