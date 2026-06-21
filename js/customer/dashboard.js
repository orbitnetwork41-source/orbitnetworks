// js/customer/dashboard.js
// Customer Dashboard - Complete Working Version

import { supabase } from '../config/supabase.js';
import { AuthService } from '../services/auth.service.js';
import { 
    showToast, 
    formatCurrency, 
    formatDate, 
    getTimeAgo, 
    getInitials 
} from '../utils/helpers.js';

// ============================================
// STATE
// ============================================
let currentUser = null;
let customerData = null;
let refreshInterval = null;

// ============================================
// DOM ELEMENTS
// ============================================
const elements = {
    welcomeName: document.getElementById('welcomeName'),
    userName: document.getElementById('userName'),
    userInitial: document.getElementById('userInitial'),
    userMenuBtn: document.getElementById('userMenuBtn'),
    userMenu: document.getElementById('userMenu'),
    logoutBtn: document.getElementById('logoutBtn'),
    logoutBtnMobile: document.getElementById('logoutBtnMobile'),
    dataUsed: document.getElementById('dataUsed'),
    dataLimit: document.getElementById('dataLimit'),
    currentPackage: document.getElementById('currentPackage'),
    expiryDate: document.getElementById('expiryDate'),
    walletBalance: document.getElementById('walletBalance'),
    lastTopup: document.getElementById('lastTopup'),
    connectionStatus: document.getElementById('connectionStatus'),
    currentSpeed: document.getElementById('currentSpeed'),
    recentActivity: document.getElementById('recentActivity'),
    progressBar: document.getElementById('progressBar'),
    walletBadge: document.getElementById('walletBadge')
};

// ============================================
// AUTH CHECK
// ============================================
if (!AuthService.isAuthenticated()) {
    console.log('🔒 Not authenticated, redirecting to login...');
    window.location.href = '/orbitnetworks/login.html';
    throw new Error('Not authenticated');
}

// Check if user is admin
if (AuthService.isAdmin()) {
    console.log('👑 Admin user, redirecting to admin dashboard...');
    window.location.href = '/orbitnetworks/admin/dashboard.html';
    throw new Error('Admin access only');
}

currentUser = AuthService.getCurrentUser();
console.log('✅ Authenticated as customer:', currentUser?.email);

// ============================================
// SET USER INFO
// ============================================
function setUserInfo() {
    const user = currentUser;
    const name = user?.profile?.full_name || user?.email?.split('@')[0] || 'Customer';
    const firstName = name.split(' ')[0];
    const initials = getInitials(name);
    
    if (elements.welcomeName) elements.welcomeName.textContent = firstName;
    if (elements.userName) elements.userName.textContent = name;
    if (elements.userInitial) elements.userInitial.textContent = initials;
}

// ============================================
// LOAD CUSTOMER DATA
// ============================================
async function loadCustomerData() {
    try {
        const user = currentUser;
        const userId = user.id;

        // Get customer data with package info
        const { data: customer, error } = await supabase
            .from('customers')
            .select(`
                *,
                packages:package_id (
                    id,
                    name,
                    price,
                    speed,
                    data_limit_gb,
                    validity_days
                )
            `)
            .eq('id', userId)
            .single();

        if (error) {
            console.error('❌ Error loading customer data:', error);
            showToast('Error loading your data', 'error');
            return;
        }

        customerData = customer;
        console.log('✅ Customer data loaded:', customerData);

        // Update UI
        updateUI(customer);

        // Get last top-up
        await getLastTopup(userId);

        // Update wallet badge
        updateWalletBadge(customer);

    } catch (error) {
        console.error('❌ Error:', error);
        showToast('Error loading customer data', 'error');
    }
}

// ============================================
// UPDATE UI
// ============================================
function updateUI(customer) {
    if (!customer) return;
    
    const pkg = customer.packages || {};
    
    // Data usage
    const dataUsed = customer.data_used_gb || 0;
    const dataLimit = customer.data_limit_gb || pkg.data_limit_gb || 50;
    const percentage = Math.min((dataUsed / dataLimit) * 100, 100);
    
    if (elements.dataUsed) elements.dataUsed.textContent = `${dataUsed.toFixed(1)} GB`;
    if (elements.dataLimit) elements.dataLimit.textContent = `${dataLimit} GB`;
    if (elements.progressBar) elements.progressBar.style.width = `${percentage}%`;

    // Package info
    if (elements.currentPackage) elements.currentPackage.textContent = pkg.name || 'No Package';
    if (elements.expiryDate) {
        elements.expiryDate.textContent = customer.expires_at 
            ? formatDate(customer.expires_at) 
            : 'Never';
    }

    // Wallet balance
    if (elements.walletBalance) {
        elements.walletBalance.textContent = formatCurrency(customer.wallet_balance || 0);
    }
    
    // Status
    const status = customer.status || 'active';
    const statusColors = {
        'active': 'text-green-400',
        'suspended': 'text-red-400',
        'expired': 'text-yellow-400'
    };
    
    if (elements.connectionStatus) {
        elements.connectionStatus.textContent = status.toUpperCase();
        elements.connectionStatus.className = 'text-2xl font-bold ' + (statusColors[status] || 'text-green-400');
    }
    
    // Speed
    if (elements.currentSpeed) elements.currentSpeed.textContent = pkg.speed || 'N/A';
}

// ============================================
// UPDATE WALLET BADGE
// ============================================
function updateWalletBadge(customer) {
    if (elements.walletBadge) {
        elements.walletBadge.textContent = formatCurrency(customer.wallet_balance || 0);
    }
}

// ============================================
// GET LAST TOP-UP
// ============================================
async function getLastTopup(customerId) {
    try {
        const { data, error } = await supabase
            .from('wallet_transactions')
            .select('created_at')
            .eq('user_id', customerId)
            .eq('type', 'credit')
            .eq('status', 'completed')
            .order('created_at', { ascending: false })
            .limit(1);
        
        if (error) {
            console.warn('Could not get last top-up:', error);
            if (elements.lastTopup) elements.lastTopup.textContent = 'Never';
            return;
        }
        
        if (data && data.length > 0) {
            if (elements.lastTopup) {
                elements.lastTopup.textContent = getTimeAgo(new Date(data[0].created_at));
            }
        } else {
            if (elements.lastTopup) elements.lastTopup.textContent = 'Never';
        }
    } catch (error) {
        console.warn('Error getting last top-up:', error);
        if (elements.lastTopup) elements.lastTopup.textContent = 'Never';
    }
}

// ============================================
// LOAD RECENT ACTIVITY
// ============================================
async function loadRecentActivity() {
    try {
        const user = currentUser;
        const userId = user.id;
        
        // Get payments
        const { data: payments, error: paymentsError } = await supabase
            .from('payments')
            .select('amount, method, status, created_at, reference')
            .eq('customer_id', userId)
            .order('created_at', { ascending: false })
            .limit(5);

        if (paymentsError) {
            console.warn('Could not get payments:', paymentsError);
        }

        // Get wallet transactions
        const { data: walletTxns, error: walletError } = await supabase
            .from('wallet_transactions')
            .select('amount, type, method, status, created_at, description')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(5);

        if (walletError) {
            console.warn('Could not get wallet transactions:', walletError);
        }

        // Combine and sort activities
        const activities = [];
        
        payments?.forEach(p => {
            const statusColors = {
                'completed': 'text-green-400',
                'pending': 'text-yellow-400',
                'failed': 'text-red-400',
                'refunded': 'text-gray-400'
            };
            const statusIcons = {
                'completed': 'fa-check-circle',
                'pending': 'fa-clock',
                'failed': 'fa-times-circle',
                'refunded': 'fa-undo'
            };
            const color = statusColors[p.status] || 'text-gray-400';
            const icon = statusIcons[p.status] || 'fa-circle';

            activities.push({
                type: 'payment',
                icon: icon,
                color: color,
                bg: 'bg-white/5',
                title: `${p.method?.toUpperCase() || 'Payment'}`,
                description: `Reference: ${p.reference || 'N/A'}`,
                amount: p.amount,
                status: p.status,
                time: getTimeAgo(new Date(p.created_at)),
                timestamp: p.created_at
            });
        });
        
        walletTxns?.forEach(w => {
            const isCredit = w.type === 'credit';
            const statusColors = {
                'completed': isCredit ? 'text-emerald-400' : 'text-red-400',
                'pending': 'text-yellow-400',
                'failed': 'text-red-400'
            };
            const statusIcons = {
                'completed': isCredit ? 'fa-arrow-down' : 'fa-arrow-up',
                'pending': 'fa-clock',
                'failed': 'fa-times-circle'
            };
            const color = statusColors[w.status] || 'text-gray-400';
            const icon = statusIcons[w.status] || 'fa-circle';

            activities.push({
                type: 'wallet',
                icon: icon,
                color: color,
                bg: 'bg-white/5',
                title: `${isCredit ? 'Wallet Top-up' : 'Withdrawal'}`,
                description: w.description || w.method || 'Wallet transaction',
                amount: w.amount,
                status: w.status,
                time: getTimeAgo(new Date(w.created_at)),
                timestamp: w.created_at
            });
        });
        
        // Sort by timestamp (newest first)
        activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        const recent = activities.slice(0, 10);
        
        if (!elements.recentActivity) return;
        
        if (recent.length === 0) {
            elements.recentActivity.innerHTML = `
                <div class="text-center text-gray-400 py-4">
                    <i class="fas fa-inbox text-2xl mb-2"></i>
                    <p>No recent activity</p>
                </div>
            `;
            return;
        }
        
        elements.recentActivity.innerHTML = recent.map(a => `
            <div class="flex items-center justify-between p-3 bg-white/5 rounded-lg hover:bg-white/10 transition">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 ${a.bg} rounded-lg flex items-center justify-center">
                        <i class="fas ${a.icon} ${a.color} text-xl"></i>
                    </div>
                    <div>
                        <p class="text-sm text-white font-medium">${a.title}</p>
                        <p class="text-xs text-gray-400">${a.description} • ${a.time}</p>
                    </div>
                </div>
                <div class="text-right">
                    <p class="text-sm font-bold text-white">${formatCurrency(a.amount)}</p>
                    <p class="text-xs ${a.color}">${a.status}</p>
                </div>
            </div>
        `).join('');

    } catch (error) {
        console.error('Error loading recent activity:', error);
        if (elements.recentActivity) {
            elements.recentActivity.innerHTML = `
                <div class="text-center text-gray-400 py-4">
                    <i class="fas fa-exclamation-circle text-2xl mb-2"></i>
                    <p>Could not load activity</p>
                </div>
            `;
        }
    }
}

// ============================================
// USER MENU SETUP
// ============================================
function setupUserMenu() {
    const menuBtn = elements.userMenuBtn;
    const menu = elements.userMenu;
    
    if (!menuBtn || !menu) return;
    
    menuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        menu.classList.toggle('hidden');
    });
    
    document.addEventListener('click', (e) => {
        if (!menu.contains(e.target) && !menuBtn.contains(e.target)) {
            menu.classList.add('hidden');
        }
    });
}

// ============================================
// LOGOUT SETUP
// ============================================
function setupLogout() {
    const logoutHandler = () => {
        AuthService.logout();
    };
    
    if (elements.logoutBtn) {
        elements.logoutBtn.addEventListener('click', logoutHandler);
    }
    
    if (elements.logoutBtnMobile) {
        elements.logoutBtnMobile.addEventListener('click', logoutHandler);
    }
}

// ============================================
// AUTO REFRESH
// ============================================
function startAutoRefresh() {
    if (refreshInterval) {
        clearInterval(refreshInterval);
    }
    
    refreshInterval = setInterval(() => {
        loadCustomerData();
        loadRecentActivity();
    }, 30000);
}

// ============================================
// REAL-TIME SUBSCRIPTIONS
// ============================================
function subscribeToCustomerData() {
    const user = currentUser;
    const userId = user.id;

    // Subscribe to customer data changes
    const customerChannel = supabase
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
                console.log('🔄 Customer data updated:', payload);
                loadCustomerData();
                showToast('Your account has been updated', 'info');
            }
        )
        .subscribe();

    // Subscribe to new payments
    const paymentsChannel = supabase
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
                console.log('💳 New payment received:', payload);
                showToast(`Payment of ${formatCurrency(payload.new.amount)} received!`, 'success');
                loadCustomerData();
                loadRecentActivity();
            }
        )
        .subscribe();

    // Subscribe to wallet transactions
    const walletChannel = supabase
        .channel(`wallet:${userId}`)
        .on(
            'postgres_changes',
            {
                event: 'INSERT',
                schema: 'public',
                table: 'wallet_transactions',
                filter: `user_id=eq.${userId}`
            },
            (payload) => {
                console.log('💰 Wallet transaction:', payload);
                if (payload.new.type === 'credit' && payload.new.status === 'completed') {
                    showToast(`Wallet topped up by ${formatCurrency(payload.new.amount)}`, 'success');
                }
                loadCustomerData();
                loadRecentActivity();
            }
        )
        .subscribe();

    // Clean up on page unload
    window.addEventListener('beforeunload', () => {
        customerChannel.unsubscribe();
        paymentsChannel.unsubscribe();
        walletChannel.unsubscribe();
        if (refreshInterval) {
            clearInterval(refreshInterval);
        }
    });
}

// ============================================
// PAGE NAVIGATION
// ============================================
window.navigateTo = function(page) {
    // Hide all pages
    document.querySelectorAll('.page-content').forEach(p => {
        p.classList.add('hidden');
        p.classList.remove('active');
    });

    // Show selected page
    const target = document.getElementById(`page-${page}`);
    if (target) {
        target.classList.remove('hidden');
        target.classList.add('active');
    }

    // Update sidebar links
    document.querySelectorAll('.sidebar-link').forEach(link => {
        link.classList.remove('active');
        if (link.dataset.page === page) {
            link.classList.add('active');
        }
    });

    // Close sidebar on mobile
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    if (sidebar) sidebar.classList.remove('open');
    if (overlay) overlay.classList.remove('active');
};

// ============================================
// SIDEBAR TOGGLE (Global)
// ============================================
window.toggleSidebar = function() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    if (sidebar) sidebar.classList.toggle('open');
    if (overlay) overlay.classList.toggle('active');
};

window.closeSidebar = function() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    if (sidebar) sidebar.classList.remove('open');
    if (overlay) overlay.classList.remove('active');
};

// ============================================
// INITIALIZATION
// ============================================
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 Initializing Customer Dashboard...');
    
    // Set user info
    setUserInfo();
    
    // Setup user menu
    setupUserMenu();
    
    // Setup logout
    setupLogout();
    
    // Load customer data
    await loadCustomerData();
    
    // Load recent activity
    await loadRecentActivity();
    
    // Setup real-time subscriptions
    subscribeToCustomerData();
    
    // Start auto-refresh
    startAutoRefresh();
    
    console.log('✅ Customer Dashboard ready!');
    console.log(`👤 Logged in as: ${currentUser?.email}`);
});

// Handle logout from HTML buttons
window.addEventListener('customer-logout', () => {
    AuthService.logout();
});

console.log('🚀 Orbit Networks Customer Dashboard loaded!');
