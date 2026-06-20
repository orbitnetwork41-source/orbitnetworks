import { createClient } from '@supabase/supabase-js';
import { showToast } from './utils/helpers.js';

// ============================================
// SUPABASE CONFIG
// ============================================
const supabase = createClient(
    'https://ozyuyawnmwhkmzckxpgu.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im96eXV5YXdubXdoa216Y2t4cGd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE5NjY3OTcsImV4cCI6MjA5NzU0Mjc5N30.q8BGDXNfR17wq9_g5feqqDmjLeBd4cPl2lP6D34n50g'
);

// ============================================
// STATE
// ============================================
let currentUser = null;
let currentPage = 'dashboard';

// ============================================
// DOM ELEMENTS
// ============================================
const loginPage = document.getElementById('loginPage');
const app = document.getElementById('app');
const loginForm = document.getElementById('loginForm');
const loginError = document.getElementById('loginError');
const logoutBtn = document.getElementById('logoutBtn');
const userName = document.getElementById('userName');

// ============================================
// AUTH FUNCTIONS
// ============================================
async function login(email, password) {
    try {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        });
        
        if (error) throw error;
        
        // Get user profile
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', data.user.id)
            .single();
        
        if (profileError && profileError.code !== 'PGRST116') {
            console.error('Profile error:', profileError);
        }
        
        currentUser = {
            ...data.user,
            profile: profile || { full_name: email.split('@')[0], role: 'customer' }
        };
        
        // Store session
        localStorage.setItem('user', JSON.stringify(currentUser));
        
        return { success: true, user: currentUser };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

async function logout() {
    await supabase.auth.signOut();
    localStorage.removeItem('user');
    currentUser = null;
    showApp(false);
    window.location.reload();
}

function getCurrentUser() {
    if (currentUser) return currentUser;
    const stored = localStorage.getItem('user');
    if (stored) {
        currentUser = JSON.parse(stored);
        return currentUser;
    }
    return null;
}

function isAuthenticated() {
    return !!getCurrentUser();
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
            userName.textContent = user.profile?.full_name || user.email?.split('@')[0] || 'Admin';
        }
    } else {
        loginPage.style.display = 'flex';
        app.classList.add('hidden');
    }
}

function navigateTo(page) {
    // Hide all pages
    document.querySelectorAll('.page-content').forEach(p => {
        p.classList.add('hidden');
        p.classList.remove('active');
    });
    
    // Show selected page
    const target = document.getElementById(`${page}Page`);
    if (target) {
        target.classList.remove('hidden');
        target.classList.add('active');
    }
    
    // Update nav links
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
        if (link.dataset.page === page) {
            link.classList.add('active');
        }
    });
    
    currentPage = page;
    
    // Load page data
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
    }
}

// ============================================
// DASHBOARD FUNCTIONS
// ============================================
async function loadDashboard() {
    const container = document.getElementById('dashboardPage');
    
    try {
        // Get stats
        const { count: totalCustomers } = await supabase
            .from('customers')
            .select('*', { count: 'exact', head: true });
        
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);
        
        const { data: payments } = await supabase
            .from('payments')
            .select('amount')
            .gte('created_at', startOfMonth.toISOString())
            .eq('status', 'completed');
        
        const monthlyRevenue = payments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;
        
        const { data: routers } = await supabase
            .from('routers')
            .select('status');
        
        const onlineRouters = routers?.filter(r => r.status === 'online').length || 0;
        
        // Render dashboard
        container.innerHTML = `
            <div class="page-header">
                <h1>Dashboard</h1>
                <span class="text-gray-400 text-sm" id="currentTime"></span>
            </div>
            
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-icon bg-blue-500/20 text-blue-400">
                        <i class="fas fa-users"></i>
                    </div>
                    <div class="stat-info">
                        <h3>Total Customers</h3>
                        <span>${totalCustomers || 0}</span>
                    </div>
                </div>
                
                <div class="stat-card">
                    <div class="stat-icon bg-green-500/20 text-green-400">
                        <i class="fas fa-money-bill-wave"></i>
                    </div>
                    <div class="stat-info">
                        <h3>Monthly Revenue</h3>
                        <span>KES ${monthlyRevenue.toFixed(2)}</span>
                    </div>
                </div>
                
                <div class="stat-card">
                    <div class="stat-icon bg-purple-500/20 text-purple-400">
                        <i class="fas fa-wifi"></i>
                    </div>
                    <div class="stat-info">
                        <h3>Active Users</h3>
                        <span>${Math.floor(Math.random() * 30) + 5}</span>
                    </div>
                </div>
                
                <div class="stat-card">
                    <div class="stat-icon bg-cyan-500/20 text-cyan-400">
                        <i class="fas fa-router"></i>
                    </div>
                    <div class="stat-info">
                        <h3>Routers Online</h3>
                        <span>${onlineRouters}</span>
                    </div>
                </div>
            </div>
            
            <div class="dashboard-grid">
                <div class="card">
                    <h2>Recent Activity</h2>
                    <div id="recentActivity">Loading...</div>
                </div>
                <div class="card">
                    <h2>Quick Actions</h2>
                    <div class="action-buttons">
                        <button class="btn-primary" onclick="navigateTo('customers')">
                            <i class="fas fa-user-plus"></i> Add Customer
                        </button>
                        <button class="btn-primary" onclick="navigateTo('packages')">
                            <i class="fas fa-plus-circle"></i> Create Package
                        </button>
                        <button class="btn-primary" onclick="navigateTo('payments')">
                            <i class="fas fa-hand-holding-usd"></i> Record Payment
                        </button>
                        <button class="btn-primary" onclick="navigateTo('routers')">
                            <i class="fas fa-plus-circle"></i> Add Router
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        // Load recent activity
        await loadRecentActivity();
        
        // Update time
        updateTime();
        
    } catch (error) {
        console.error('Error loading dashboard:', error);
        container.innerHTML = `
            <div class="page-header"><h1>Dashboard</h1></div>
            <div class="text-red-400 p-4 bg-red-500/10 rounded-lg">
                <i class="fas fa-exclamation-circle mr-2"></i>
                Error loading dashboard: ${error.message}
            </div>
        `;
    }
}

async function loadRecentActivity() {
    const container = document.getElementById('recentActivity');
    if (!container) return;
    
    try {
        const { data: activities } = await supabase
            .from('activity_logs')
            .select('*, profiles(full_name)')
            .order('created_at', { ascending: false })
            .limit(5);
        
        if (!activities || activities.length === 0) {
            container.innerHTML = '<p class="text-gray-400">No recent activity</p>';
            return;
        }
        
        container.innerHTML = activities.map(a => `
            <div class="activity-item">
                <div class="activity-icon">
                    <i class="fas fa-circle"></i>
                </div>
                <div class="activity-details">
                    <strong>${a.action.replace(/_/g, ' ').toUpperCase()}</strong>
                    <span>${a.profiles?.full_name || 'System'}</span>
                    <small>${getTimeAgo(a.created_at)}</small>
                </div>
            </div>
        `).join('');
        
    } catch (error) {
        console.error('Error loading activity:', error);
        container.innerHTML = '<p class="text-red-400">Error loading activity</p>';
    }
}

// ============================================
// CUSTOMER FUNCTIONS
// ============================================
async function loadCustomers() {
    const container = document.getElementById('customersPage');
    
    try {
        const { data: customers, error } = await supabase
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
            
            <div class="search-bar">
                <input type="text" id="searchCustomer" placeholder="Search customers..." />
            </div>
            
            <div class="table-container">
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
                    <tbody>
                        ${customers?.map(c => `
                            <tr>
                                <td><strong>${c.profiles?.full_name || 'Unknown'}</strong></td>
                                <td>${c.profiles?.phone || 'N/A'}</td>
                                <td><span class="badge ${c.status === 'active' ? 'badge-success' : 'badge-danger'}">${c.status}</span></td>
                                <td>${new Date(c.created_at).toLocaleDateString()}</td>
                                <td>
                                    <button class="btn-secondary" onclick="editCustomer('${c.id}')">
                                        <i class="fas fa-edit"></i>
                                    </button>
                                    <button class="btn-danger" onclick="deleteCustomer('${c.id}')">
                                        <i class="fas fa-trash"></i>
                                    </button>
                                </td>
                            </tr>
                        `).join('') || '<tr><td colspan="5" class="text-center text-gray-400 py-8">No customers found</td></tr>'}
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
// PACKAGE FUNCTIONS
// ============================================
async function loadPackages() {
    const container = document.getElementById('packagesPage');
    
    try {
        const { data: packages, error } = await supabase
            .from('packages')
            .select('*')
            .eq('is_active', true)
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
                ${packages?.map(p => `
                    <div class="package-card">
                        <h3>${p.name}</h3>
                        <div class="price">KES ${p.price}</div>
                        <div class="package-details">
                            <p>⚡ ${p.speed}</p>
                            <p>📦 ${p.data_limit_gb || 'Unlimited'} GB</p>
                            <p>📅 ${p.validity_days} days</p>
                        </div>
                        <ul class="features">
                            ${(p.features || ['24/7 Support']).map(f => `<li>✓ ${f}</li>`).join('')}
                        </ul>
                        <button class="btn-secondary" onclick="editPackage('${p.id}')">
                            <i class="fas fa-edit"></i> Edit
                        </button>
                        <button class="btn-danger" onclick="deletePackage('${p.id}')">
                            <i class="fas fa-trash"></i> Delete
                        </button>
                    </div>
                `).join('') || '<p class="text-center text-gray-400 py-8">No packages available</p>'}
            </div>
        `;
        
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
// PAYMENT FUNCTIONS
// ============================================
async function loadPayments() {
    const container = document.getElementById('paymentsPage');
    
    try {
        const { data: payments, error } = await supabase
            .from('payments')
            .select('*, customers(id, profiles(full_name))')
            .order('created_at', { ascending: false })
            .limit(50);
        
        if (error) throw error;
        
        container.innerHTML = `
            <div class="page-header">
                <h1>Payments</h1>
                <button class="btn-primary" onclick="showAddPaymentModal()">
                    <i class="fas fa-plus-circle"></i> Record Payment
                </button>
            </div>
            
            <div class="table-container">
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
                    <tbody>
                        ${payments?.map(p => `
                            <tr>
                                <td>${new Date(p.created_at).toLocaleDateString()}</td>
                                <td>${p.customers?.profiles?.full_name || 'Unknown'}</td>
                                <td><strong>KES ${p.amount}</strong></td>
                                <td>${p.method}</td>
                                <td><span class="badge ${p.status === 'completed' ? 'badge-success' : p.status === 'pending' ? 'badge-warning' : 'badge-danger'}">${p.status}</span></td>
                                <td>${p.reference || 'N/A'}</td>
                            </tr>
                        `).join('') || '<tr><td colspan="6" class="text-center text-gray-400 py-8">No payments found</td></tr>'}
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
// ROUTER FUNCTIONS
// ============================================
async function loadRouters() {
    const container = document.getElementById('routersPage');
    
    try {
        const { data: routers, error } = await supabase
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
                ${routers?.map(r => `
                    <div class="router-card">
                        <h3>📡 ${r.name}</h3>
                        <p><strong>IP:</strong> ${r.ip_address}</p>
                        <p><strong>Model:</strong> ${r.model || 'N/A'}</p>
                        <p><strong>Location:</strong> ${r.location || 'N/A'}</p>
                        <p>
                            <span class="badge ${r.status === 'online' ? 'badge-success' : 'badge-danger'}">${r.status}</span>
                        </p>
                        <div class="mt-3 flex gap-2">
                            <button class="btn-secondary" onclick="editRouter('${r.id}')">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="btn-danger" onclick="deleteRouter('${r.id}')">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                `).join('') || '<p class="text-center text-gray-400 py-8">No routers configured</p>'}
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
// UTILITY FUNCTIONS
// ============================================
function getTimeAgo(date) {
    const now = new Date();
    const diff = Math.floor((now - new Date(date)) / 1000);
    
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    return new Date(date).toLocaleDateString();
}

function updateTime() {
    const el = document.getElementById('currentTime');
    if (el) {
        el.textContent = new Date().toLocaleString();
    }
    setTimeout(updateTime, 1000);
}

// ============================================
// MODAL FUNCTIONS (Placeholders)
// ============================================
window.showAddCustomerModal = function() {
    showToast('Add customer modal coming soon!', 'info');
};

window.showAddPackageModal = function() {
    showToast('Add package modal coming soon!', 'info');
};

window.showAddPaymentModal = function() {
    showToast('Record payment modal coming soon!', 'info');
};

window.showAddRouterModal = function() {
    showToast('Add router modal coming soon!', 'info');
};

window.editCustomer = function(id) {
    showToast(`Edit customer: ${id}`, 'info');
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
    showToast(`Edit package: ${id}`, 'info');
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
    showToast(`Edit router: ${id}`, 'info');
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
// NAVIGATION
// ============================================
document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        const page = link.dataset.page;
        navigateTo(page);
        // Update URL hash
        history.pushState(null, '', `#${page}`);
    });
});

// ============================================
// LOGIN
// ============================================
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    
    loginError.classList.add('hidden');
    
    const result = await login(email, password);
    
    if (result.success) {
        showToast('Welcome back!', 'success');
        showApp(true);
        navigateTo('dashboard');
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
// INIT
// ============================================
if (isAuthenticated()) {
    showApp(true);
    // Check URL hash for page
    const hash = window.location.hash.replace('#', '');
    if (hash) {
        navigateTo(hash);
    } else {
        navigateTo('dashboard');
    }
} else {
    showApp(false);
}

// Handle browser back/forward
window.addEventListener('popstate', () => {
    const hash = window.location.hash.replace('#', '');
    if (hash) {
        navigateTo(hash);
    }
});

console.log('🚀 Orbit Networks is ready!');
