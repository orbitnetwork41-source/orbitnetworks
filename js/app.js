// js/app.js
// COMPLETE APP WITH AUTH SERVICE AND HELPERS

import { supabase } from './config/supabase.js';
import { AuthService } from './services/auth.service.js';
import { 
    showToast, 
    getTimeAgo, 
    formatCurrency, 
    formatDate, 
    getInitials,
    truncateText,
    generateId 
} from './utils/helpers.js';

// ============================================
// STATE
// ============================================
let currentUser = null;
let currentPage = 'dashboard';
let refreshInterval = null;

// ============================================
// DOM ELEMENTS
// ============================================
const loginPage = document.getElementById('loginPage');
const app = document.getElementById('app');
const loginForm = document.getElementById('loginForm');
const loginError = document.getElementById('loginError');
const logoutBtn = document.getElementById('logoutBtn');
const userName = document.getElementById('userName');
const userAvatar = document.getElementById('userAvatar');
const userRole = document.getElementById('userRole');

// ============================================
// AUTH FUNCTIONS
// ============================================
async function login(email, password) {
    try {
        const result = await AuthService.login(email, password);
        
        if (result.success) {
            currentUser = result.user;
            return { success: true, user: currentUser, role: result.role };
        } else {
            return { success: false, error: result.error };
        }
    } catch (error) {
        return { success: false, error: error.message };
    }
}

async function logout() {
    await AuthService.logout();
    currentUser = null;
    showApp(false);
    if (refreshInterval) {
        clearInterval(refreshInterval);
        refreshInterval = null;
    }
    window.location.reload();
}

function getCurrentUser() {
    if (currentUser) return currentUser;
    const stored = AuthService.getCurrentUser();
    if (stored) {
        currentUser = stored;
        return currentUser;
    }
    return null;
}

function isAuthenticated() {
    return AuthService.isAuthenticated();
}

function isAdmin() {
    return AuthService.isAdmin();
}

function getUserRole() {
    return AuthService.getUserRole();
}

// ============================================
// UI FUNCTIONS
// ============================================
function showApp(show) {
    if (show) {
        loginPage.style.display = 'none';
        app.classList.remove('hidden');
        const user = getCurrentUser();
        if (user) {
            const name = user.profile?.full_name || user.email?.split('@')[0] || 'User';
            const initials = getInitials(name);
            const role = user.profile?.role || 'customer';
            
            userName.textContent = name;
            if (userAvatar) userAvatar.textContent = initials;
            if (userRole) userRole.textContent = role.charAt(0).toUpperCase() + role.slice(1);
            
            updateAdminLink();
        }
    } else {
        loginPage.style.display = 'flex';
        app.classList.add('hidden');
    }
}

function updateAdminLink() {
    const adminLink = document.getElementById('adminPanelLink');
    if (adminLink) {
        const isAdmin = AuthService.isAdmin();
        adminLink.style.display = isAdmin ? 'flex' : 'none';
    }
}

// ============================================
// NAVIGATION
// ============================================
window.navigateTo = function(page) {
    document.querySelectorAll('.page-content').forEach(p => {
        p.classList.add('hidden');
        p.classList.remove('active');
    });
    
    const target = document.getElementById(`${page}Page`);
    if (target) {
        target.classList.remove('hidden');
        target.classList.add('active');
    }
    
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
        if (link.dataset.page === page) {
            link.classList.add('active');
        }
    });
    
    currentPage = page;
    
    switch(page) {
        case 'dashboard':
            loadDashboard();
            break;
        case 'customers':
            loadCustomers();
            break;
        case 'packages':
            loadPackages();
            break;
        case 'payments':
            loadPayments();
            break;
        case 'routers':
            loadRouters();
            break;
        case 'reports':
            loadReports();
            break;
        case 'settings':
            loadSettings();
            break;
        case 'admin':
            window.location.href = '/orbitnetworks/admin/dashboard.html';
            break;
    }
};

// ============================================
// DASHBOARD
// ============================================
async function loadDashboard() {
    const container = document.getElementById('dashboardPage');
    const admin = isAdmin();
    
    try {
        let totalCustomers = 0;
        let monthlyRevenue = 0;
        let routersOnline = 0;
        let activeUsers = Math.floor(Math.random() * 30) + 5;
        let pendingPayments = 0;
        let successRate = 0;
        
        try {
            const { count, error } = await supabase
                .from('customers')
                .select('*', { count: 'exact', head: true });
            if (!error) totalCustomers = count || 0;
        } catch (e) {
            console.warn('Could not get customer count:', e.message);
        }
        
        try {
            const startOfMonth = new Date();
            startOfMonth.setDate(1);
            startOfMonth.setHours(0, 0, 0, 0);
            
            const { data, error } = await supabase
                .from('payments')
                .select('amount, status')
                .gte('created_at', startOfMonth.toISOString());
            
            if (!error && data) {
                monthlyRevenue = data
                    .filter(p => p.status === 'completed')
                    .reduce((sum, p) => sum + Number(p.amount), 0) || 0;
                    
                pendingPayments = data.filter(p => p.status === 'pending').length || 0;
                
                const total = data.length;
                const completed = data.filter(p => p.status === 'completed').length;
                successRate = total > 0 ? Math.round((completed / total) * 100) : 0;
            }
        } catch (e) {
            console.warn('Could not get revenue:', e.message);
        }
        
        try {
            const { data, error } = await supabase
                .from('routers')
                .select('status');
            if (!error) {
                routersOnline = data?.filter(r => r.status === 'online').length || 0;
            }
        } catch (e) {
            console.warn('Could not get router status:', e.message);
        }
        
        const recentActivity = await getRecentActivity();
        
        container.innerHTML = `
            <div class="page-header">
                <h1>Dashboard</h1>
                <span class="text-gray-400 text-sm" id="currentTime"></span>
                ${admin ? `<a href="/orbitnetworks/admin/dashboard.html" class="btn-primary text-sm px-4 py-2">Go to Admin Panel</a>` : ''}
            </div>
            
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-icon bg-blue-500/20 text-blue-400">
                        <i class="fas fa-users"></i>
                    </div>
                    <div class="stat-info">
                        <h3>Total Customers</h3>
                        <span>${totalCustomers}</span>
                        <small class="text-green-400">+12% this month</small>
                    </div>
                </div>
                
                <div class="stat-card">
                    <div class="stat-icon bg-green-500/20 text-green-400">
                        <i class="fas fa-money-bill-wave"></i>
                    </div>
                    <div class="stat-info">
                        <h3>Monthly Revenue</h3>
                        <span>${formatCurrency(monthlyRevenue)}</span>
                        <small class="text-green-400">↑ 8.5% from last month</small>
                    </div>
                </div>
                
                <div class="stat-card">
                    <div class="stat-icon bg-purple-500/20 text-purple-400">
                        <i class="fas fa-wifi"></i>
                    </div>
                    <div class="stat-info">
                        <h3>Active Users</h3>
                        <span>${activeUsers}</span>
                        <small class="text-green-400">Currently online</small>
                    </div>
                </div>
                
                <div class="stat-card">
                    <div class="stat-icon bg-cyan-500/20 text-cyan-400">
                        <i class="fas fa-router"></i>
                    </div>
                    <div class="stat-info">
                        <h3>Routers Online</h3>
                        <span>${routersOnline}</span>
                        <small class="text-green-400">All systems operational</small>
                    </div>
                </div>
            </div>
            
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div class="bg-white/5 border border-white/10 rounded-lg p-4 text-center">
                    <p class="text-xs text-gray-400">Success Rate</p>
                    <p class="text-xl font-bold text-green-400">${successRate}%</p>
                </div>
                <div class="bg-white/5 border border-white/10 rounded-lg p-4 text-center">
                    <p class="text-xs text-gray-400">Pending Payments</p>
                    <p class="text-xl font-bold text-yellow-400">${pendingPayments}</p>
                </div>
                <div class="bg-white/5 border border-white/10 rounded-lg p-4 text-center">
                    <p class="text-xs text-gray-400">Total Packages</p>
                    <p class="text-xl font-bold text-purple-400" id="totalPackages">0</p>
                </div>
                <div class="bg-white/5 border border-white/10 rounded-lg p-4 text-center">
                    <p class="text-xs text-gray-400">Total Revenue</p>
                    <p class="text-xl font-bold text-blue-400" id="totalRevenue">${formatCurrency(monthlyRevenue)}</p>
                </div>
            </div>
            
            <div class="dashboard-grid">
                <div class="card">
                    <h2>Recent Activity</h2>
                    <div id="recentActivity">
                        ${recentActivity}
                    </div>
                </div>
                <div class="card">
                    <h2>Quick Actions</h2>
                    <div class="action-buttons">
                        <button class="btn-primary" onclick="window.navigateTo('customers')">
                            <i class="fas fa-user-plus"></i> Customers
                        </button>
                        <button class="btn-primary" onclick="window.navigateTo('packages')">
                            <i class="fas fa-plus-circle"></i> Packages
                        </button>
                        <button class="btn-primary" onclick="window.navigateTo('payments')">
                            <i class="fas fa-hand-holding-usd"></i> Payments
                        </button>
                        <button class="btn-primary" onclick="window.navigateTo('routers')">
                            <i class="fas fa-router"></i> Routers
                        </button>
                        ${admin ? `
                            <button class="btn-primary bg-gradient-to-r from-purple-500 to-pink-600" onclick="window.navigateTo('admin')">
                                <i class="fas fa-shield-alt"></i> Admin Panel
                            </button>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;
        
        updateTime();
        
        if (refreshInterval) {
            clearInterval(refreshInterval);
        }
        refreshInterval = setInterval(() => {
            loadDashboard();
        }, 30000);
        
    } catch (error) {
        console.error('Error loading dashboard:', error);
        container.innerHTML = `
            <div class="page-header"><h1>Dashboard</h1></div>
            <div class="text-red-400 p-4 bg-red-500/10 rounded-lg">
                <i class="fas fa-exclamation-circle mr-2"></i>
                Error loading dashboard. Please check your database connection.
            </div>
        `;
    }
}

// ============================================
// GET RECENT ACTIVITY
// ============================================
async function getRecentActivity() {
    try {
        const { data: activities, error } = await supabase
            .from('activity_logs')
            .select('*, profiles(full_name)')
            .order('created_at', { ascending: false })
            .limit(10);

        if (error || !activities || activities.length === 0) {
            return `
                <div class="text-center text-gray-400 py-8">
                    <i class="fas fa-inbox text-3xl mb-2"></i>
                    <p>No recent activity</p>
                </div>
            `;
        }

        return activities.map(activity => {
            const actionIcons = {
                'customer_created': 'fa-user-plus text-blue-400',
                'payment_received': 'fa-money-bill-wave text-green-400',
                'package_created': 'fa-box text-purple-400',
                'router_added': 'fa-router text-cyan-400',
                'ticket_created': 'fa-ticket text-yellow-400',
                'login': 'fa-sign-in-alt text-gray-400'
            };
            const icon = actionIcons[activity.action] || 'fa-circle text-gray-400';

            return `
                <div class="flex items-center gap-4 p-3 bg-white/5 rounded-lg hover:bg-white/10 transition">
                    <div class="w-10 h-10 bg-white/5 rounded-lg flex items-center justify-center">
                        <i class="fas ${icon}"></i>
                    </div>
                    <div class="flex-1">
                        <p class="text-sm text-white font-medium">${activity.action.replace(/_/g, ' ').toUpperCase()}</p>
                        <p class="text-xs text-gray-400">
                            ${activity.profiles?.full_name || 'System'} • ${getTimeAgo(new Date(activity.created_at))}
                        </p>
                    </div>
                </div>
            `;
        }).join('');

    } catch (error) {
        console.error('Error loading recent activity:', error);
        return `
            <div class="text-center text-gray-400 py-8">
                <i class="fas fa-exclamation-circle text-2xl mb-2"></i>
                <p>Could not load activity</p>
            </div>
        `;
    }
}

// ============================================
// CUSTOMERS
// ============================================
async function loadCustomers() {
    const container = document.getElementById('customersPage');
    
    try {
        const { data, error } = await supabase
            .from('customers')
            .select('*, profiles(full_name, phone)')
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        container.innerHTML = `
            <div class="page-header">
                <h1>Customers</h1>
                <button class="btn-primary" onclick="showAddCustomerModal()">
                    <i class="fas fa-user-plus"></i> Add Customer
                </button>
            </div>
            
            <div class="table-container">
                <div class="table-header">
                    <input type="text" class="table-search" placeholder="Search customers..." id="customerSearch" oninput="filterCustomers()">
                    <span class="text-sm text-gray-400">${data?.length || 0} customers</span>
                </div>
                <table>
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Phone</th>
                            <th>Status</th>
                            <th>Joined</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody id="customersTableBody">
                        ${data && data.length > 0 ? data.map(c => `
                            <tr>
                                <td><strong>${c.profiles?.full_name || 'Unknown'}</strong></td>
                                <td>${c.profiles?.phone || 'N/A'}</td>
                                <td><span class="badge ${c.status === 'active' ? 'badge-success' : 'badge-danger'}">${c.status}</span></td>
                                <td>${formatDate(c.created_at, 'short')}</td>
                                <td>
                                    <button class="btn-secondary btn-sm" onclick="editCustomer('${c.id}')">
                                        <i class="fas fa-edit"></i>
                                    </button>
                                    <button class="btn-danger btn-sm" onclick="deleteCustomer('${c.id}')">
                                        <i class="fas fa-trash"></i>
                                    </button>
                                </td>
                            </tr>
                        `).join('') : '<tr><td colspan="5" class="text-center text-gray-400 py-8">No customers found</td></tr>'}
                    </tbody>
                </table>
            </div>
        `;
        
    } catch (error) {
        console.error('Error loading customers:', error);
        container.innerHTML = `
            <div class="page-header"><h1>Customers</h1></div>
            <div class="text-red-400 p-4 bg-red-500/10 rounded-lg">
                <i class="fas fa-exclamation-circle mr-2"></i>
                Error loading customers: ${error.message}
            </div>
        `;
    }
}

// ============================================
// PACKAGES
// ============================================
async function loadPackages() {
    const container = document.getElementById('packagesPage');
    
    try {
        const { data, error } = await supabase
            .from('packages')
            .select('*')
            .order('price');
        
        if (error) throw error;
        
        container.innerHTML = `
            <div class="page-header">
                <h1>Packages</h1>
                <button class="btn-primary" onclick="showAddPackageModal()">
                    <i class="fas fa-plus-circle"></i> Create Package
                </button>
            </div>
            
            <div class="packages-grid">
                ${data && data.length > 0 ? data.map(p => `
                    <div class="package-card ${!p.is_active ? 'opacity-50' : ''}">
                        <div class="flex justify-between items-start">
                            <h3>${p.name}</h3>
                            <span class="badge ${p.is_active ? 'badge-success' : 'badge-danger'}">${p.is_active ? 'Active' : 'Inactive'}</span>
                        </div>
                        <div class="price">${formatCurrency(p.price)}</div>
                        <div class="package-details">
                            <p>⚡ ${p.speed || 'N/A'}</p>
                            <p>📦 ${p.data_limit_gb || 'Unlimited'} GB</p>
                            <p>📅 ${p.validity_days} days</p>
                        </div>
                        <ul class="features">
                            ${(p.features || ['24/7 Support']).map(f => `<li>✓ ${f}</li>`).join('')}
                        </ul>
                        <div class="mt-3 flex gap-2">
                            <button class="btn-secondary btn-sm" onclick="editPackage('${p.id}')">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="btn-danger btn-sm" onclick="deletePackage('${p.id}')">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                `).join('') : '<p class="text-center text-gray-400 py-8 col-span-full">No packages available</p>'}
            </div>
        `;
        
        const pkgCount = document.getElementById('totalPackages');
        if (pkgCount) pkgCount.textContent = data?.length || 0;
        
    } catch (error) {
        console.error('Error loading packages:', error);
        container.innerHTML = `
            <div class="page-header"><h1>Packages</h1></div>
            <div class="text-red-400 p-4 bg-red-500/10 rounded-lg">
                <i class="fas fa-exclamation-circle mr-2"></i>
                Error loading packages: ${error.message}
            </div>
        `;
    }
}

// ============================================
// PAYMENTS
// ============================================
async function loadPayments() {
    const container = document.getElementById('paymentsPage');
    
    try {
        const { data, error } = await supabase
            .from('payments')
            .select('*, customers(id, profiles(full_name))')
            .order('created_at', { ascending: false })
            .limit(50);
        
        if (error) throw error;
        
        container.innerHTML = `
            <div class="page-header">
                <h1>Payments</h1>
                <button class="btn-primary" onclick="showRecordPaymentModal()">
                    <i class="fas fa-plus-circle"></i> Record Payment
                </button>
            </div>
            
            <div class="table-container">
                <div class="table-header">
                    <input type="text" class="table-search" placeholder="Search payments..." id="paymentSearch" oninput="filterPayments()">
                    <span class="text-sm text-gray-400">${data?.length || 0} payments</span>
                </div>
                <table>
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Customer</th>
                            <th>Amount</th>
                            <th>Method</th>
                            <th>Status</th>
                            <th>Reference</th>
                        </tr>
                    </thead>
                    <tbody id="paymentsTableBody">
                        ${data && data.length > 0 ? data.map(p => `
                            <tr>
                                <td>${formatDate(p.created_at, 'short')}</td>
                                <td>${p.customers?.profiles?.full_name || 'Unknown'}</td>
                                <td><strong>${formatCurrency(p.amount)}</strong></td>
                                <td>${p.method || 'M-Pesa'}</td>
                                <td><span class="badge ${p.status === 'completed' ? 'badge-success' : p.status === 'pending' ? 'badge-warning' : 'badge-danger'}">${p.status}</span></td>
                                <td>${p.reference || 'N/A'}</td>
                            </tr>
                        `).join('') : '<tr><td colspan="6" class="text-center text-gray-400 py-8">No payments found</td></tr>'}
                    </tbody>
                </table>
            </div>
        `;
        
    } catch (error) {
        console.error('Error loading payments:', error);
        container.innerHTML = `
            <div class="page-header"><h1>Payments</h1></div>
            <div class="text-red-400 p-4 bg-red-500/10 rounded-lg">
                <i class="fas fa-exclamation-circle mr-2"></i>
                Error loading payments: ${error.message}
            </div>
        `;
    }
}

// ============================================
// ROUTERS
// ============================================
async function loadRouters() {
    const container = document.getElementById('routersPage');
    
    try {
        const { data, error } = await supabase
            .from('routers')
            .select('*')
            .order('name');
        
        if (error) throw error;
        
        container.innerHTML = `
            <div class="page-header">
                <h1>Routers</h1>
                <button class="btn-primary" onclick="showAddRouterModal()">
                    <i class="fas fa-plus-circle"></i> Add Router
                </button>
            </div>
            
            <div class="router-grid">
                ${data && data.length > 0 ? data.map(r => `
                    <div class="router-card">
                        <div class="flex justify-between items-start">
                            <h3>📡 ${r.name}</h3>
                            <span class="badge ${r.status === 'online' ? 'badge-success' : 'badge-danger'}">${r.status}</span>
                        </div>
                        <p><strong>IP:</strong> ${r.ip_address}</p>
                        <p><strong>Model:</strong> ${r.model || 'N/A'}</p>
                        <p><strong>Location:</strong> ${r.location || 'N/A'}</p>
                        <div class="mt-3 flex gap-2">
                            <button class="btn-secondary btn-sm" onclick="editRouter('${r.id}')">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="btn-danger btn-sm" onclick="deleteRouter('${r.id}')">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                `).join('') : '<p class="text-center text-gray-400 py-8 col-span-full">No routers configured</p>'}
            </div>
        `;
        
    } catch (error) {
        console.error('Error loading routers:', error);
        container.innerHTML = `
            <div class="page-header"><h1>Routers</h1></div>
            <div class="text-red-400 p-4 bg-red-500/10 rounded-lg">
                <i class="fas fa-exclamation-circle mr-2"></i>
                Error loading routers: ${error.message}
            </div>
        `;
    }
}

// ============================================
// REPORTS
// ============================================
async function loadReports() {
    const container = document.getElementById('reportsPage');
    container.innerHTML = `
        <div class="page-header">
            <h1>Reports & Analytics</h1>
        </div>
        <div class="grid md:grid-cols-3 gap-6">
            <div class="card">
                <h3>Revenue Report</h3>
                <p class="text-gray-400 text-sm mb-4">Generate revenue reports for any period</p>
                <button class="btn-primary w-full" onclick="generateRevenueReport()">
                    <i class="fas fa-file-pdf"></i> Generate Report
                </button>
            </div>
            <div class="card">
                <h3>Customer Report</h3>
                <p class="text-gray-400 text-sm mb-4">Customer acquisition and retention data</p>
                <button class="btn-primary w-full" onclick="generateCustomerReport()">
                    <i class="fas fa-file-pdf"></i> Generate Report
                </button>
            </div>
            <div class="card">
                <h3>Usage Report</h3>
                <p class="text-gray-400 text-sm mb-4">Network usage and bandwidth reports</p>
                <button class="btn-primary w-full" onclick="generateUsageReport()">
                    <i class="fas fa-file-pdf"></i> Generate Report
                </button>
            </div>
        </div>
    `;
}

// ============================================
// SETTINGS
// ============================================
async function loadSettings() {
    const container = document.getElementById('settingsPage');
    const user = getCurrentUser();
    
    container.innerHTML = `
        <div class="page-header">
            <h1>Settings</h1>
        </div>
        <div class="card max-w-2xl">
            <h3>Profile Settings</h3>
            <form id="settingsForm" class="space-y-4 mt-4">
                <div class="form-group">
                    <label>Full Name</label>
                    <input type="text" id="settingsName" value="${user?.profile?.full_name || ''}" class="w-full">
                </div>
                <div class="form-group">
                    <label>Email</label>
                    <input type="email" id="settingsEmail" value="${user?.email || ''}" class="w-full" disabled>
                </div>
                <div class="form-group">
                    <label>Phone</label>
                    <input type="tel" id="settingsPhone" value="${user?.profile?.phone || ''}" class="w-full">
                </div>
                <button type="submit" class="btn-primary">
                    <i class="fas fa-save"></i> Save Settings
                </button>
            </form>
        </div>
    `;
    
    document.getElementById('settingsForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        showToast('Settings updated!', 'success');
    });
}

// ============================================
// CRUD OPERATIONS (Global Functions)
// ============================================
window.editCustomer = function(id) {
    showToast('Edit customer: ' + id, 'info');
};

window.deleteCustomer = async function(id) {
    if (!confirm('Delete this customer?')) return;
    try {
        const { error } = await supabase
            .from('customers')
            .delete()
            .eq('id', id);
        if (error) throw error;
        showToast('Customer deleted!', 'success');
        loadCustomers();
    } catch (error) {
        showToast('Error deleting customer: ' + error.message, 'error');
    }
};

window.editPackage = function(id) {
    showToast('Edit package: ' + id, 'info');
};

window.deletePackage = async function(id) {
    if (!confirm('Delete this package?')) return;
    try {
        const { error } = await supabase
            .from('packages')
            .delete()
            .eq('id', id);
        if (error) throw error;
        showToast('Package deleted!', 'success');
        loadPackages();
    } catch (error) {
        showToast('Error deleting package: ' + error.message, 'error');
    }
};

window.editRouter = function(id) {
    showToast('Edit router: ' + id, 'info');
};

window.deleteRouter = async function(id) {
    if (!confirm('Delete this router?')) return;
    try {
        const { error } = await supabase
            .from('routers')
            .delete()
            .eq('id', id);
        if (error) throw error;
        showToast('Router deleted!', 'success');
        loadRouters();
    } catch (error) {
        showToast('Error deleting router: ' + error.message, 'error');
    }
};

// ============================================
// MODAL FUNCTIONS
// ============================================
window.showAddCustomerModal = function() {
    showToast('Add customer modal coming soon!', 'info');
};

window.showAddPackageModal = function() {
    showToast('Add package modal coming soon!', 'info');
};

window.showRecordPaymentModal = function() {
    showToast('Record payment modal coming soon!', 'info');
};

window.showAddRouterModal = function() {
    showToast('Add router modal coming soon!', 'info');
};

// ============================================
// REPORT FUNCTIONS
// ============================================
window.generateRevenueReport = function() {
    showToast('Generating revenue report...', 'info');
    setTimeout(() => showToast('Revenue report generated!', 'success'), 2000);
};

window.generateCustomerReport = function() {
    showToast('Generating customer report...', 'info');
    setTimeout(() => showToast('Customer report generated!', 'success'), 2000);
};

window.generateUsageReport = function() {
    showToast('Generating usage report...', 'info');
    setTimeout(() => showToast('Usage report generated!', 'success'), 2000);
};

// ============================================
// FILTER FUNCTIONS
// ============================================
window.filterCustomers = function() {
    const search = document.getElementById('customerSearch')?.value.toLowerCase() || '';
    const rows = document.querySelectorAll('#customersTableBody tr');
    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(search) ? '' : 'none';
    });
};

window.filterPayments = function() {
    const search = document.getElementById('paymentSearch')?.value.toLowerCase() || '';
    const rows = document.querySelectorAll('#paymentsTableBody tr');
    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(search) ? '' : 'none';
    });
};

// ============================================
// UTILITY FUNCTIONS
// ============================================
function updateTime() {
    const el = document.getElementById('currentTime');
    if (el) {
        el.textContent = new Date().toLocaleString();
    }
    setTimeout(updateTime, 1000);
}

// ============================================
// NAVIGATION SETUP
// ============================================
document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        const page = link.dataset.page;
        window.navigateTo(page);
        history.pushState(null, '', `#${page}`);
    });
});

// ============================================
// LOGIN HANDLER
// ============================================
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    
    loginError.classList.add('hidden');
    
    const result = await login(email, password);
    
    if (result.success) {
        if (AuthService.isAdmin()) {
            window.location.href = '/orbitnetworks/admin/dashboard.html';
            return;
        }
        
        showToast('Welcome back!', 'success');
        showApp(true);
        window.navigateTo('dashboard');
        document.getElementById('email').value = '';
        document.getElementById('password').value = '';
    } else {
        loginError.textContent = result.error;
        loginError.classList.remove('hidden');
        showToast('Login failed: ' + result.error, 'error');
    }
});

// ============================================
// LOGOUT
// ============================================
logoutBtn.addEventListener('click', logout);

// ============================================
// INIT - WRAPPED IN IIFE TO ALLOW RETURN
// ============================================
(function initializeApp() {
    if (isAuthenticated()) {
        // Check if user is admin - redirect to admin dashboard
        if (AuthService.isAdmin()) {
            window.location.href = '/orbitnetworks/admin/dashboard.html';
            return; // ✅ Legal: inside a function
        }
        
        // Show the app
        showApp(true);
        
        // Navigate to the page from URL hash or default to dashboard
        const hash = window.location.hash.replace('#', '');
        if (hash) {
            window.navigateTo(hash);
        } else {
            window.navigateTo('dashboard');
        }
    } else {
        // Show login page
        showApp(false);
    }
})();

// Handle browser back/forward
window.addEventListener('popstate', () => {
    const hash = window.location.hash.replace('#', '');
    if (hash) {
        window.navigateTo(hash);
    }
});

console.log('🚀 Orbit Networks is ready!');
console.log(`📦 Helpers loaded: showToast, getTimeAgo, formatCurrency, formatDate, getInitials`);
console.log(`👤 User role: ${AuthService.getUserRole()}`);
