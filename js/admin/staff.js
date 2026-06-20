// js/admin/staff.js 
import { supabase } from '../config/supabase.js';
import { showToast, getInitials } from '../utils/helpers.js';

export async function loadStaff(limit = 50) {
    try {
        const { data, error } = await supabase
            .from('profiles')
            .select(`
                *,
                user:auth.users (email)
            `)
            .in('role', ['admin', 'staff', 'support'])
            .order('full_name');

        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('Staff load error:', error);
        return [];
    }
}

// ✅ ADD THIS MISSING FUNCTION
export async function getStaffStats() {
    try {
        const { data, error } = await supabase
            .from('profiles')
            .select('role')
            .in('role', ['admin', 'staff', 'support']);

        if (error) throw error;

        const stats = {
            total: data?.length || 0,
            admins: data?.filter(p => p.role === 'admin').length || 0,
            staff: data?.filter(p => p.role === 'staff').length || 0,
            support: data?.filter(p => p.role === 'support').length || 0
        };

        return stats;
    } catch (error) {
        console.error('Staff stats error:', error);
        return { total: 0, admins: 0, staff: 0, support: 0 };
    }
}

// ✅ FIX THIS FUNCTION - Remove permissions column
export async function updateStaffRole(staffId, role) {
    try {
        // Check if user exists
        const { data: existing, error: checkError } = await supabase
            .from('profiles')
            .select('id, role')
            .eq('id', staffId)
            .single();

        if (checkError || !existing) {
            throw new Error('Staff member not found');
        }

        const { data, error } = await supabase
            .from('profiles')
            .update({
                role: role,
                updated_at: new Date().toISOString()
            })
            .eq('id', staffId)
            .select();

        if (error) throw error;

        // Log activity
        await supabase
            .from('activity_logs')
            .insert([{
                user_id: staffId,
                action: 'staff_role_updated',
                details: { 
                    staff_id: staffId, 
                    old_role: existing.role,
                    new_role: role
                },
                created_at: new Date().toISOString()
            }]);

        showToast(`Staff role updated to ${role} successfully`, 'success');
        return data[0];
    } catch (error) {
        console.error('Update staff role error:', error);
        showToast('Update failed: ' + error.message, 'error');
        return null;
    }
}

// ✅ ADD THIS HELPER FUNCTION
export async function createStaffMember(email, password, fullName, phone, role = 'staff') {
    try {
        // Check if email already exists
        const { data: existing, error: checkError } = await supabase
            .from('profiles')
            .select('id')
            .eq('email', email)
            .single();

        if (existing) {
            throw new Error('Email already registered');
        }

        // Create auth user (requires admin privileges)
        const { data: authData, error: authError } = await supabase.auth.admin
            .createUser({
                email: email,
                password: password,
                email_confirm: true,
                user_metadata: {
                    full_name: fullName,
                    phone: phone
                }
            });

        if (authError) throw authError;

        // Create profile
        const { data, error } = await supabase
            .from('profiles')
            .insert([{
                id: authData.user.id,
                full_name: fullName,
                phone: phone,
                role: role,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            }])
            .select();

        if (error) {
            // If profile creation fails, delete the auth user
            await supabase.auth.admin.deleteUser(authData.user.id);
            throw error;
        }

        // Log activity
        await supabase
            .from('activity_logs')
            .insert([{
                action: 'staff_created',
                details: { 
                    staff_id: data[0].id, 
                    email: email,
                    role: role
                },
                created_at: new Date().toISOString()
            }]);

        showToast(`Staff member ${fullName} created successfully`, 'success');
        return data[0];
    } catch (error) {
        console.error('Create staff error:', error);
        showToast('Failed to create staff: ' + error.message, 'error');
        return null;
    }
}

// ✅ ADD THIS HELPER FUNCTION
export async function deleteStaffMember(staffId) {
    try {
        // Check if user exists and is staff
        const { data: staff, error: checkError } = await supabase
            .from('profiles')
            .select('id, role')
            .eq('id', staffId)
            .in('role', ['staff', 'support'])
            .single();

        if (checkError || !staff) {
            throw new Error('Staff member not found');
        }

        // Soft delete - change role to 'inactive' instead of deleting
        const { data, error } = await supabase
            .from('profiles')
            .update({
                role: 'inactive',
                updated_at: new Date().toISOString()
            })
            .eq('id', staffId)
            .select();

        if (error) throw error;

        // Log activity
        await supabase
            .from('activity_logs')
            .insert([{
                action: 'staff_deactivated',
                details: { 
                    staff_id: staffId,
                    previous_role: staff.role
                },
                created_at: new Date().toISOString()
            }]);

        showToast('Staff member deactivated successfully', 'success');
        return data[0];
    } catch (error) {
        console.error('Delete staff error:', error);
        showToast('Failed to deactivate staff: ' + error.message, 'error');
        return null;
    }
}

// ✅ ADD THIS HELPER FUNCTION
export async function updateStaffProfile(staffId, updates) {
    try {
        const allowedFields = ['full_name', 'phone', 'avatar_url'];
        const filteredUpdates = {};
        
        Object.keys(updates).forEach(key => {
            if (allowedFields.includes(key)) {
                filteredUpdates[key] = updates[key];
            }
        });

        if (Object.keys(filteredUpdates).length === 0) {
            throw new Error('No valid fields to update');
        }

        filteredUpdates.updated_at = new Date().toISOString();

        const { data, error } = await supabase
            .from('profiles')
            .update(filteredUpdates)
            .eq('id', staffId)
            .select();

        if (error) throw error;

        showToast('Staff profile updated successfully', 'success');
        return data[0];
    } catch (error) {
        console.error('Update staff profile error:', error);
        showToast('Update failed: ' + error.message, 'error');
        return null;
    }
}

// ✅ ADD THIS HELPER FUNCTION
export async function getStaffMember(staffId) {
    try {
        const { data, error } = await supabase
            .from('profiles')
            .select(`
                *,
                user:auth.users (email, last_sign_in_at)
            `)
            .eq('id', staffId)
            .in('role', ['admin', 'staff', 'support'])
            .single();

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Get staff member error:', error);
        return null;
    }
}

// ✅ ADD THIS HELPER FUNCTION
export async function getStaffByRole(role) {
    try {
        const { data, error } = await supabase
            .from('profiles')
            .select(`
                *,
                user:auth.users (email)
            `)
            .eq('role', role)
            .order('full_name');

        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('Get staff by role error:', error);
        return [];
    }
}

// ✅ ADD THIS HELPER FUNCTION
export async function getStaffActivity(staffId, limit = 20) {
    try {
        const { data, error } = await supabase
            .from('activity_logs')
            .select('*')
            .eq('user_id', staffId)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('Get staff activity error:', error);
        return [];
    }
}

// ✅ ADD THIS HELPER FUNCTION
export async function getStaffPermissions(staffId) {
    try {
        const { data, error } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', staffId)
            .single();

        if (error) throw error;

        // Define permissions based on role
        const permissions = {
            admin: {
                canManageStaff: true,
                canManageCustomers: true,
                canManagePackages: true,
                canManagePayments: true,
                canManageRouters: true,
                canViewReports: true,
                canManageSettings: true,
                canSendSMS: true,
                canManageTickets: true,
                canManageVouchers: true,
                canViewAnalytics: true
            },
            staff: {
                canManageStaff: false,
                canManageCustomers: true,
                canManagePackages: false,
                canManagePayments: true,
                canManageRouters: false,
                canViewReports: true,
                canManageSettings: false,
                canSendSMS: true,
                canManageTickets: true,
                canManageVouchers: true,
                canViewAnalytics: true
            },
            support: {
                canManageStaff: false,
                canManageCustomers: true,
                canManagePackages: false,
                canManagePayments: false,
                canManageRouters: false,
                canViewReports: false,
                canManageSettings: false,
                canSendSMS: true,
                canManageTickets: true,
                canManageVouchers: false,
                canViewAnalytics: false
            }
        };

        return permissions[data?.role] || permissions.staff;
    } catch (error) {
        console.error('Get staff permissions error:', error);
        return null;
    }
}

// ✅ ADD THIS HELPER FUNCTION
export async function getStaffPerformanceMetrics() {
    try {
        // Get all staff
        const staff = await loadStaff(100);
        
        const metrics = await Promise.all(staff.map(async (member) => {
            // Get ticket stats for this staff member
            const { data: tickets, error } = await supabase
                .from('support_tickets')
                .select('status, created_at, resolved_at')
                .eq('assigned_to', member.id);

            if (error) {
                return {
                    ...member,
                    metrics: {
                        totalTickets: 0,
                        resolvedTickets: 0,
                        avgResolutionTime: 0,
                        openTickets: 0
                    }
                };
            }

            const resolved = tickets?.filter(t => t.status === 'resolved' || t.status === 'closed') || [];
            const open = tickets?.filter(t => t.status === 'open' || t.status === 'in_progress') || [];
            
            // Calculate average resolution time
            let totalHours = 0;
            resolved.forEach(t => {
                if (t.created_at && t.resolved_at) {
                    const created = new Date(t.created_at);
                    const resolved_ = new Date(t.resolved_at);
                    totalHours += (resolved_ - created) / (1000 * 60 * 60);
                }
            });

            const avgResolutionTime = resolved.length > 0 
                ? Math.round((totalHours / resolved.length) * 10) / 10 
                : 0;

            return {
                ...member,
                metrics: {
                    totalTickets: tickets?.length || 0,
                    resolvedTickets: resolved.length,
                    avgResolutionTime: avgResolutionTime,
                    openTickets: open.length,
                    resolutionRate: tickets?.length > 0 
                        ? Math.round((resolved.length / tickets.length) * 100) 
                        : 0
                }
            };
        }));

        return metrics;
    } catch (error) {
        console.error('Get staff performance metrics error:', error);
        return [];
    }
}
