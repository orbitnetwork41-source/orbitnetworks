// js/admin/notifications.js 
import { supabase } from '../config/supabase.js';
import { showToast, formatDate, getTimeAgo } from '../utils/helpers.js';

export async function loadNotifications(limit = 20) {
    try {
        const { data, error } = await supabase
            .from('notifications')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('Notifications error:', error);
        return [];
    }
}

// ✅ ADD THIS MISSING FUNCTION
export async function getUnreadCount() {
    try {
        const { count, error } = await supabase
            .from('notifications')
            .select('*', { count: 'exact', head: true })
            .eq('read', false);

        if (error) {
            console.error('Error getting unread count:', error);
            return 0;
        }
        return count || 0;
    } catch (error) {
        console.error('Error getting unread count:', error);
        return 0;
    }
}

export async function markNotificationRead(notificationId) {
    try {
        const { error } = await supabase
            .from('notifications')
            .update({ 
                read: true,
                read_at: new Date().toISOString()
            })
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
            .insert([{
                user_id: userId,
                title: title,
                message: message,
                type: type,
                read: false,
                created_at: new Date().toISOString()
            }])
            .select();

        if (error) throw error;
        
        showToast(`Notification created: ${title}`, 'success');
        return data[0];
    } catch (error) {
        console.error('Create notification error:', error);
        showToast('Failed to create notification: ' + error.message, 'error');
        return null;
    }
}

// ✅ ADD THIS HELPER FUNCTION
export async function markAllNotificationsRead(userId) {
    try {
        const { error } = await supabase
            .from('notifications')
            .update({ 
                read: true,
                read_at: new Date().toISOString()
            })
            .eq('user_id', userId)
            .eq('read', false);

        if (error) throw error;
        
        showToast('All notifications marked as read', 'success');
        return true;
    } catch (error) {
        console.error('Mark all read error:', error);
        showToast('Failed to mark all as read: ' + error.message, 'error');
        return false;
    }
}

// ✅ ADD THIS HELPER FUNCTION
export async function getNotificationsByUser(userId, limit = 20) {
    try {
        const { data, error } = await supabase
            .from('notifications')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('Error getting user notifications:', error);
        return [];
    }
}

// ✅ ADD THIS HELPER FUNCTION
export async function deleteNotification(notificationId) {
    try {
        const { error } = await supabase
            .from('notifications')
            .delete()
            .eq('id', notificationId);

        if (error) throw error;
        
        showToast('Notification deleted', 'info');
        return true;
    } catch (error) {
        console.error('Error deleting notification:', error);
        showToast('Failed to delete notification: ' + error.message, 'error');
        return false;
    }
}

// ✅ ADD THIS HELPER FUNCTION
export async function getNotificationStats() {
    try {
        const { data, error } = await supabase
            .from('notifications')
            .select('read, type, created_at');

        if (error) throw error;

        const today = new Date().toISOString().split('T')[0];
        const thisWeek = new Date();
        thisWeek.setDate(thisWeek.getDate() - 7);

        const stats = {
            total: data?.length || 0,
            unread: data?.filter(n => !n.read).length || 0,
            read: data?.filter(n => n.read).length || 0,
            today: data?.filter(n => n.created_at?.startsWith(today)).length || 0,
            thisWeek: data?.filter(n => {
                const date = new Date(n.created_at);
                return date >= thisWeek;
            }).length || 0,
            byType: {}
        };

        // Group by type
        data?.forEach(n => {
            stats.byType[n.type] = (stats.byType[n.type] || 0) + 1;
        });

        return stats;
    } catch (error) {
        console.error('Error getting notification stats:', error);
        return { total: 0, unread: 0, read: 0, today: 0, thisWeek: 0, byType: {} };
    }
}

// ✅ ADD THIS HELPER FUNCTION
export async function getUnreadNotifications(userId) {
    try {
        const { data, error } = await supabase
            .from('notifications')
            .select('*')
            .eq('user_id', userId)
            .eq('read', false)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('Error getting unread notifications:', error);
        return [];
    }
}

// ✅ ADD THIS HELPER FUNCTION
export async function sendSystemNotification(userId, title, message, type = 'system') {
    try {
        // Create notification
        const notification = await createNotification(userId, title, message, type);
        
        // Log activity
        await supabase
            .from('activity_logs')
            .insert([{
                user_id: userId,
                action: 'system_notification_sent',
                details: { 
                    title: title,
                    type: type
                },
                created_at: new Date().toISOString()
            }]);

        return notification;
    } catch (error) {
        console.error('Error sending system notification:', error);
        return null;
    }
}
