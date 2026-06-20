// js/admin/notifications.js
import { supabase } from '../config/supabase.js';
import { showToast } from '../utils/helpers.js';

export async function loadNotifications(limit = 20) {
    try {
        const { data, error } = await supabase
            .from('notifications')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Notifications error:', error);
        return [];
    }
}

export async function markNotificationRead(notificationId) {
    try {
        const { error } = await supabase
            .from('notifications')
            .update({ read: true })
            .eq('id', notificationId);

        if (error) throw error;
        return true;
    } catch (error) {
        console.error('Mark read error:', error);
        return false;
    }
}

export async function createNotification(userId, title, message, type = 'info') {
    try {
        const { data, error } = await supabase
            .from('notifications')
            .insert({
                user_id: userId,
                title: title,
                message: message,
                type: type,
                read: false
            })
            .select();

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Create notification error:', error);
        return null;
    }
}
