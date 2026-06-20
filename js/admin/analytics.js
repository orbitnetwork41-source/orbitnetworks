// js/admin/analytics.js
import { supabase } from '../config/supabase.js';

export async function getRevenueAnalytics(period = 'month') {
    try {
        const startDate = new Date();
        if (period === 'month') startDate.setMonth(startDate.getMonth() - 1);
        else if (period === 'quarter') startDate.setMonth(startDate.getMonth() - 3);
        else if (period === 'year') startDate.setFullYear(startDate.getFullYear() - 1);

        const { data, error } = await supabase
            .from('payments')
            .select('amount, created_at, method')
            .gte('created_at', startDate.toISOString())
            .eq('status', 'completed');

        if (error) throw error;

        // Calculate analytics
        const totalRevenue = data?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;
        const methods = {};
        const daily = {};

        data?.forEach(p => {
            // Payment methods
            methods[p.method] = (methods[p.method] || 0) + Number(p.amount);
            
            // Daily totals
            const date = new Date(p.created_at).toLocaleDateString();
            daily[date] = (daily[date] || 0) + Number(p.amount);
        });

        return {
            totalRevenue,
            methods,
            daily,
            transactionCount: data?.length || 0
        };
    } catch (error) {
        console.error('Analytics error:', error);
        return null;
    }
}
