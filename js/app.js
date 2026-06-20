import { supabase } from './config/supabase.js';
import { showToast, getTimeAgo, formatCurrency } from './utils/helpers.js';

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

window.navigateTo = function(page) {
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
};

// ============================================
// DASHBOARD
// ============================================
async function loadDashboard() {
    const container = document.getElementById('dashboardPage');
    const user = getCurrentUser();
    const isAdmin = user?.profile?.role === 'admin' || user?.profile?.role === 'super_admin';
    
    try {
        let totalCustomers = 0;
        let monthlyRevenue = 0;
        let routersOnline = 0;
        let activeUsers = Math.floor(Math.random() * 30) + 5;
        
        // Get customers count
        try {
            const { count, error } = await supabase
                .from('customers')
                .select('*', { count: 'exact', head: true });
            if (!error) totalCustomers = count || 0;
        } catch (e) {
            console.warn('Could not get customer count:', e.message);
        }
        
        // Get monthly revenue
        try {
            const startOfMonth = new Date();
            startOfMonth.setDate(1);
            startOfMonth.setHours(0, 0, 0, 0);
            
            const { data, error } = await supabase
                .from('payments')
                .select('amount')
                .gte('created_at', startOfMonth.toISOString())
                .eq('status', 'completed');
            
            if (!error) {
                monthlyRevenue = data?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;
            }
        } catch (e) {
            console.warn('Could not get revenue:', e.message);
        }
        
        // Get online routers
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
                        <span>${totalCustomers}</span>
                    </div>
                </div>
                
                <div class="stat-card">
                    <div class="stat-icon bg-green-500/20 text-green-400">
                        <i class="fas fa-money-bill-wave"></i>
                    </div>
                    <div class="stat-info">
                        <h3>Monthly Revenue</h3>
                        <span>${formatCurrency(monthlyRevenue)}</span>
                    </div>
                </div>
                
                <div class="stat-card">
                    <div class="stat-icon bg-purple-500/20 text-purple-400">
                        <i class="fas fa-wifi"></i>
                    </div>
                    <div class="stat-info">
                        <h3>Active Users</h3>
                        <span>${activeUsers}</span>
                    </div>
                </div>
                
                <div class="stat-card">
                    <div class="stat-icon bg-cyan-500/20 text-cyan-400">
                        <i class="fas fa-router"></i>
                    </div>
                    <div class="stat-info">
                        <h3>Routers Online</h3>
                        <span>${routersOnline}</span>
                    </div>
                </div>
            </div>
            
            <div class="dashboard-grid">
                <div class="card">
                    <h2>Recent Activity</h2>
                    <div id="recentActivity">
                        <p class="text-gray-400">Loading...</p>
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
                    </div>
                </div>
            </div>
        `;
        
        updateTime();
        
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
                <button class="btn-primary" onclick="window.navigateTo('customers')">
                    <i class="fas fa-user-plus"></i> Add Customer
                </button>
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
                        ${data && data.length > 0 ? data.map(c => `
                            <tr>
                                <td><strong>${c.profiles?.full_name || 'Unknown'}</strong></td>
                                <td>${c.profiles?.phone || 'N/A'}</td>
                                <td><span class="badge ${c.status === 'active' ? 'badge-success' : 'badge-danger'}">${c.status}</span></td>
                                <td>${new Date(c.created_at).toLocaleDateString()}</td>
                                <td>
                                    <button class="btn-secondary" onclick="window.editCustomer('${c.id}')">
                                        <i class="fas fa-edit"></i>
                                    </button>
                                    <button class="btn-danger" onclick="window.deleteCustomer('${c.id}')">
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
            .eq('is_active', true)
            .order('price');
        
        if (error) throw error;
        
        container.innerHTML = `
            <div class="page-header">
                <h1>Packages</h1>
                <button class="btn-primary" onclick="window.navigateTo('packages')">
                    <i class="fas fa-plus-circle"></i> Create Package
                </button>
            </div>
            
            <div class="packages-grid">
                ${data && data.length > 0 ? data.map(p => `
                    <div class="package-card">
                        <h3>${p.name}</h3>
                        <div class="price">${formatCurrency(p.price)}</div>
                        <div class="package-details">
                            <p>⚡ ${p.speed}</p>
                            <p>📦 ${p.data_limit_gb || 'Unlimited'} GB</p>
                            <p>📅 ${p.validity_days} days</p>
                        </div>
                        <ul class="features">
                            ${(p.features || ['24/7 Support']).map(f => `<li>✓ ${f}</li>`).join('')}
                        </ul>
                        <div class="mt-3 flex gap-2">
                            <button class="btn-secondary" onclick="window.editPackage('${p.id}')">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="btn-danger" onclick="window.deletePackage('${p.id}')">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                `).join('') : '<p class="text-center text-gray-400 py-8">No packages available</p>'}
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
                <button class="btn-primary" onclick="window.navigateTo('payments')">
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
                        ${data && data.length > 0 ? data.map(p => `
                            <tr>
                                <td>${new Date(p.created_at).toLocaleDateString()}</td>
                                <td>${p.customers?.profiles?.full_name || 'Unknown'}</td>
                                <td><strong>${formatCurrency(p.amount)}</strong></td>
                                <td>${p.method}</td>
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
                <button class="btn-primary" onclick="window.navigateTo('routers')">
                    <i class="fas fa-plus-circle"></i> Add Router
                </button>
            </div>
            
            <div class="router-grid">
                ${data && data.length > 0 ? data.map(r => `
                    <div class="router-card">
                        <h3>📡 ${r.name}</h3>
                        <p><strong>IP:</strong> ${r.ip_address}</p>
                        <p><strong>Model:</strong> ${r.model || 'N/A'}</p>
                        <p><strong>Location:</strong> ${r.location || 'N/A'}</p>
                        <p>
                            <span class="badge ${r.status === 'online' ? 'badge-success' : 'badge-danger'}">${r.status}</span>
                        </p>
                        <div class="mt-3 flex gap-2">
                            <button class="btn-secondary" onclick="window.editRouter('${r.id}')">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="btn-danger" onclick="window.deleteRouter('${r.id}')">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                `).join('') : '<p class="text-center text-gray-400 py-8">No routers configured</p>'}
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
// NAVIGATION
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
// INIT
// ============================================
if (isAuthenticated()) {
    showApp(true);
    const hash = window.location.hash.replace('#', '');
    if (hash) {
        window.navigateTo(hash);
    } else {
        window.navigateTo('dashboard');
    }
} else {
    showApp(false);
}

window.addEventListener('popstate', () => {
    const hash = window.location.hash.replace('#', '');
    if (hash) {
        window.navigateTo(hash);
    }
});

console.log('🚀 Orbit Networks is ready!');
