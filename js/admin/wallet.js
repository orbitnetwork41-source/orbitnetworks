// js/admin/wallet.js
import { supabase } from '../config/supabase.js';
import { showToast, formatCurrency, formatDate } from '../utils/helpers.js';

export async function loadWalletStats(limit = 50) {
    try {
        // Try to get transactions
        const { data, error } = await supabase
            .from('wallet_transactions')
            .select(`
                *,
                user:user_id (
                    id,
                    profiles (full_name, phone, email)
                )
            `)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) {
            // If table doesn't exist, return empty data
            console.warn('Wallet transactions table not found:', error);
            return { transactions: [], balance: 0, stats: { totalCredit: 0, totalDebit: 0, pending: 0, completed: 0, failed: 0 } };
        }

        // Calculate total balance from all transactions
        const { data: allTransactions, error: balanceError } = await supabase
            .from('wallet_transactions')
            .select('amount, type, status')
            .eq('status', 'completed');

        if (balanceError) {
            return { transactions: data || [], balance: 0, stats: { totalCredit: 0, totalDebit: 0, pending: 0, completed: 0, failed: 0 } };
        }

        const totalBalance = allTransactions?.reduce((sum, t) => {
            return t.type === 'credit' ? sum + Number(t.amount) : sum - Number(t.amount);
        }, 0) || 0;

        const stats = {
            totalCredit: allTransactions?.filter(t => t.type === 'credit' && t.status === 'completed')
                .reduce((sum, t) => sum + Number(t.amount), 0) || 0,
            totalDebit: allTransactions?.filter(t => t.type === 'debit' && t.status === 'completed')
                .reduce((sum, t) => sum + Number(t.amount), 0) || 0,
            pending: data?.filter(t => t.status === 'pending').length || 0,
            completed: data?.filter(t => t.status === 'completed').length || 0,
            failed: data?.filter(t => t.status === 'failed').length || 0
        };

        return { 
            transactions: data || [], 
            balance: totalBalance,
            stats: stats
        };
    } catch (error) {
        console.error('Wallet error:', error);
        return { transactions: [], balance: 0, stats: { totalCredit: 0, totalDebit: 0, pending: 0, completed: 0, failed: 0 } };
    }
}

export async function getWalletTransactions(limit = 20) {
    try {
        const { data, error } = await supabase
            .from('wallet_transactions')
            .select(`
                *,
                user:user_id (
                    id,
                    profiles (full_name, phone, email)
                )
            `)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) {
            console.warn('Wallet transactions table not found:', error);
            return [];
        }
        return data || [];
    } catch (error) {
        console.error('Get wallet transactions error:', error);
        return [];
    }
}

export async function topUpWallet(userId, amount, method = 'mpesa', description = null) {
    try {
        // Check if user exists
        const { data: user, error: userError } = await supabase
            .from('customers')
            .select('id')
            .eq('id', userId)
            .single();

        if (userError || !user) {
            throw new Error('User not found');
        }

        const { data, error } = await supabase
            .from('wallet_transactions')
            .insert([{
                user_id: userId,
                amount: amount,
                type: 'credit',
                method: method,
                status: 'pending',
                description: description || `Wallet top-up via ${method}`,
                created_at: new Date().toISOString()
            }])
            .select();

        if (error) {
            // If table doesn't exist, show error
            showToast('Wallet feature not available yet', 'warning');
            return null;
        }

        // Try to update customer wallet balance
        try {
            await supabase
                .from('customers')
                .update({ wallet_balance: supabase.raw('wallet_balance + ?', [amount]) })
                .eq('id', userId);
        } catch (updateError) {
            console.warn('Could not update wallet balance:', updateError);
        }

        showToast(`Wallet top-up of ${formatCurrency(amount)} initiated`, 'success');
        return data[0];
    } catch (error) {
        console.error('Top-up error:', error);
        showToast('Top-up failed: ' + error.message, 'error');
        return null;
    }
}

export async function withdrawFromWallet(userId, amount, method = 'mpesa', description = null) {
    try {
        // Check user's balance
        const { data: user, error: userError } = await supabase
            .from('customers')
            .select('wallet_balance')
            .eq('id', userId)
            .single();

        if (userError || !user) {
            throw new Error('User not found');
        }

        if (user.wallet_balance < amount) {
            throw new Error(`Insufficient balance. Available: ${formatCurrency(user.wallet_balance)}`);
        }

        const { data, error } = await supabase
            .from('wallet_transactions')
            .insert([{
                user_id: userId,
                amount: amount,
                type: 'debit',
                method: method,
                status: 'pending',
                description: description || `Withdrawal via ${method}`,
                created_at: new Date().toISOString()
            }])
            .select();

        if (error) {
            showToast('Wallet feature not available yet', 'warning');
            return null;
        }

        // Deduct from wallet
        await supabase
            .from('customers')
            .update({ wallet_balance: supabase.raw('wallet_balance - ?', [amount]) })
            .eq('id', userId);

        showToast(`Withdrawal of ${formatCurrency(amount)} initiated`, 'success');
        return data[0];
    } catch (error) {
        console.error('Withdrawal error:', error);
        showToast('Withdrawal failed: ' + error.message, 'error');
        return null;
    }
}
