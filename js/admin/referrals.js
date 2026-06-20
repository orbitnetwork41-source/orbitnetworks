// js/admin/referrals.js
import { supabase } from '../config/supabase.js';
import { showToast, formatCurrency } from '../utils/helpers.js';

export async function loadReferrals(limit = 50) {
    try {
        let query = supabase
            .from('referrals')
            .select(`
                *,
                referrer:referrer_id (
                    id,
                    profiles (full_name, phone)
                ),
                referred:referred_id (
                    id,
                    profiles (full_name, phone)
                )
            `)
            .order('created_at', { ascending: false });

        if (limit) {
            query = query.limit(limit);
        }

        const { data, error } = await query;

        if (error) throw error;
        return data || [];
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
            total: data?.length || 0,
            pending: data?.filter(r => r.status === 'pending').length || 0,
            active: data?.filter(r => r.status === 'active').length || 0,
            completed: data?.filter(r => r.status === 'completed').length || 0,
            totalCommission: data?.reduce((sum, r) => sum + Number(r.commission || 0), 0) || 0
        };

        return stats;
    } catch (error) {
        console.error('Referral stats error:', error);
        return { total: 0, pending: 0, active: 0, completed: 0, totalCommission: 0 };
    }
}

// ✅ ADD THIS MISSING FUNCTION
export async function createReferral(referrerId, referredId, commission = 0) {
    try {
        // Check if referral already exists
        const { data: existing, error: checkError } = await supabase
            .from('referrals')
            .select('id')
            .eq('referrer_id', referrerId)
            .eq('referred_id', referredId)
            .single();

        if (existing) {
            showToast('Referral already exists', 'warning');
            return null;
        }

        const { data, error } = await supabase
            .from('referrals')
            .insert([{
                referrer_id: referrerId,
                referred_id: referredId,
                status: 'pending',
                commission: commission,
                created_at: new Date().toISOString()
            }])
            .select();

        if (error) throw error;

        // Log activity
        await supabase
            .from('activity_logs')
            .insert([{
                user_id: referrerId,
                action: 'referral_created',
                details: { 
                    referrer_id: referrerId, 
                    referred_id: referredId,
                    commission: commission 
                },
                created_at: new Date().toISOString()
            }]);

        showToast('Referral created successfully!', 'success');
        return data[0];
    } catch (error) {
        console.error('Error creating referral:', error);
        showToast('Error creating referral: ' + error.message, 'error');
        throw error;
    }
}

// ✅ ADD THIS HELPER FUNCTION
export async function updateReferralStatus(referralId, status) {
    try {
        const { data, error } = await supabase
            .from('referrals')
            .update({ 
                status: status,
                updated_at: new Date().toISOString()
            })
            .eq('id', referralId)
            .select();

        if (error) throw error;

        // If completed, add commission to referrer's wallet
        if (status === 'completed' && data[0]) {
            const referral = data[0];
            if (referral.commission > 0) {
                // Get the referrer's customer record
                const { data: customer, error: customerError } = await supabase
                    .from('customers')
                    .select('id')
                    .eq('id', referral.referrer_id)
                    .single();

                if (!customerError && customer) {
                    // Update wallet balance
                    await supabase
                        .from('customers')
                        .update({ 
                            wallet_balance: supabase.raw('wallet_balance + ?', [referral.commission])
                        })
                        .eq('id', referral.referrer_id);

                    // Log wallet transaction
                    await supabase
                        .from('wallet_transactions')
                        .insert([{
                            user_id: referral.referrer_id,
                            amount: referral.commission,
                            type: 'credit',
                            method: 'referral',
                            status: 'completed',
                            description: `Referral commission for ${referral.referred_id}`,
                            created_at: new Date().toISOString()
                        }]);

                    showToast(`Commission of ${formatCurrency(referral.commission)} added to wallet`, 'success');
                }
            }
        }

        return data[0];
    } catch (error) {
        console.error('Error updating referral status:', error);
        showToast('Error updating referral: ' + error.message, 'error');
        throw error;
    }
}

// ✅ ADD THIS HELPER FUNCTION
export async function getReferralByCode(code) {
    try {
        const { data, error } = await supabase
            .from('referrals')
            .select(`
                *,
                referrer:referrer_id (
                    id,
                    profiles (full_name, phone)
                )
            `)
            .eq('code', code)
            .single();

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Error getting referral by code:', error);
        return null;
    }
}

// ✅ ADD THIS HELPER FUNCTION
export async function getReferralCount(userId) {
    try {
        const { count, error } = await supabase
            .from('referrals')
            .select('*', { count: 'exact', head: true })
            .eq('referrer_id', userId)
            .eq('status', 'completed');

        if (error) throw error;
        return count || 0;
    } catch (error) {
        console.error('Error getting referral count:', error);
        return 0;
    }
}
