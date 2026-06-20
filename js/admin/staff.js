// js/admin/staff.js 
import { supabase } from '../config/supabase.js';
import { showToast } from '../utils/helpers.js';

export async function loadStaff() {
    try {
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('role', 'staff')
            .order('full_name');

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Staff load error:', error);
        return [];
    }
}

export async function updateStaffRole(staffId, role, permissions) {
    try {
        const { data, error } = await supabase
            .from('profiles')
            .update({
                role: role,
                permissions: permissions
            })
            .eq('id', staffId)
            .select();

        if (error) throw error;
        showToast('Staff updated successfully', 'success');
        return data;
    } catch (error) {
        showToast('Update failed: ' + error.message, 'error');
        return null;
    }
}
