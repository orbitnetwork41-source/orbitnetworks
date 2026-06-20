import { supabase } from '../config/supabase.js';

export class AuthService {
    static async login(email, password) {
        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password
            });
            if (error) throw error;
            
            // Store session
            localStorage.setItem('user', JSON.stringify(data.user));
            return { success: true, user: data.user };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    static async logout() {
        await supabase.auth.signOut();
        localStorage.removeItem('user');
        window.location.reload();
    }

    static getCurrentUser() {
        const user = localStorage.getItem('user');
        return user ? JSON.parse(user) : null;
    }

    static isAuthenticated() {
        return !!this.getCurrentUser();
    }
}
