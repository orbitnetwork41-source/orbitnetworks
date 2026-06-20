// js/admin/wallet.js
import { supabase } from '../config/supabase.js';
import { showToast, formatCurrency, formatDate } from '../utils/helpers.js'; 

export async function loadWalletStats(limit = 50) {
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

        if (error) throw error;

        // Calculate total balance from all transactions (not just the last 50)
        const { data: allTransactions, error: balanceError } = await supabase
            .from('wallet_transactions')
            .select('amount, type, status')
            .eq('status', 'completed');

        if (balanceError) throw balanceError;

        const totalBalance = allTransactions?.reduce((sum, t) => {
            return t.type === 'credit' ? sum + Number(t.amount) : sum - Number(t.amount);
        }, 0) || 0;

        // Calculate stats
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

// ✅ ADD THIS MISSING FUNCTION
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

        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('Get wallet transactions error:', error);
        return [];
    }
}

export async function topUpWallet(userId, amount, method = 'mpesa', description = null) {
    try {
        if (!userId || !amount || amount <= 0) {
            throw new Error('Invalid user ID or amount');
        }

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

        if (error) throw error;

        // Log activity
        await supabase
            .from('activity_logs')
            .insert([{
                user_id: userId,
                action: 'wallet_topup_initiated',
                details: { 
                    amount: amount, 
                    method: method,
                    transaction_id: data[0].id
                },
                created_at: new Date().toISOString()
            }]);

        // Simulate payment processing (in production, this would be handled by a payment gateway)
        setTimeout(async () => {
            await processWalletTransaction(data[0].id, 'completed');
        }, 3000);

        showToast(`Wallet top-up of ${formatCurrency(amount)} initiated`, 'success');
        return data[0];
    } catch (error) {
        console.error('Top-up error:', error);
        showToast('Top-up failed: ' + error.message, 'error');
        return null;
    }
}

// ✅ ADD THIS MISSING FUNCTION
export async function withdrawFromWallet(userId, amount, method = 'mpesa', description = null) {
    try {
        if (!userId || !amount || amount <= 0) {
            throw new Error('Invalid user ID or amount');
        }

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

        if (error) throw error;

        // Immediately deduct from wallet (pending approval)
        const { error: updateError } = await supabase
            .from('customers')
            .update({ 
                wallet_balance: supabase.raw('wallet_balance - ?', [amount])
            })
            .eq('id', userId);

        if (updateError) throw updateError;

        // Log activity
        await supabase
            .from('activity_logs')
            .insert([{
                user_id: userId,
                action: 'wallet_withdrawal_initiated',
                details: { 
                    amount: amount, 
                    method: method,
                    transaction_id: data[0].id
                },
                created_at: new Date().toISOString()
            }]);

        showToast(`Withdrawal of ${formatCurrency(amount)} initiated`, 'success');
        return data[0];
    } catch (error) {
        console.error('Withdrawal error:', error);
        showToast('Withdrawal failed: ' + error.message, 'error');
        return null;
    }
}

// ✅ ADD THIS HELPER FUNCTION
export async function processWalletTransaction(transactionId, status) {
    try {
        const { data: transaction, error: fetchError } = await supabase
            .from('wallet_transactions')
            .select('*')
            .eq('id', transactionId)
            .single();

        if (fetchError) throw fetchError;

        if (!transaction) {
            throw new Error('Transaction not found');
        }

        // If transaction is already processed, skip
        if (transaction.status !== 'pending') {
            return transaction;
        }

        const { data, error } = await supabase
            .from('wallet_transactions')
            .update({
                status: status,
                updated_at: new Date().toISOString()
            })
            .eq('id', transactionId)
            .select();

        if (error) throw error;

        // If transaction was a credit and completed, update customer's wallet balance
        if (transaction.type === 'credit' && status === 'completed') {
            const { error: updateError } = await supabase
                .from('customers')
                .update({ 
                    wallet_balance: supabase.raw('wallet_balance + ?', [transaction.amount])
                })
                .eq('id', transaction.user_id);

            if (updateError) throw updateError;
        }

        // If transaction was a debit and failed, refund the amount
        if (transaction.type === 'debit' && status === 'failed') {
            const { error: updateError } = await supabase
                .from('customers')
                .update({ 
                    wallet_balance: supabase.raw('wallet_balance + ?', [transaction.amount])
                })
                .eq('id', transaction.user_id);

            if (updateError) throw updateError;
        }

        return data[0];
    } catch (error) {
        console.error('Process transaction error:', error);
        throw error;
    }
}

// ✅ ADD THIS HELPER FUNCTION
export async function getWalletBalance(userId) {
    try {
        const { data, error } = await supabase
            .from('customers')
            .select('wallet_balance')
            .eq('id', userId)
            .single();

        if (error) throw error;
        return data?.wallet_balance || 0;
    } catch (error) {
        console.error('Get wallet balance error:', error);
        return 0;
    }
}

// ✅ ADD THIS HELPER FUNCTION
export async function getWalletTransactionsByUser(userId, limit = 20) {
    try {
        const { data, error } = await supabase
            .from('wallet_transactions')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('Get user transactions error:', error);
        return [];
    }
}

// ✅ ADD THIS HELPER FUNCTION
export async function getWalletStatsByDateRange(startDate, endDate) {
    try {
        const { data, error } = await supabase
            .from('wallet_transactions')
            .select('amount, type, status, created_at')
            .gte('created_at', startDate.toISOString())
            .lte('created_at', endDate.toISOString())
            .eq('status', 'completed');

        if (error) throw error;

        const totalCredit = data?.filter(t => t.type === 'credit')
            .reduce((sum, t) => sum + Number(t.amount), 0) || 0;
        
        const totalDebit = data?.filter(t => t.type === 'debit')
            .reduce((sum, t) => sum + Number(t.amount), 0) || 0;

        // Daily breakdown
        const daily = {};
        data?.forEach(t => {
            const date = new Date(t.created_at).toLocaleDateString();
            if (!daily[date]) {
                daily[date] = { credit: 0, debit: 0 };
            }
            if (t.type === 'credit') {
                daily[date].credit += Number(t.amount);
            } else {
                daily[date].debit += Number(t.amount);
            }
        });

        return {
            totalCredit,
            totalDebit,
            netChange: totalCredit - totalDebit,
            transactionCount: data?.length || 0,
            daily
        };
    } catch (error) {
        console.error('Get wallet stats by date error:', error);
        return null;
    }
}

// ✅ ADD THIS HELPER FUNCTION
export async function getWalletSummary() {
    try {
        // Get all completed transactions
        const { data, error } = await supabase
            .from('wallet_transactions')
            .select('amount, type, status, created_at')
            .eq('status', 'completed');

        if (error) throw error;

        const today = new Date().toISOString().split('T')[0];
        const thisMonth = new Date().toISOString().slice(0, 7);

        const todayTransactions = data?.filter(t => t.created_at?.startsWith(today)) || [];
        const monthTransactions = data?.filter(t => t.created_at?.startsWith(thisMonth)) || [];

        return {
            totalBalance: data?.reduce((sum, t) => {
                return t.type === 'credit' ? sum + Number(t.amount) : sum - Number(t.amount);
            }, 0) || 0,
            totalCredit: data?.filter(t => t.type === 'credit')
                .reduce((sum, t) => sum + Number(t.amount), 0) || 0,
            totalDebit: data?.filter(t => t.type === 'debit')
                .reduce((sum, t) => sum + Number(t.amount), 0) || 0,
            todayCredit: todayTransactions.filter(t => t.type === 'credit')
                .reduce((sum, t) => sum + Number(t.amount), 0) || 0,
            todayDebit: todayTransactions.filter(t => t.type === 'debit')
                .reduce((sum, t) => sum + Number(t.amount), 0) || 0,
            monthCredit: monthTransactions.filter(t => t.type === 'credit')
                .reduce((sum, t) => sum + Number(t.amount), 0) || 0,
            monthDebit: monthTransactions.filter(t => t.type === 'debit')
                .reduce((sum, t) => sum + Number(t.amount), 0) || 0,
            totalTransactions: data?.length || 0
        };
    } catch (error) {
        console.error('Get wallet summary error:', error);
        return null;
    }
}

// ✅ ADD THIS HELPER FUNCTION
export async function approveWithdrawal(transactionId) {
    try {
        const { data: transaction, error: fetchError } = await supabase
            .from('wallet_transactions')
            .select('*')
            .eq('id', transactionId)
            .single();

        if (fetchError) throw fetchError;

        if (!transaction) {
            throw new Error('Transaction not found');
        }

        if (transaction.type !== 'debit' || transaction.status !== 'pending') {
            throw new Error('Transaction cannot be approved');
        }

        // Process the withdrawal
        const result = await processWalletTransaction(transactionId, 'completed');

        showToast('Withdrawal approved successfully', 'success');
        return result;
    } catch (error) {
        console.error('Approve withdrawal error:', error);
        showToast('Approval failed: ' + error.message, 'error');
        return null;
    }
}

// ✅ ADD THIS HELPER FUNCTION
export async function rejectWithdrawal(transactionId, reason = null) {
    try {
        const { data: transaction, error: fetchError } = await supabase
            .from('wallet_transactions')
            .select('*')
            .eq('id', transactionId)
            .single();

        if (fetchError) throw fetchError;

        if (!transaction) {
            throw new Error('Transaction not found');
        }

        if (transaction.type !== 'debit' || transaction.status !== 'pending') {
            throw new Error('Transaction cannot be rejected');
        }

        // Process as failed (this will refund the amount)
        const result = await processWalletTransaction(transactionId, 'failed');

        showToast('Withdrawal rejected' + (reason ? `: ${reason}` : ''), 'warning');
        return result;
    } catch (error) {
        console.error('Reject withdrawal error:', error);
        showToast('Rejection failed: ' + error.message, 'error');
        return null;
    }
}
