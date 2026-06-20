// js/admin/dashboard.js
// COMPLETE ADMIN DASHBOARD - MIKROTIK INTEGRATION + ALL MODULES

import { supabase } from '../config/supabase.js';
import { AuthService } from '../services/auth.service.js';
import { 
    showToast, 
    formatCurrency, 
    formatDate, 
    getTimeAgo, 
    getInitials,
    truncateText,
    generateId 
} from '../utils/helpers.js';

// ============================================
// IMPORT ALL MODULES
// ============================================
import { loadWalletStats, getWalletTransactions, topUpWallet, withdrawFromWallet } from './modules/wallet.js';
import { getTicketStats, loadTickets, updateTicketStatus, createTicket } from './modules/tickets.js';
import { loadInvoices, getInvoiceStats, generateInvoice, updateInvoiceStatus } from './modules/invoices.js';
import { loadNotifications, markNotificationRead, createNotification, getUnreadCount } from './modules/notifications.js';
import { loadReferrals, getReferralStats, createReferral } from './modules/referrals.js';
import { sendBulkSMS, getSMSStats, loadSMSLogs, sendSingleSMS } from './modules/sms.js';
import { loadStaff, updateStaffRole, getStaffStats } from './modules/staff.js';
import { generateVouchers, getVoucherStats, loadVouchers, redeemVoucher } from './modules/vouchers.js';
import { sendWhatsAppMessage, getWhatsAppStats } from './modules/whatsapp.js';

// ============================================
// MIKROTIK API CONFIGURATION
// ============================================
const MIKROTIK = {
    baseUrl: import.meta.env.VITE_MIKROTIK_API_URL || '/api/mikrotik',
    timeout: 10000,
    status: 'disconnected',
    stats: {
        hotspotUsers: 0,
        pppoeActive: 0,
        bandwidthUsed: 0,
        routerCount: 0
    }
};

// ============================================
// AUTH CHECK
// ============================================
if (!AuthService.isAuthenticated()) {
    console.log('🔒 Not authenticated, redirecting to login...');
    window.location.href = '/login.html';
    throw new Error('Not authenticated');
}

const user = AuthService.getCurrentUser();
if (!AuthService.isAdmin()) {
    console.log('🔒 Not admin, redirecting...');
    window.location.href = '/';
    throw new Error('Admin access required');
}

console.log(`✅ Authenticated as: ${user?.profile?.full_name || user?.email}`);

// ============================================
// STATE
// ============================================
const state = {
    currentUser: user,
    stats: {
        customers: 0,
        revenue: 0,
        activeUsers: 0,
        routersOnline: 0,
        walletBalance: 0,
        openTickets: 0,
        pendingInvoices: 0,
        smsSent: 0,
        referrals: 0,
        vouchersActive: 0,
        totalRevenue: 0,
        successRate: 0,
        totalStaff: 0,
        // MikroTik specific
        hotspotUsers: 0,
        pppoeActive: 0,
        bandwidthUsed: 0,
        routerCount: 0,
        hotspotSessions: 0
    },
    charts: {
        revenue: null,
        package: null,
        wallet: null,
        activity: null,
        hotspot: null,
        bandwidth: null
    },
    refreshInterval: null,
    data: {
        wallet: { transactions: [], balance: 0 },
        tickets: [],
        invoices: [],
        notifications: [],
        referrals: [],
        smsLogs: [],
        staff: [],
        vouchers: []
    }
};

// ============================================
// DOM REFS
// ============================================
const DOM = {
    // Stats
    totalCustomers: document.getElementById('totalCustomers'),
    monthlyRevenue: document.getElementById('monthlyRevenue'),
    activeUsers: document.getElementById('activeUsers'),
    routersOnline: document.getElementById('routersOnline'),
    customerCount: document.getElementById('customerCount'),
    adminName: document.getElementById('adminName'),
    adminNameDisplay: document.getElementById('adminNameDisplay'),
    adminInitials: document.getElementById('adminInitials'),
    
    // Module Stats
    walletBalance: document.getElementById('walletBalance'),
    openTickets: document.getElementById('openTickets'),
    pendingInvoices: document.getElementById('pendingInvoices'),
    smsSent: document.getElementById('smsSent'),
    referrals: document.getElementById('referrals'),
    vouchersActive: document.getElementById('vouchersActive'),
    successRate: document.getElementById('successRate'),
    totalStaff: document.getElementById('totalStaff'),
    
    // MikroTik Stats
    hotspotUsers: document.getElementById('hotspotUsers'),
    pppoeActive: document.getElementById('pppoeActive'),
    bandwidthUsed: document.getElementById('bandwidthUsed'),
    routerCount: document.getElementById('routerCount'),
    hotspotSessions: document.getElementById('hotspotSessions'),
    pppoeActiveCount: document.getElementById('pppoeActiveCount'),
    mikrotikStatus: document.getElementById('mikrotikStatus'),
    mikrotikStatusDot: document.getElementById('mikrotikStatusDot'),
    
    // Activity
    recentActivity: document.getElementById('adminRecentActivity'),
    notificationBell: document.getElementById('notificationBell'),
    notificationBadge: document.getElementById('notificationBadge'),
    
    // Charts
    revenueChart: document.getElementById('revenueChart'),
    packageChart: document.getElementById('packageChart'),
    walletChart: document.getElementById('walletChart'),
    activityChart: document.getElementById('activityChart'),
    hotspotChart: document.getElementById('hotspotChart'),
    bandwidthChart: document.getElementById('bandwidthChart'),
    
    // Period
    revenuePeriod: document.getElementById('revenuePeriod'),
    
    // Buttons
    logoutBtn: document.getElementById('adminLogoutBtn'),
    refreshBtn: document.getElementById('refreshBtn')
};

// ============================================
// SET USER INFO
// ============================================
function setUserInfo() {
    const user = state.currentUser;
    const name = user?.profile?.full_name || user?.email?.split('@')[0] || 'Admin';
    const initials = getInitials(name);
    
    if (DOM.adminName) DOM.adminName.textContent = name;
    if (DOM.adminNameDisplay) DOM.adminNameDisplay.textContent = name;
    if (DOM.adminInitials) DOM.adminInitials.textContent = initials;
}

// ============================================
// MIKROTIK API FUNCTIONS
// ============================================
async function fetchMikroTikStats() {
    try {
        // Fetch from your MikroTik API endpoint
        const response = await fetch(`${MIKROTIK.baseUrl}/stats`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('mikrotik_token') || ''}`
            },
            signal: AbortSignal.timeout(MIKROTIK.timeout)
        });

        if (!response.ok) {
            throw new Error('MikroTik API error');
        }

        const data = await response.json();
        
        MIKROTIK.status = 'connected';
        MIKROTIK.stats = {
            hotspotUsers: data.hotspot_active || 0,
            pppoeActive: data.pppoe_active || 0,
            bandwidthUsed: data.bandwidth_used || 0,
            routerCount: data.routers_online || 0
        };

        updateMikroTikStatus(true);
        return MIKROTIK.stats;

    } catch (error) {
        console.warn('MikroTik API error:', error.message);
        MIKROTIK.status = 'disconnected';
        updateMikroTikStatus(false);
        return null;
    }
}

function updateMikroTikStatus(connected) {
    const statusText = DOM.mikrotikStatus;
    const statusDot = DOM.mikrotikStatusDot;
    
    if (!statusText || !statusDot) return;
    
    if (connected) {
        statusText.textContent = 'MikroTik: Connected';
        statusDot.className = 'w-2 h-2 bg-green-400 rounded-full animate-pulse';
    } else {
        statusText.textContent = 'MikroTik: Disconnected';
        statusDot.className = 'w-2 h-2 bg-red-400 rounded-full';
    }
}

// ============================================
// INITIALIZATION
// ============================================
document.addEventListener('DOMContentLoaded', async () => {
    // Set user info
    setUserInfo();
    
    // Show loading state
    showLoadingState();
    
    try {
        // Load ALL dashboard data including MikroTik
        await loadAllDashboardData();
        
        // Setup event listeners
        setupEventListeners();
        
        // Start auto-refresh (every 30 seconds)
        startAutoRefresh();
        
        // Check notifications
        await updateNotificationBadge();
        
        console.log('🚀 Orbit Networks Admin Dashboard ready!');
        console.log(`👤 Logged in as: ${state.currentUser?.profile?.full_name || state.currentUser?.email}`);
        console.log(`📡 MikroTik Status: ${MIKROTIK.status}`);
        
    } catch (error) {
        console.error('Dashboard initialization error:', error);
        showToast('Error loading dashboard data', 'error');
    }
});

// ============================================
// LOAD ALL DASHBOARD DATA
// ============================================
async function loadAllDashboardData() {
    try {
        // Load everything in parallel
        const [
            stats,
            walletData,
            ticketStats,
            invoiceStats,
            referralStats,
            smsStats,
            staffStats,
            voucherStats,
            notifications,
            mikrotikStats
        ] = await Promise.all([
            loadStats(),
            loadWalletStats(),
            getTicketStats(),
            getInvoiceStats(),
            getReferralStats(),
            getSMSStats(),
            getStaffStats(),
            getVoucherStats(),
            loadNotifications(5),
            fetchMikroTikStats()
        ]);

        // Update state
        state.stats = { ...state.stats, ...stats };
        state.stats.walletBalance = walletData.balance || 0;
        state.stats.openTickets = ticketStats.open || 0;
        state.stats.pendingInvoices = invoiceStats.pending || 0;
        state.stats.referrals = referralStats.total || 0;
        state.stats.smsSent = smsStats.sent || 0;
        state.stats.totalStaff = staffStats.total || 0;
        state.stats.vouchersActive = voucherStats.active || 0;
        
        // MikroTik stats
        if (mikrotikStats) {
            state.stats.hotspotUsers = mikrotikStats.hotspotUsers || 0;
            state.stats.pppoeActive = mikrotikStats.pppoeActive || 0;
            state.stats.bandwidthUsed = mikrotikStats.bandwidthUsed || 0;
            state.stats.routerCount = mikrotikStats.routerCount || 0;
            state.stats.hotspotSessions = mikrotikStats.hotspotUsers || 0;
        }
        
        state.data.notifications = notifications;

        // Update UI
        updateStatsUI();
        updateMikroTikUI();
        await loadRecentActivity();
        await loadRevenueChart(30);
        await loadPackageChart();
        await loadWalletChart();
        await loadHotspotChart();
        await loadBandwidthChart();
        
        // Update module-specific data
        state.data.wallet = walletData;
        state.data.tickets = await loadTickets('all', 10);
        state.data.invoices = await loadInvoices('all', 10);
        state.data.referrals = await loadReferrals(10);
        state.data.smsLogs = await loadSMSLogs(10);
        state.data.staff = await loadStaff();
        state.data.vouchers = await loadVouchers('all', 10);

    } catch (error) {
        console.error('Error loading dashboard data:', error);
        showToast('Error loading dashboard data', 'error');
    }
}

// ============================================
// LOAD STATS
// ============================================
async function loadStats() {
    try {
        // Total customers
        const { count: totalCustomers } = await supabase
            .from('customers')
            .select('*', { count: 'exact', head: true });
        
        const customers = totalCustomers || 0;

        // Monthly revenue
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        const { data: payments } = await supabase
            .from('payments')
            .select('amount')
            .gte('created_at', startOfMonth.toISOString())
            .eq('status', 'completed');

        const monthlyRevenue = payments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;

        // Routers online (from Supabase)
        const { data: routers } = await supabase
            .from('routers')
            .select('status');

        const online = routers?.filter(r => r.status === 'online').length || 0;

        // Success rate
        const { data: allPayments } = await supabase
            .from('payments')
            .select('status');

        let successRate = 0;
        if (allPayments?.length > 0) {
            const success = allPayments.filter(p => p.status === 'completed').length;
            successRate = Math.round((success / allPayments.length) * 100);
        }

        // Active users (simulated for now)
        const activeUsers = Math.floor(Math.random() * 50) + 10;

        return {
            customers,
            revenue: monthlyRevenue,
            activeUsers,
            routersOnline: online,
            successRate,
            totalRevenue: monthlyRevenue
        };

    } catch (error) {
        console.error('Error loading stats:', error);
        return {
            customers: 0,
            revenue: 0,
            activeUsers: 0,
            routersOnline: 0,
            successRate: 0,
            totalRevenue: 0
        };
    }
}

// ============================================
// UPDATE UI
// ============================================
function updateStatsUI() {
    const s = state.stats;
    
    // Main stats
    if (DOM.totalCustomers) DOM.totalCustomers.textContent = s.customers;
    if (DOM.customerCount) DOM.customerCount.textContent = s.customers;
    if (DOM.monthlyRevenue) DOM.monthlyRevenue.textContent = formatCurrency(s.revenue);
    if (DOM.activeUsers) DOM.activeUsers.textContent = s.activeUsers;
    if (DOM.routersOnline) DOM.routersOnline.textContent = s.routersOnline;
    if (DOM.successRate) DOM.successRate.textContent = s.successRate + '%';
    
    // Module stats
    if (DOM.walletBalance) DOM.walletBalance.textContent = formatCurrency(s.walletBalance);
    if (DOM.openTickets) DOM.openTickets.textContent = s.openTickets;
    if (DOM.pendingInvoices) DOM.pendingInvoices.textContent = s.pendingInvoices;
    if (DOM.smsSent) DOM.smsSent.textContent = s.smsSent;
    if (DOM.referrals) DOM.referrals.textContent = s.referrals;
    if (DOM.vouchersActive) DOM.vouchersActive.textContent = s.vouchersActive;
    if (DOM.totalStaff) DOM.totalStaff.textContent = s.totalStaff;
}

function updateMikroTikUI() {
    const s = state.stats;
    
    if (DOM.hotspotUsers) DOM.hotspotUsers.textContent = s.hotspotUsers || 0;
    if (DOM.pppoeActive) DOM.pppoeActive.textContent = s.pppoeActive || 0;
    if (DOM.bandwidthUsed) DOM.bandwidthUsed.textContent = `${s.bandwidthUsed || 0} Mbps`;
    if (DOM.routerCount) DOM.routerCount.textContent = s.routerCount || 0;
    if (DOM.hotspotSessions) DOM.hotspotSessions.textContent = s.hotspotSessions || 0;
    if (DOM.pppoeActiveCount) DOM.pppoeActiveCount.textContent = s.pppoeActive || 0;
}

// ============================================
// LOAD RECENT ACTIVITY
// ============================================
async function loadRecentActivity() {
    try {
        // Get combined activity
        const [payments, customers, tickets, walletTxns] = await Promise.all([
            supabase
                .from('payments')
                .select('*, customers:customer_id(profiles(full_name))')
                .order('created_at', { ascending: false })
                .limit(4),
            supabase
                .from('customers')
                .select('*, profiles(full_name)')
                .order('created_at', { ascending: false })
                .limit(2),
            supabase
                .from('support_tickets')
                .select('*, customers:customer_id(profiles(full_name))')
                .order('created_at', { ascending: false })
                .limit(2),
            supabase
                .from('wallet_transactions')
                .select('*, user:user_id(profiles(full_name))')
                .order('created_at', { ascending: false })
                .limit(2)
        ]);

        const activities = [];

        // Format payments
        payments.data?.forEach(p => {
            activities.push({
                type: 'payment',
                icon: 'fa-money-bill-wave',
                color: 'text-green-400',
                bg: 'bg-green-500/20',
                title: `Payment of ${formatCurrency(p.amount)}`,
                description: `${p.customers?.profiles?.full_name || 'Customer'} • ${p.method || 'M-Pesa'}`,
                time: getTimeAgo(new Date(p.created_at)),
                timestamp: p.created_at
            });
        });

        // Format customers
        customers.data?.forEach(c => {
            activities.push({
                type: 'customer',
                icon: 'fa-user-plus',
                color: 'text-blue-400',
                bg: 'bg-blue-500/20',
                title: 'New customer registered',
                description: c.profiles?.full_name || 'Unknown',
                time: getTimeAgo(new Date(c.created_at)),
                timestamp: c.created_at
            });
        });

        // Format tickets
        tickets.data?.forEach(t => {
            activities.push({
                type: 'ticket',
                icon: 'fa-ticket',
                color: 'text-yellow-400',
                bg: 'bg-yellow-500/20',
                title: `New ticket: ${truncateText(t.subject, 30)}`,
                description: t.customers?.profiles?.full_name || 'Customer',
                time: getTimeAgo(new Date(t.created_at)),
                timestamp: t.created_at
            });
        });

        // Format wallet transactions
        walletTxns.data?.forEach(w => {
            const isCredit = w.type === 'credit';
            activities.push({
                type: 'wallet',
                icon: isCredit ? 'fa-arrow-down' : 'fa-arrow-up',
                color: isCredit ? 'text-emerald-400' : 'text-red-400',
                bg: isCredit ? 'bg-emerald-500/20' : 'bg-red-500/20',
                title: `${isCredit ? 'Wallet top-up' : 'Wallet withdrawal'} of ${formatCurrency(w.amount)}`,
                description: w.user?.profiles?.full_name || 'User',
                time: getTimeAgo(new Date(w.created_at)),
                timestamp: w.created_at
            });
        });

        // Sort by timestamp
        activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        const recent = activities.slice(0, 10);

        const container = DOM.recentActivity;
        if (!container) return;

        if (recent.length === 0) {
            container.innerHTML = `
                <div class="text-center text-gray-400 py-8">
                    <i class="fas fa-inbox text-3xl mb-2"></i>
                    <p>No recent activity</p>
                </div>
            `;
            return;
        }

        container.innerHTML = recent.map(a => `
            <div class="flex items-center gap-4 p-3 bg-white/5 rounded-lg hover:bg-white/10 transition">
                <div class="w-10 h-10 ${a.bg} rounded-lg flex items-center justify-center">
                    <i class="fas ${a.icon} ${a.color}"></i>
                </div>
                <div class="flex-1">
                    <p class="text-sm text-white font-medium">${a.title}</p>
                    <p class="text-xs text-gray-400">${a.description} • ${a.time}</p>
                </div>
                <span class="text-xs text-gray-500">${a.time}</span>
            </div>
        `).join('');

    } catch (error) {
        console.error('Error loading recent activity:', error);
    }
}

// ============================================
// REVENUE CHART
// ============================================
let revenueChartInstance = null;

async function loadRevenueChart(days = 30) {
    try {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        startDate.setHours(0, 0, 0, 0);

        const { data: payments } = await supabase
            .from('payments')
            .select('amount, created_at')
            .gte('created_at', startDate.toISOString())
            .eq('status', 'completed');

        const dailyData = {};
        const labels = [];
        const values = [];

        for (let i = 0; i < days; i++) {
            const date = new Date(startDate);
            date.setDate(date.getDate() + i);
            const key = date.toISOString().split('T')[0];
            labels.push(key);
            dailyData[key] = 0;
        }

        if (payments) {
            payments.forEach(p => {
                const date = new Date(p.created_at).toISOString().split('T')[0];
                if (dailyData[date] !== undefined) {
                    dailyData[date] += Number(p.amount);
                }
            });
        }

        labels.forEach(key => {
            values.push(dailyData[key] || 0);
        });

        const ctx = DOM.revenueChart?.getContext('2d');
        if (!ctx) return;

        if (revenueChartInstance) {
            revenueChartInstance.destroy();
        }

        revenueChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels.map(d => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })),
                datasets: [{
                    label: 'Revenue (KES)',
                    data: values,
                    borderColor: '#0EA5E9',
                    backgroundColor: 'rgba(14, 165, 233, 0.1)',
                    fill: true,
                    tension: 0.4,
                    pointBackgroundColor: '#0EA5E9',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        labels: {
                            color: '#94A3B8',
                            font: { size: 12 }
                        }
                    }
                },
                scales: {
                    y: {
                        ticks: {
                            color: '#94A3B8',
                            callback: (value) => `KES ${value.toLocaleString()}`
                        },
                        grid: {
                            color: 'rgba(255, 255, 255, 0.05)'
                        }
                    },
                    x: {
                        ticks: {
                            color: '#94A3B8',
                            maxTicksLimit: 10
                        },
                        grid: {
                            display: false
                        }
                    }
                }
            }
        });

    } catch (error) {
        console.error('Error loading revenue chart:', error);
    }
}

// ============================================
// PACKAGE CHART
// ============================================
let packageChartInstance = null;

async function loadPackageChart() {
    try {
        const { data: packages } = await supabase
            .from('packages')
            .select('name, price, customer_count')
            .eq('is_active', true);

        const ctx = DOM.packageChart?.getContext('2d');
        if (!ctx) return;

        if (packageChartInstance) {
            packageChartInstance.destroy();
        }

        const colors = ['#0EA5E9', '#14B8A6', '#F472B6', '#FBBF24', '#8B5CF6', '#34D399'];

        const pkgData = packages || [];
        const hasData = pkgData.length > 0;

        packageChartInstance = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: hasData ? pkgData.map(p => p.name) : ['No Packages'],
                datasets: [{
                    data: hasData ? pkgData.map(p => Number(p.customer_count || 1)) : [1],
                    backgroundColor: hasData ? colors.slice(0, pkgData.length) : ['#374151'],
                    borderColor: '#0A0E1A',
                    borderWidth: 3
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            color: '#94A3B8',
                            padding: 20,
                            font: { size: 12 }
                        }
                    }
                }
            }
        });

    } catch (error) {
        console.error('Error loading package chart:', error);
    }
}

// ============================================
// WALLET CHART
// ============================================
let walletChartInstance = null;

async function loadWalletChart() {
    try {
        const { data: transactions } = await supabase
            .from('wallet_transactions')
            .select('amount, type, created_at')
            .order('created_at', { ascending: false })
            .limit(30);

        const ctx = DOM.walletChart?.getContext('2d');
        if (!ctx) return;

        if (walletChartInstance) {
            walletChartInstance.destroy();
        }

        const credits = [];
        const debits = [];
        const labels = [];

        if (transactions) {
            const reversed = [...transactions].reverse();
            reversed.forEach(t => {
                labels.push(new Date(t.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
                credits.push(t.type === 'credit' ? Number(t.amount) : 0);
                debits.push(t.type === 'debit' ? Number(t.amount) : 0);
            });
        }

        walletChartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels.length > 0 ? labels : ['No Data'],
                datasets: [
                    {
                        label: 'Credits',
                        data: credits.length > 0 ? credits : [0],
                        backgroundColor: 'rgba(52, 211, 153, 0.6)',
                        borderColor: '#34D399',
                        borderWidth: 1
                    },
                    {
                        label: 'Debits',
                        data: debits.length > 0 ? debits : [0],
                        backgroundColor: 'rgba(248, 113, 113, 0.6)',
                        borderColor: '#F87171',
                        borderWidth: 1
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        labels: {
                            color: '#94A3B8',
                            font: { size: 12 }
                        }
                    }
                },
                scales: {
                    y: {
                        ticks: {
                            color: '#94A3B8',
                            callback: (value) => `KES ${value}`
                        },
                        grid: {
                            color: 'rgba(255, 255, 255, 0.05)'
                        }
                    },
                    x: {
                        ticks: {
                            color: '#94A3B8',
                            maxTicksLimit: 10
                        },
                        grid: {
                            display: false
                        }
                    }
                }
            }
        });

    } catch (error) {
        console.error('Error loading wallet chart:', error);
    }
}

// ============================================
// HOTSPOT CHART
// ============================================
let hotspotChartInstance = null;

async function loadHotspotChart() {
    try {
        const ctx = DOM.hotspotChart?.getContext('2d');
        if (!ctx) return;

        if (hotspotChartInstance) {
            hotspotChartInstance.destroy();
        }

        // Get hotspot data from Supabase or MikroTik
        const { data: sessions } = await supabase
            .from('hotspot_sessions')
            .select('created_at, status')
            .order('created_at', { ascending: false })
            .limit(50);

        const labels = ['Active', 'Expired', 'Suspended'];
        const values = [
            sessions?.filter(s => s.status === 'active').length || 0,
            sessions?.filter(s => s.status === 'expired').length || 0,
            sessions?.filter(s => s.status === 'suspended').length || 0
        ];

        hotspotChartInstance = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: values,
                    backgroundColor: ['#34D399', '#F87171', '#FBBF24'],
                    borderColor: '#0A0E1A',
                    borderWidth: 3
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            color: '#94A3B8',
                            padding: 20,
                            font: { size: 12 }
                        }
                    }
                }
            }
        });

    } catch (error) {
        console.error('Error loading hotspot chart:', error);
    }
}

// ============================================
// BANDWIDTH CHART
// ============================================
let bandwidthChartInstance = null;

async function loadBandwidthChart() {
    try {
        const ctx = DOM.bandwidthChart?.getContext('2d');
        if (!ctx) return;

        if (bandwidthChartInstance) {
            bandwidthChartInstance.destroy();
        }

        // Simulate bandwidth data (replace with real MikroTik data)
        const labels = ['12AM', '4AM', '8AM', '12PM', '4PM', '8PM', 'Now'];
        const download = [10, 5, 30, 80, 60, 90, 45];
        const upload = [5, 2, 15, 40, 30, 45, 20];

        bandwidthChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Download (Mbps)',
                        data: download,
                        borderColor: '#0EA5E9',
                        backgroundColor: 'rgba(14, 165, 233, 0.1)',
                        fill: true,
                        tension: 0.4
                    },
                    {
                        label: 'Upload (Mbps)',
                        data: upload,
                        borderColor: '#14B8A6',
                        backgroundColor: 'rgba(20, 184, 166, 0.1)',
                        fill: true,
                        tension: 0.4
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        labels: {
                            color: '#94A3B8',
                            font: { size: 12 }
                        }
                    }
                },
                scales: {
                    y: {
                        ticks: {
                            color: '#94A3B8',
                            callback: (value) => `${value} Mbps`
                        },
                        grid: {
                            color: 'rgba(255, 255, 255, 0.05)'
                        }
                    },
                    x: {
                        ticks: {
                            color: '#94A3B8'
                        },
                        grid: {
                            display: false
                        }
                    }
                }
            }
        });

    } catch (error) {
        console.error('Error loading bandwidth chart:', error);
    }
}

// ============================================
// NOTIFICATIONS
// ============================================
async function updateNotificationBadge() {
    try {
        const unread = await getUnreadCount();
        if (DOM.notificationBadge) {
            DOM.notificationBadge.textContent = unread;
            DOM.notificationBadge.style.display = unread > 0 ? 'flex' : 'none';
        }
    } catch (error) {
        console.error('Error updating notification badge:', error);
    }
}

// ============================================
// EVENT LISTENERS
// ============================================
function setupEventListeners() {
    // Revenue period change
    DOM.revenuePeriod?.addEventListener('change', (e) => {
        loadRevenueChart(parseInt(e.target.value));
    });

    // Logout
    DOM.logoutBtn?.addEventListener('click', () => {
        AuthService.logout();
    });

    // Refresh
    DOM.refreshBtn?.addEventListener('click', async () => {
        showToast('Refreshing dashboard...', 'info');
        await loadAllDashboardData();
        showToast('Dashboard refreshed!', 'success');
    });

    // Notification bell
    DOM.notificationBell?.addEventListener('click', () => {
        showNotificationPanel();
    });
}

// ============================================
// AUTO REFRESH
// ============================================
function startAutoRefresh() {
    if (state.refreshInterval) {
        clearInterval(state.refreshInterval);
    }
    
    state.refreshInterval = setInterval(() => {
        // Refresh stats, activity, and MikroTik data
        loadStats();
        loadRecentActivity();
        updateNotificationBadge();
        fetchMikroTikStats();
    }, 30000); // Every 30 seconds
}

// ============================================
// UTILITY FUNCTIONS
// ============================================
function showLoadingState() {
    const container = DOM.recentActivity;
    if (container) {
        container.innerHTML = `
            <div class="space-y-3">
                ${[1,2,3,4,5].map(i => `
                    <div class="flex items-center gap-4 p-3 bg-white/5 rounded-lg animate-pulse">
                        <div class="w-10 h-10 bg-white/10 rounded-lg"></div>
                        <div class="flex-1">
                            <div class="h-4 bg-white/10 rounded w-3/4"></div>
                            <div class="h-3 bg-white/10 rounded w-1/2 mt-1"></div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }
}

function showNotificationPanel() {
    const count = DOM.notificationBadge?.textContent || '0';
    showToast(`📬 You have ${count} unread notifications`, 'info');
}

// ============================================
// GLOBAL FUNCTIONS FOR MODALS
// ============================================
window.showAddCustomerModal = function() {
    showToast('Add customer modal coming soon!', 'info');
};

window.closeAddCustomerModal = function() {
    // Close modal logic
};

window.showAddPackageModal = function() {
    showToast('Add package modal coming soon!', 'info');
};

window.closeAddPackageModal = function() {
    // Close modal logic
};

window.showRecordPaymentModal = function() {
    showToast('Record payment modal coming soon!', 'info');
};

window.closeRecordPaymentModal = function() {
    // Close modal logic
};

window.showAddRouterModal = function() {
    showToast('Add router modal coming soon!', 'info');
};

window.closeAddRouterModal = function() {
    // Close modal logic
};

// ============================================
// EXPOSE MODULES TO WINDOW FOR GLOBAL ACCESS
// ============================================
window.OrbitModules = {
    wallet: { loadWalletStats, getWalletTransactions, topUpWallet, withdrawFromWallet },
    tickets: { getTicketStats, loadTickets, updateTicketStatus, createTicket },
    invoices: { loadInvoices, getInvoiceStats, generateInvoice, updateInvoiceStatus },
    notifications: { loadNotifications, markNotificationRead, createNotification, getUnreadCount },
    referrals: { loadReferrals, getReferralStats, createReferral },
    sms: { sendBulkSMS, getSMSStats, loadSMSLogs, sendSingleSMS },
    staff: { loadStaff, updateStaffRole, getStaffStats },
    vouchers: { generateVouchers, getVoucherStats, loadVouchers, redeemVoucher },
    whatsapp: { sendWhatsAppMessage, getWhatsAppStats }
};

// ============================================
// EXPOSE DASHBOARD FUNCTIONS FOR GLOBAL USE
// ============================================
window.refreshDashboard = loadAllDashboardData;
window.viewAllTickets = () => window.location.href = 'tickets.html';
window.viewAllInvoices = () => window.location.href = 'invoices.html';
window.viewAllPayments = () => window.location.href = 'payments.html';

console.log('✅ Dashboard modules loaded successfully!');
console.log('📦 Available modules:', Object.keys(window.OrbitModules));
