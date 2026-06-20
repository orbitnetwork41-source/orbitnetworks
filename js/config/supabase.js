import { createClient } from '@supabase/supabase-js';

// Your Supabase credentials
export const supabaseConfig = {
    url: 'https://ozyuyawnmwhkmzckxpgu.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im96eXV5YXdubXdoa216Y2t4cGd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE5NjY3OTcsImV4cCI6MjA5NzU0Mjc5N30.q8BGDXNfR17wq9_g5feqqDmjLeBd4cPl2lP6D34n50g'
};

// Create and export the Supabase client
export const supabase = createClient(supabaseConfig.url, supabaseConfig.anonKey);

// Export a check function
export async function checkSupabaseConnection() {
    try {
        const { data, error } = await supabase
            .from('profiles')
            .select('count', { count: 'exact', head: true });
        return !error;
    } catch (error) {
        console.error('Supabase connection error:', error);
        return false;
    }
}

export default supabase;
