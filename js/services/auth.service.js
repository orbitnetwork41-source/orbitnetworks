import { supabase } from '../config/supabase.js';

export class AuthService {
    // Login with role detection
    static async login(email, password) {
        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password
            });
            
            if (error) throw error;

            // Get user profile
            const { data: profile, error: profileError } = await supabase
                .from('profiles')
                .select('role, full_name')
                .eq('id', data.user.id)
                .single();

            if (profileError) throw profileError;

            const userData = {
                ...data.user,
                profile: profile
            };

            localStorage.setItem('user', JSON.stringify(userData));
            localStorage.setItem('userRole', profile.role);
            
            return { 
                success: true, 
                user: userData,
                role: profile.role
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    static async logout() {
        await supabase.auth.signOut();
        localStorage.removeItem('user');
        localStorage.removeItem('userRole');
        window.location.href = '/';
    }

    static getCurrentUser() {
        const user = localStorage.getItem('user');
        return user ? JSON.parse(user) : null;
    }

    static getUserRole() {
        return localStorage.getItem('userRole') || 'customer';
    }

    static isAuthenticated() {
        return !!this.getCurrentUser();
    }

    static isAdmin() {
        const role = this.getUserRole();
        return role === 'admin' || role === 'super_admin';
    }

    static isSuperAdmin() {
        return this.getUserRole() === 'super_admin';
    }

    // Register new user (admin only)
    static async registerUser(email, password, fullName, phone, role = 'customer') {
        try {
            const { data, error } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        full_name: fullName,
                        phone: phone,
                        role: role
                    }
                }
            });
            
            if (error) throw error;
            return { success: true, user: data.user };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
}
