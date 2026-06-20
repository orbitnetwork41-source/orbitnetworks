import { supabase } from '../config/supabase.js';
import { AuthService } from '../services/auth.service.js';
import { showToast } from '../utils/helpers.js';

// Check authentication
if (!AuthService.isAuthenticated()) {
    window.location.href = '/';
}

// Initialize customer dashboard
document.addEventListener('DOMContentLoaded', async () => {
    const user = AuthService.getCurrentUser();
    
    // Set user info
    const firstName = user?.profile?.full_name?.split(' ')[0] || 'Customer';
    document.getElementById('welcomeName').textContent = firstName;
    document.getElementById('userName').textContent = user?.profile?.full_name || 'John Doe';
    document.getElementById('userInitial').textContent = firstName.charAt(0).toUpperCase();

    // Load customer data
    await loadCustomerData();
    await loadRecentActivity();

    // Setup user menu toggle
    document.getElementById('userMenuBtn').addEventListener('click', () => {
        const menu = document.getElementById('userMenu');
        menu.classList.toggle('hidden');
    });

    // Close menu on outside click
    document.addEventListener('click', (e) => {
        const menu = document.getElementById('userMenu');
        const btn = document.getElementById('userMenuBtn');
        if (!menu.contains(e.target) && !btn.contains(e.target)) {
            menu.classList.add('hidden');
        }
    });

    // Setup logout
    document.getElementById('logoutBtn').addEventListener('click', () => {
        AuthService.logout();
    });

    // Setup real-time subscriptions for customer data
    subscribeToCustomerData();
});

// Load customer data
async function loadCustomerData() {
    try {
        const user = AuthService.getCurrentUser();
        const userId = user.id;

        // Get customer data
        const { data: customer, error } = await supabase
            .from('customers')
            .select('*, packages(*)')
            .eq('id', userId)
            .single();

        if (error) throw error;

        // Update UI
        if (customer) {
            // Data usage
            const dataUsed = customer.data_used_gb || 0;
            const dataLimit = customer.data_limit_gb || 50;
            const percentage = Math.min((dataUsed / dataLimit) * 100, 100);
            
            document.getElementById('dataUsed').textContent = `${dataUsed.toFixed(1)} GB`;
            document.getElementById('dataLimit').textContent = `${dataLimit} GB`;
            
            // Update progress bar
            const progressBar = document.querySelector('.bg-gradient-to-r.from-blue-500');
            if (progressBar) {
                progressBar.style.width = `${percentage}%`;
            }

            // Package info
            document.getElementById('currentPackage').textContent = customer.packages?.name || 'No Package';
            document.getElementById('expiryDate').textContent = customer.expires_at 
                ? new Date(customer.expires_at).toLocaleDateString() 
                : 'N/A';

            // Wallet balance
            document.getElementById('walletBalance').textContent = `KES ${(customer.wallet_balance || 0).toFixed(2)}`;
            
            // Status
            document.getElementById('connectionStatus').textContent = customer.status?.toUpperCase() || 'Active';
            document.getElementById('currentSpeed').textContent = customer.packages?.speed || 'N/A';
        }

    } catch (error) {
        console.error('Error loading customer data:', error);
        showToast('Error loading your data', 'error');
    }
}

// Load recent activity
async function loadRecentActivity() {
    try {
        const user = AuthService.getCurrentUser();
        
        const { data: activities, error } = await supabase
            .from('payments')
            .select('amount, method, status, created_at')
            .eq('customer_id', user.id)
            .order('created_at', { ascending: false })
            .limit(5);

        if (error) throw error;

        const container = document.getElementById('recentActivity');

        if (!activities || activities.length === 0) {
            container.innerHTML = `
                <div class="text-center text-gray-400 py-4">
                    <p>No recent activity</p>
                </div>
            `;
            return;
        }

        container.innerHTML = activities.map(activity => {
            const statusColors = {
                'completed': 'text-green-400',
                'pending': 'text-yellow-400',
                'failed': 'text-red-400'
            };
            const statusIcons = {
                'completed': 'fa-check-circle',
                'pending': 'fa-clock',
                'failed': 'fa-times-circle'
            };
            const color = statusColors[activity.status] || 'text-gray-400';
            const icon = statusIcons[activity.status] || 'fa-circle';

            return `
                <div class="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 bg-white/5 rounded-lg flex items-center justify-center">
                            <i class="fas ${icon} ${color} text-xl"></i>
                        </div>
                        <div>
                            <p class="text-sm text-white">${activity.method.toUpperCase()} Payment</p>
                            <p class="text-xs text-gray-400">${new Date(activity.created_at).toLocaleDateString()}</p>
                        </div>
                    </div>
                    <div class="text-right">
                        <p class="text-sm font-bold text-white">KES ${Number(activity.amount).toFixed(2)}</p>
                        <p class="text-xs ${color}">${activity.status}</p>
                    </div>
                </div>
            `;
        }).join('');

    } catch (error) {
        console.error('Error loading recent activity:', error);
    }
}

// Real-time subscriptions
function subscribeToCustomerData() {
    const user = AuthService.getCurrentUser();
    const userId = user.id;

    // Subscribe to customer data changes
    supabase
        .channel(`customer:${userId}`)
        .on(
            'postgres_changes',
            {
                event: '*',
                schema: 'public',
                table: 'customers',
                filter: `id=eq.${userId}`
            },
            (payload) => {
                console.log('Customer data updated:', payload);
                loadCustomerData(); // Refresh data
            }
        )
        .subscribe();

    // Subscribe to new payments
    supabase
        .channel(`payments:${userId}`)
        .on(
            'postgres_changes',
            {
                event: 'INSERT',
                schema: 'public',
                table: 'payments',
                filter: `customer_id=eq.${userId}`
            },
            (payload) => {
                console.log('New payment:', payload);
                showToast(`Payment of KES ${payload.new.amount} received!`, 'success');
                loadCustomerData();
                loadRecentActivity();
            }
        )
        .subscribe();
}
