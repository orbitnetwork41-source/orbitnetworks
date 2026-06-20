// js/admin/wallet.js
import { supabase } from '../config/supabase.js';
import { showToast, formatCurrency } from '../utils/helpers.js'; 

export async function loadWalletStats() {
    try {
        const { data, error } = await supabase
            .from('wallet_transactions')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(50);

        if (error) throw error;

        const totalBalance = data?.reduce((sum, t) => {
            return t.type === 'credit' ? sum + t.amount : sum - t.amount;
        }, 0) || 0;

        return { transactions: data, balance: totalBalance };
    } catch (error) {
        console.error('Wallet error:', error);
        return { transactions: [], balance: 0 };
    }
}

export async function topUpWallet(userId, amount, method = 'mpesa') {
    try {
        const { data, error } = await supabase
            .from('wallet_transactions')
            .insert({
                user_id: userId,
                amount: amount,
                type: 'credit',
                method: method,
                status: 'pending',
                description: 'Wallet top-up'
            })
            .select();

        if (error) throw error;
        showToast(`Wallet top-up of ${formatCurrency(amount)} initiated`, 'success');
        return data;
    } catch (error) {
        showToast('Top-up failed: ' + error.message, 'error');
        return null;
    }
}
