// js/admin/vouchers.js
import { supabase } from '../config/supabase.js'; 
import { showToast, generateId } from '../utils/helpers.js';

export async function generateVouchers(packageId, quantity, expiryDate) {
    try {
        const vouchers = [];
        for (let i = 0; i < quantity; i++) {
            const code = generateVoucherCode();
            vouchers.push({
                code: code,
                package_id: packageId,
                status: 'active',
                expiry_date: expiryDate,
                created_at: new Date().toISOString()
            });
        }

        const { data, error } = await supabase
            .from('vouchers')
            .insert(vouchers)
            .select();

        if (error) throw error;
        showToast(`${quantity} vouchers generated successfully!`, 'success');
        return data;
    } catch (error) {
        showToast('Voucher generation failed: ' + error.message, 'error');
        return null;
    }
}

function generateVoucherCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 12; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
        if (i === 3 || i === 7) code += '-';
    }
    return code;
}

export async function getVoucherStats() {
    try {
        const { data, error } = await supabase
            .from('vouchers')
            .select('status, count(*)', { count: 'exact' })
            .group('status');

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Voucher stats error:', error);
        return [];
    }
}
