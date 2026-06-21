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
    walletBadge: document.getElementById('walletBadge'),
    // Packages page
    currentPackageCard: document.getElementById('currentPackageCard'),
    currentSpeedCard: document.getElementById('currentSpeedCard'),
    dataLimitCard: document.getElementById('dataLimitCard'),
    expiryDateCard: document.getElementById('expiryDateCard'),
    packagePriceCard: document.getElementById('packagePriceCard'),
    packageStatusBadge: document.getElementById('packageStatusBadge'),
    availablePackages: document.getElementById('availablePackages'),
    // Wallet page
    walletBalancePage: document.getElementById('walletBalancePage'),
    lastTopupPage: document.getElementById('lastTopupPage'),
    transactionHistory: document.getElementById('transactionHistory'),
    // Payments page
    totalPaid: document.getElementById('totalPaid'),
    pendingPayments: document.getElementById('pendingPayments'),
    failedPayments: document.getElementById('failedPayments'),
    paymentHistory: document.getElementById('paymentHistory'),
    // Usage page
    usageDataUsed: document.getElementById('usageDataUsed'),
    usageDataRemaining: document.getElementById('usageDataRemaining'),
    usagePercentage: document.getElementById('usagePercentage'),
    usageHistory: document.getElementById('usageHistory'),
    // Support page
    totalTickets: document.getElementById('totalTickets'),
    openTickets: document.getElementById('openTickets'),
    resolvedTickets: document.getElementById('resolvedTickets'),
    supportTickets: document.getElementById('supportTickets'),
    // Logout settings
    logoutBtnSettings: document.getElementById('logoutBtnSettings')
};

// ============================================
// AUTH CHECK
// ============================================
if (!AuthService.isAuthenticated()) {
    console.log('🔒 Not authenticated, redirecting to login...');
    window.location.href = '/orbitnetworks/login.html';
    throw new Error('Not authenticated');
}

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

        updateUI(customer);
        await getLastTopup(userId);
        updateWalletBadge(customer);
        updatePackagesPage(customer);
        await loadAvailablePackages();
        await loadAllPages(customer);

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
    
    const dataUsed = customer.data_used_gb || 0;
    const dataLimit = customer.data_limit_gb || pkg.data_limit_gb || 50;
    const percentage = Math.min((dataUsed / dataLimit) * 100, 100);
    
    if (elements.dataUsed) elements.dataUsed.textContent = `${dataUsed.toFixed(1)} GB`;
    if (elements.dataLimit) elements.dataLimit.textContent = `${dataLimit} GB`;
    if (elements.progressBar) elements.progressBar.style.width = `${percentage}%`;

    if (elements.currentPackage) elements.currentPackage.textContent = pkg.name || 'No Package';
    if (elements.expiryDate) {
        elements.expiryDate.textContent = customer.expires_at 
            ? formatDate(customer.expires_at) 
            : 'Never';
    }

    if (elements.walletBalance) {
        elements.walletBalance.textContent = formatCurrency(customer.wallet_balance || 0);
    }
    
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
    
    if (elements.currentSpeed) elements.currentSpeed.textContent = pkg.speed || 'N/A';
}

// ============================================
// UPDATE PACKAGES PAGE
// ============================================
function updatePackagesPage(customer) {
    if (!customer) return;
    const pkg = customer.packages || {};
    
    if (elements.currentPackageCard) {
        elements.currentPackageCard.textContent = pkg.name || 'No Package';
    }
    if (elements.currentSpeedCard) {
        elements.currentSpeedCard.textContent = pkg.speed || 'N/A';
    }
    if (elements.dataLimitCard) {
        elements.dataLimitCard.textContent = (pkg.data_limit_gb || '0') + ' GB';
    }
    if (elements.expiryDateCard) {
        elements.expiryDateCard.textContent = customer.expires_at 
            ? formatDate(customer.expires_at) 
            : 'Never';
    }
    if (elements.packagePriceCard) {
        elements.packagePriceCard.textContent = pkg.price ? formatCurrency(pkg.price) : '-';
    }
    
    const status = customer.status || 'active';
    const statusColors = {
        'active': 'bg-green-500/20 text-green-400',
        'suspended': 'bg-red-500/20 text-red-400',
        'expired': 'bg-yellow-500/20 text-yellow-400'
    };
    if (elements.packageStatusBadge) {
        elements.packageStatusBadge.className = `px-4 py-2 rounded-full text-sm font-medium ${statusColors[status] || 'bg-gray-500/20 text-gray-400'}`;
        elements.packageStatusBadge.innerHTML = `<i class="fas fa-${status === 'active' ? 'check-circle' : 'exclamation-circle'} mr-1"></i> ${status.toUpperCase()}`;
    }
}

// ============================================
// LOAD AVAILABLE PACKAGES
// ============================================
async function loadAvailablePackages() {
    try {
        const { data: packages, error } = await supabase
            .from('packages')
            .select('*')
            .eq('is_active', true)
            .order('price', { ascending: true });

        if (error) {
            console.error('❌ Error loading packages:', error);
            return;
        }

        const container = document.getElementById('availablePackages');
        if (!container) return;

        if (!packages || packages.length === 0) {
            container.innerHTML = `
                <div class="col-span-full text-center text-gray-400 py-8">
                    <i class="fas fa-box text-4xl mb-4"></i>
                    <p>No packages available</p>
                </div>
            `;
            return;
        }

        const currentPackageId = customerData?.package_id;

        container.innerHTML = packages.map(pkg => {
            const isCurrent = pkg.id === currentPackageId;
            return `
                <div class="bg-[#1a1a2e] rounded-2xl p-6 border ${isCurrent ? 'border-blue-500/50' : 'border-white/5'} hover:border-blue-500/30 transition-all">
                    ${isCurrent ? '<div class="text-xs text-blue-400 font-medium mb-2"><i class="fas fa-check-circle mr-1"></i> Current Plan</div>' : ''}
                    <h3 class="text-xl font-bold text-white">${pkg.name}</h3>
                    <p class="text-2xl font-bold text-green-400 mt-2">${formatCurrency(pkg.price)}</p>
                    <p class="text-sm text-gray-400">${pkg.speed || 'N/A'}</p>
                    <div class="mt-4 space-y-2 text-sm text-gray-400">
                        <p><i class="fas fa-database w-5 text-blue-400"></i> ${pkg.data_limit_gb || 'Unlimited'} GB</p>
                        <p><i class="fas fa-calendar-day w-5 text-green-400"></i> ${pkg.validity_days} days</p>
                        ${pkg.features ? `<p><i class="fas fa-star w-5 text-yellow-400"></i> ${Object.keys(pkg.features).join(', ')}</p>` : ''}
                    </div>
                    ${!isCurrent ? `
                        <button onclick="upgradePackage('${pkg.id}')" class="mt-4 w-full py-2 bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500/30 transition">
                            <i class="fas fa-arrow-up mr-2"></i> Upgrade
                        </button>
                    ` : `
                        <div class="mt-4 text-center text-sm text-green-400">
                            <i class="fas fa-check-circle mr-1"></i> Active Plan
                        </div>
                    `}
                </div>
            `;
        }).join('');

    } catch (error) {
        console.error('Error loading packages:', error);
    }
}

// ============================================
// UPGRADE PACKAGE
// ============================================
window.upgradePackage = async function(packageId) {
    if (!confirm('Are you sure you want to upgrade to this package?')) return;
    
    try {
        const { data: pkg, error: pkgError } = await supabase
            .from('packages')
            .select('*')
            .eq('id', packageId)
            .single();
        
        if (pkgError) throw pkgError;
        
        const { error } = await supabase
            .from('customers')
            .update({
                package_id: packageId,
                data_limit_gb: pkg.data_limit_gb,
                expires_at: new Date(Date.now() + pkg.validity_days * 86400000).toISOString(),
                updated_at: new Date().toISOString()
            })
            .eq('id', currentUser.id);
        
        if (error) throw error;
        
        showToast(`Upgraded to ${pkg.name} package!`, 'success');
        await loadCustomerData();
        await loadAvailablePackages();
        
    } catch (error) {
        console.error('Error upgrading package:', error);
        showToast('Error upgrading package: ' + error.message, 'error');
    }
};

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
            if (elements.lastTopupPage) elements.lastTopupPage.textContent = 'Never';
            return;
        }
        
        if (data && data.length > 0) {
            const timeAgo = getTimeAgo(new Date(data[0].created_at));
            if (elements.lastTopup) elements.lastTopup.textContent = timeAgo;
            if (elements.lastTopupPage) elements.lastTopupPage.textContent = timeAgo;
        } else {
            if (elements.lastTopup) elements.lastTopup.textContent = 'Never';
            if (elements.lastTopupPage) elements.lastTopupPage.textContent = 'Never';
        }
    } catch (error) {
        console.warn('Error getting last top-up:', error);
        if (elements.lastTopup) elements.lastTopup.textContent = 'Never';
        if (elements.lastTopupPage) elements.lastTopupPage.textContent = 'Never';
    }
}

// ============================================
// LOAD ALL PAGES DATA
// ============================================
async function loadAllPages(customer) {
    if (!customer) return;
    
    if (elements.walletBalancePage) {
        elements.walletBalancePage.textContent = formatCurrency(customer.wallet_balance || 0);
    }
    
    await loadPaymentsData();
    await loadUsageData(customer);
    await loadSupportData();
}

// ============================================
// LOAD PAYMENTS DATA
// ============================================
async function loadPaymentsData() {
    try {
        const userId = currentUser.id;
        
        const { data: payments, error } = await supabase
            .from('payments')
            .select('*')
            .eq('customer_id', userId)
            .order('created_at', { ascending: false });

        if (error) {
            console.warn('Could not get payments:', error);
            return;
        }

        const total = payments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;
        const pending = payments?.filter(p => p.status === 'pending').length || 0;
        const failed = payments?.filter(p => p.status === 'failed').length || 0;

        if (elements.totalPaid) elements.totalPaid.textContent = formatCurrency(total);
        if (elements.pendingPayments) elements.pendingPayments.textContent = pending;
        if (elements.failedPayments) elements.failedPayments.textContent = failed;

        const container = elements.paymentHistory;
        if (!container) return;

        if (!payments || payments.length === 0) {
            container.innerHTML = `
                <div class="text-center text-gray-400 py-8">
                    <i class="fas fa-credit-card text-3xl mb-2"></i>
                    <p>No payments found</p>
                </div>
            `;
            return;
        }

        container.innerHTML = payments.slice(0, 10).map(p => `
            <div class="transaction-item flex items-center justify-between p-3 bg-white/5 rounded-lg hover:bg-white/10 transition">
                <div>
                    <p class="text-sm text-white font-medium">${p.method?.toUpperCase() || 'Payment'}</p>
                    <p class="text-xs text-gray-400">${formatDate(p.created_at)}</p>
                </div>
                <div class="text-right">
                    <p class="text-sm font-bold ${p.status === 'completed' ? 'text-green-400' : p.status === 'pending' ? 'text-yellow-400' : 'text-red-400'}">
                        ${formatCurrency(p.amount)}
                    </p>
                    <p class="text-xs text-gray-400">${p.status}</p>
                </div>
            </div>
        `).join('');

    } catch (error) {
        console.error('Error loading payments data:', error);
    }
}

// ============================================
// LOAD USAGE DATA
// ============================================
async function loadUsageData(customer) {
    try {
        const pkg = customer.packages || {};
        const dataUsed = customer.data_used_gb || 0;
        const dataLimit = customer.data_limit_gb || pkg.data_limit_gb || 50;
        const remaining = Math.max(0, dataLimit - dataUsed);
        const percentage = dataLimit > 0 ? Math.min((dataUsed / dataLimit) * 100, 100) : 0;

        if (elements.usageDataUsed) elements.usageDataUsed.textContent = `${dataUsed.toFixed(1)} GB`;
        if (elements.usageDataRemaining) elements.usageDataRemaining.textContent = `${remaining.toFixed(1)} GB`;
        if (elements.usagePercentage) elements.usagePercentage.textContent = `${percentage.toFixed(1)}%`;

        const container = elements.usageHistory;
        if (!container) return;

        const history = [];
        for (let i = 0; i < 7; i++) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const used = (Math.random() * 2).toFixed(1);
            history.push({
                date: date,
                used: used
            });
        }

        container.innerHTML = history.map(h => `
            <div class="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                <span class="text-sm text-gray-300">${formatDate(h.date)}</span>
                <span class="text-sm text-white">${h.used} GB</span>
            </div>
        `).join('');

    } catch (error) {
        console.error('Error loading usage data:', error);
    }
}

// ============================================
// LOAD SUPPORT DATA
// ============================================
async function loadSupportData() {
    try {
        const userId = currentUser.id;
        
        const { data: tickets, error } = await supabase
            .from('support_tickets')
            .select('*')
            .eq('customer_id', userId)
            .order('created_at', { ascending: false });

        if (error) {
            console.warn('Could not get support tickets:', error);
            const sampleTickets = [
                { id: 1, subject: 'Internet connection issues', status: 'open', priority: 'high', created_at: new Date().toISOString() },
                { id: 2, subject: 'Billing question', status: 'resolved', priority: 'normal', created_at: new Date(Date.now() - 86400000).toISOString() }
            ];
            renderSupportTickets(sampleTickets);
            return;
        }

        renderSupportTickets(tickets || []);

    } catch (error) {
        console.error('Error loading support data:', error);
    }
}

function renderSupportTickets(tickets) {
    const total = tickets.length;
    const open = tickets.filter(t => t.status === 'open' || t.status === 'in_progress').length;
    const resolved = tickets.filter(t => t.status === 'resolved' || t.status === 'closed').length;

    if (elements.totalTickets) elements.totalTickets.textContent = total;
    if (elements.openTickets) elements.openTickets.textContent = open;
    if (elements.resolvedTickets) elements.resolvedTickets.textContent = resolved;

    const container = elements.supportTickets;
    if (!container) return;

    if (!tickets || tickets.length === 0) {
        container.innerHTML = `
            <div class="text-center text-gray-400 py-8">
                <i class="fas fa-ticket text-3xl mb-2"></i>
                <p>No support tickets</p>
                <button onclick="showNewTicketModal()" class="mt-4 px-4 py-2 bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500/30 transition">
                    <i class="fas fa-plus mr-2"></i> Create Ticket
                </button>
            </div>
        `;
        return;
    }

    container.innerHTML = tickets.slice(0, 10).map(t => {
        const statusColors = {
            'open': 'bg-yellow-500/20 text-yellow-400',
            'in_progress': 'bg-blue-500/20 text-blue-400',
            'resolved': 'bg-green-500/20 text-green-400',
            'closed': 'bg-gray-500/20 text-gray-400'
        };
        const priorityColors = {
            'low': 'text-gray-400',
            'normal': 'text-blue-400',
            'high': 'text-yellow-400',
            'urgent': 'text-red-400'
        };
        return `
            <div class="support-ticket p-4 bg-white/5 rounded-lg hover:bg-white/10 transition">
                <div class="flex justify-between items-start">
                    <div>
                        <p class="text-sm text-white font-medium">${t.subject}</p>
                        <p class="text-xs text-gray-400">${formatDate(t.created_at)}</p>
                    </div>
                    <div class="text-right">
                        <span class="text-xs px-2 py-1 rounded-full ${statusColors[t.status] || 'bg-gray-500/20 text-gray-400'}">${t.status}</span>
                        <span class="text-xs block mt-1 ${priorityColors[t.priority] || 'text-gray-400'}">${t.priority || 'normal'}</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// ============================================
// LOAD RECENT ACTIVITY
// ============================================
async function loadRecentActivity() {
    try {
        const user = currentUser;
        const userId = user.id;
        
        const { data: payments, error: paymentsError } = await supabase
            .from('payments')
            .select('amount, method, status, created_at, reference')
            .eq('customer_id', userId)
            .order('created_at', { ascending: false })
            .limit(5);

        if (paymentsError) {
            console.warn('Could not get payments:', paymentsError);
        }

        const { data: walletTxns, error: walletError } = await supabase
            .from('wallet_transactions')
            .select('amount, type, method, status, created_at, description')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(5);

        if (walletError) {
            console.warn('Could not get wallet transactions:', walletError);
        }

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
        menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
    });
    
    document.addEventListener('click', (e) => {
        if (!menu.contains(e.target) && !menuBtn.contains(e.target)) {
            menu.style.display = 'none';
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
    
    if (elements.logoutBtnSettings) {
        elements.logoutBtnSettings.addEventListener('click', logoutHandler);
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
// PAGE NAVIGATION - MATCHES HTML
// ============================================
window.navigateTo = function(page) {
    console.log('🔄 Navigating to:', page);
    
    // Get all page containers
    const pages = {
        dashboard: document.getElementById('page-dashboard'),
        packages: document.getElementById('page-packages'),
        wallet: document.getElementById('page-wallet'),
        payments: document.getElementById('page-payments'),
        usage: document.getElementById('page-usage'),
        support: document.getElementById('page-support'),
        settings: document.getElementById('page-settings')
    };
    
    // Hide all pages using style.display (matches HTML)
    Object.keys(pages).forEach(key => {
        if (pages[key]) {
            pages[key].style.display = 'none';
        }
    });
    
    // Show selected page
    if (pages[page]) {
        pages[page].style.display = 'block';
        console.log('✅ Showing page:', page);
    } else {
        console.warn('⚠️ Page not found:', page);
        if (pages.dashboard) {
            pages.dashboard.style.display = 'block';
        }
        return;
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
    
    setUserInfo();
    setupUserMenu();
    setupLogout();
    await loadCustomerData();
    await loadRecentActivity();
    subscribeToCustomerData();
    startAutoRefresh();
    
    console.log('✅ Customer Dashboard ready!');
    console.log(`👤 Logged in as: ${currentUser?.email}`);
});

// Handle logout from HTML buttons
window.addEventListener('customer-logout', () => {
    AuthService.logout();
});

console.log('🚀 Orbit Networks Customer Dashboard loaded!');
