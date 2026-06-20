// js/admin/referrals.js
import { supabase } from '../config/supabase.js';
import { showToast, formatCurrency } from '../utils/helpers.js';

export async function loadReferrals() {
    try {
        const { data, error } = await supabase
            .from('referrals')
            .select(`
                *,
                referrer:referrer_id (
                    profiles (full_name, phone)
                ),
                referred:referred_id (
                    profiles (full_name, phone)
                )
            `)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Referrals error:', error);
        return [];
    }
}

export async function getReferralStats() {
    try {
        const { data, error } = await supabase
            .from('referrals')
            .select('status, commission');

        if (error) throw error;

        const stats = {
            total: data.length,
            active: data.filter(r => r.status === 'active').length,
            totalCommission: data.reduce((sum, r) => sum + Number(r.commission || 0), 0)
        };

        return stats;
    } catch (error) {
        console.error('Referral stats error:', error);
        return { total: 0, active: 0, totalCommission: 0 };
    }
}
