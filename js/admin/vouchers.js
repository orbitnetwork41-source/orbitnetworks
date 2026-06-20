// js/admin/vouchers.js
import { supabase } from '../config/supabase.js'; 
import { showToast, generateId, formatDate } from '../utils/helpers.js';

// ✅ FIX THIS FUNCTION - Return vouchers with package details
export async function generateVouchers(packageId, quantity, expiryDate = null) {
    try {
        if (!packageId) {
            throw new Error('Package ID is required');
        }

        if (!quantity || quantity <= 0) {
            throw new Error('Quantity must be greater than 0');
        }

        // Check if package exists
        const { data: packageData, error: packageError } = await supabase
            .from('packages')
            .select('id, name')
            .eq('id', packageId)
            .single();

        if (packageError || !packageData) {
            throw new Error('Package not found');
        }

        const vouchers = [];
        const generatedAt = new Date().toISOString();
        
        for (let i = 0; i < quantity; i++) {
            const code = generateVoucherCode();
            vouchers.push({
                code: code,
                package_id: packageId,
                status: 'active',
                expiry_date: expiryDate || null,
                created_at: generatedAt
            });
        }

        const { data, error } = await supabase
            .from('vouchers')
            .insert(vouchers)
            .select();

        if (error) throw error;

        // Log activity
        await supabase
            .from('activity_logs')
            .insert([{
                action: 'vouchers_generated',
                details: { 
                    package_id: packageId,
                    package_name: packageData.name,
                    quantity: quantity,
                    expiry_date: expiryDate
                },
                created_at: generatedAt
            }]);

        showToast(`${quantity} vouchers generated successfully for ${packageData.name}!`, 'success');
        return data || [];
    } catch (error) {
        console.error('Voucher generation error:', error);
        showToast('Voucher generation failed: ' + error.message, 'error');
        return null;
    }
}

// ✅ FIX THIS FUNCTION - Manual grouping instead of .group()
export async function getVoucherStats() {
    try {
        const { data, error } = await supabase
            .from('vouchers')
            .select('status');

        if (error) throw error;

        const stats = {
            total: data?.length || 0,
            active: data?.filter(v => v.status === 'active').length || 0,
            used: data?.filter(v => v.status === 'used').length || 0,
            expired: data?.filter(v => v.status === 'expired').length || 0,
            pending: data?.filter(v => v.status === 'pending').length || 0
        };

        return stats;
    } catch (error) {
        console.error('Voucher stats error:', error);
        return { total: 0, active: 0, used: 0, expired: 0, pending: 0 };
    }
}

// ✅ ADD THIS MISSING FUNCTION
export async function loadVouchers(status = 'all', limit = 50) {
    try {
        let query = supabase
            .from('vouchers')
            .select(`
                *,
                package:package_id (
                    id,
                    name,
                    price,
                    speed,
                    data_limit_gb,
                    validity_days
                ),
                user:used_by (
                    id,
                    profiles (full_name, phone, email)
                )
            `)
            .order('created_at', { ascending: false });

        if (status !== 'all') {
            query = query.eq('status', status);
        }

        if (limit) {
            query = query.limit(limit);
        }

        const { data, error } = await query;
        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('Load vouchers error:', error);
        return [];
    }
}

// ✅ ADD THIS MISSING FUNCTION
export async function redeemVoucher(code, customerId) {
    try {
        if (!code || !customerId) {
            throw new Error('Voucher code and customer ID are required');
        }

        // Find the voucher
        const { data: voucher, error: findError } = await supabase
            .from('vouchers')
            .select('*')
            .eq('code', code.toUpperCase())
            .single();

        if (findError || !voucher) {
            throw new Error('Invalid voucher code');
        }

        // Check if voucher is already used
        if (voucher.status === 'used') {
            throw new Error('Voucher has already been used');
        }

        // Check if voucher is expired
        if (voucher.status === 'expired') {
            throw new Error('Voucher has expired');
        }

        // Check expiry date
        if (voucher.expiry_date && new Date(voucher.expiry_date) < new Date()) {
            // Mark as expired
            await supabase
                .from('vouchers')
                .update({ 
                    status: 'expired',
                    updated_at: new Date().toISOString()
                })
                .eq('id', voucher.id);
            throw new Error('Voucher has expired');
        }

        // Check if customer exists
        const { data: customer, error: customerError } = await supabase
            .from('customers')
            .select('id, status')
            .eq('id', customerId)
            .single();

        if (customerError || !customer) {
            throw new Error('Customer not found');
        }

        // Start a transaction - update voucher
        const { data: updatedVoucher, error: updateError } = await supabase
            .from('vouchers')
            .update({
                status: 'used',
                used_by: customerId,
                used_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .eq('id', voucher.id)
            .select();

        if (updateError) throw updateError;

        // Get package details
        const { data: packageData, error: packageError } = await supabase
            .from('packages')
            .select('*')
            .eq('id', voucher.package_id)
            .single();

        if (packageError) {
            throw new Error('Package not found for this voucher');
        }

        // Update customer with package
        const customerUpdate = {
            package_id: voucher.package_id,
            data_limit_gb: packageData.data_limit_gb || 0,
            status: 'active',
            data_used_gb: 0,
            updated_at: new Date().toISOString()
        };

        // Set expiry date based on package validity
        if (packageData.validity_days) {
            const expiryDate = new Date();
            expiryDate.setDate(expiryDate.getDate() + packageData.validity_days);
            customerUpdate.expires_at = expiryDate.toISOString();
        }

        const { error: customerUpdateError } = await supabase
            .from('customers')
            .update(customerUpdate)
            .eq('id', customerId);

        if (customerUpdateError) throw customerUpdateError;

        // Log activity
        await supabase
            .from('activity_logs')
            .insert([{
                user_id: customerId,
                action: 'voucher_redeemed',
                details: { 
                    voucher_code: code,
                    package_id: voucher.package_id,
                    package_name: packageData.name
                },
                created_at: new Date().toISOString()
            }]);

        showToast(`Voucher redeemed successfully! Package: ${packageData.name}`, 'success');
        return updatedVoucher[0];
    } catch (error) {
        console.error('Redeem voucher error:', error);
        showToast('Voucher redemption failed: ' + error.message, 'error');
        return null;
    }
}

// ✅ ADD THIS HELPER FUNCTION
export async function getVoucherByCode(code) {
    try {
        const { data, error } = await supabase
            .from('vouchers')
            .select(`
                *,
                package:package_id (
                    id,
                    name,
                    price,
                    speed,
                    data_limit_gb,
                    validity_days
                )
            `)
            .eq('code', code.toUpperCase())
            .single();

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Get voucher by code error:', error);
        return null;
    }
}

// ✅ ADD THIS HELPER FUNCTION
export async function getVouchersByPackage(packageId) {
    try {
        const { data, error } = await supabase
            .from('vouchers')
            .select('*')
            .eq('package_id', packageId)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('Get vouchers by package error:', error);
        return [];
    }
}

// ✅ ADD THIS HELPER FUNCTION
export async function getVouchersByCustomer(customerId) {
    try {
        const { data, error } = await supabase
            .from('vouchers')
            .select(`
                *,
                package:package_id (
                    id,
                    name,
                    price
                )
            `)
            .eq('used_by', customerId)
            .order('used_at', { ascending: false });

        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('Get vouchers by customer error:', error);
        return [];
    }
}

// ✅ ADD THIS HELPER FUNCTION
export async function getVoucherSummary() {
    try {
        const { data, error } = await supabase
            .from('vouchers')
            .select('status, created_at, used_at, package_id');

        if (error) throw error;

        const today = new Date().toISOString().split('T')[0];
        const thisMonth = new Date().toISOString().slice(0, 7);

        const todayUsed = data?.filter(v => 
            v.status === 'used' && v.used_at?.startsWith(today)
        ) || [];

        const monthUsed = data?.filter(v => 
            v.status === 'used' && v.used_at?.startsWith(thisMonth)
        ) || [];

        const active = data?.filter(v => v.status === 'active') || [];

        return {
            total: data?.length || 0,
            active: active.length,
            used: data?.filter(v => v.status === 'used').length || 0,
            expired: data?.filter(v => v.status === 'expired').length || 0,
            usedToday: todayUsed.length,
            usedThisMonth: monthUsed.length,
            activePercentage: data?.length > 0 
                ? Math.round((active.length / data.length) * 100) 
                : 0
        };
    } catch (error) {
        console.error('Get voucher summary error:', error);
        return null;
    }
}

// ✅ ADD THIS HELPER FUNCTION
export async function expireVouchers() {
    try {
        const today = new Date().toISOString().split('T')[0];

        const { data, error } = await supabase
            .from('vouchers')
            .update({
                status: 'expired',
                updated_at: new Date().toISOString()
            })
            .lt('expiry_date', today)
            .eq('status', 'active')
            .select();

        if (error) throw error;

        if (data && data.length > 0) {
            console.log(`Expired ${data.length} vouchers`);
        }

        return data || [];
    } catch (error) {
        console.error('Expire vouchers error:', error);
        return [];
    }
}

// ✅ ADD THIS HELPER FUNCTION
export async function deleteVoucher(voucherId) {
    try {
        const { data, error } = await supabase
            .from('vouchers')
            .update({
                status: 'expired',
                updated_at: new Date().toISOString()
            })
            .eq('id', voucherId)
            .eq('status', 'active')
            .select();

        if (error) throw error;

        if (!data || data.length === 0) {
            throw new Error('Voucher not found or already used');
        }

        showToast('Voucher deleted successfully', 'success');
        return data[0];
    } catch (error) {
        console.error('Delete voucher error:', error);
        showToast('Delete failed: ' + error.message, 'error');
        return null;
    }
}

// ✅ ADD THIS HELPER FUNCTION
export async function getVoucherUsageStats() {
    try {
        const { data, error } = await supabase
            .from('vouchers')
            .select(`
                status,
                used_at,
                package:package_id (name)
            `)
            .eq('status', 'used')
            .order('used_at', { ascending: false });

        if (error) throw error;

        // Group by package
        const byPackage = {};
        data?.forEach(v => {
            const name = v.package?.name || 'Unknown';
            byPackage[name] = (byPackage[name] || 0) + 1;
        });

        // Group by date
        const byDate = {};
        data?.forEach(v => {
            if (v.used_at) {
                const date = new Date(v.used_at).toLocaleDateString();
                byDate[date] = (byDate[date] || 0) + 1;
            }
        });

        return {
            totalUsed: data?.length || 0,
            byPackage: byPackage,
            byDate: byDate,
            topPackage: Object.entries(byPackage)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 1)
                .map(([name, count]) => ({ name, count }))[0]
        };
    } catch (error) {
        console.error('Get voucher usage stats error:', error);
        return null;
    }
}

// ✅ IMPROVED VOUCHER CODE GENERATION
function generateVoucherCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 12; i++) {
        if (i === 4 || i === 8) {
            code += '-';
        } else {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
    }
    return code;
}

// ✅ ADD THIS FUNCTION FOR BULK IMPORT
export async function importVouchers(vouchers) {
    try {
        if (!Array.isArray(vouchers) || vouchers.length === 0) {
            throw new Error('No vouchers to import');
        }

        // Validate each voucher
        const validVouchers = vouchers.filter(v => 
            v.code && v.package_id
        );

        if (validVouchers.length === 0) {
            throw new Error('No valid vouchers to import');
        }

        const { data, error } = await supabase
            .from('vouchers')
            .insert(validVouchers)
            .select();

        if (error) throw error;

        showToast(`Imported ${data.length} vouchers successfully`, 'success');
        return data;
    } catch (error) {
        console.error('Import vouchers error:', error);
        showToast('Import failed: ' + error.message, 'error');
        return null;
    }
}
