import { supabase } from '../config/supabase.js';
import { AuthService } from '../services/auth.service.js';
import { showToast } from '../utils/helpers.js';

// Check authentication
if (!AuthService.isAuthenticated() || !AuthService.isAdmin()) {
    window.location.href = '/';
}

// Initialize dashboard
document.addEventListener('DOMContentLoaded', async () => {
    const user = AuthService.getCurrentUser();
    document.getElementById('adminName').textContent = user?.profile?.full_name || 'Admin';

    await loadStats();
    await loadCharts();
    await loadRecentActivity();

    // Setup logout
    document.getElementById('adminLogoutBtn').addEventListener('click', () => {
        AuthService.logout();
    });

    // Setup revenue period change
    document.getElementById('revenuePeriod').addEventListener('change', (e) => {
        loadRevenueChart(e.target.value);
    });
});

// Load statistics
async function loadStats() {
    try {
        // Total customers
        const { count: totalCustomers } = await supabase
            .from('customers')
            .select('*', { count: 'exact', head: true });
        
        document.getElementById('totalCustomers').textContent = totalCustomers || 0;
        document.getElementById('customerCount').textContent = totalCustomers || 0;

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
        document.getElementById('monthlyRevenue').textContent = `KES ${monthlyRevenue.toFixed(2)}`;

        // Active users (simulated - would need real-time data)
        const activeUsers = Math.floor(Math.random() * 50) + 10;
        document.getElementById('activeUsers').textContent = activeUsers;

        // Routers online
        const { data: routers, error: routerError } = await supabase
            .from('routers')
            .select('status');

        if (!routerError) {
            const online = routers.filter(r => r.status === 'online').length;
            document.getElementById('routersOnline').textContent = online;
        }

    } catch (error) {
        console.error('Error loading stats:', error);
        showToast('Error loading dashboard statistics', 'error');
    }
}

// Load charts
let revenueChartInstance = null;
let packageChartInstance = null;

async function loadCharts() {
    await loadRevenueChart(30);
    await loadPackageChart();
}

async function loadRevenueChart(days = 30) {
    try {
        // Get revenue data for the period
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        startDate.setHours(0, 0, 0, 0);

        const { data: payments } = await supabase
            .from('payments')
            .select('amount, created_at')
            .gte('created_at', startDate.toISOString())
            .eq('status', 'completed');

        // Group by day
        const dailyData = {};
        const labels = [];
        const values = [];

        // Create date range
        for (let i = 0; i < days; i++) {
            const date = new Date(startDate);
            date.setDate(date.getDate() + i);
            const key = date.toISOString().split('T')[0];
            labels.push(key);
            dailyData[key] = 0;
        }

        // Fill data
        if (payments) {
            payments.forEach(p => {
                const date = new Date(p.created_at).toISOString().split('T')[0];
                if (dailyData[date] !== undefined) {
                    dailyData[date] += Number(p.amount);
                }
            });
        }

        // Get values in order
        labels.forEach(key => {
            values.push(dailyData[key] || 0);
        });

        const ctx = document.getElementById('revenueChart').getContext('2d');

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
                    borderColor: '#6366f1',
                    backgroundColor: 'rgba(99, 102, 241, 0.1)',
                    fill: true,
                    tension: 0.4,
                    pointBackgroundColor: '#6366f1'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        labels: {
                            color: '#9ca3af'
                        }
                    }
                },
                scales: {
                    y: {
                        ticks: {
                            color: '#9ca3af',
                            callback: (value) => `KES ${value}`
                        },
                        grid: {
                            color: 'rgba(255, 255, 255, 0.05)'
                        }
                    },
                    x: {
                        ticks: {
                            color: '#9ca3af',
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

async function loadPackageChart() {
    try {
        const { data: packages } = await supabase
            .from('packages')
            .select('name, price');

        const ctx = document.getElementById('packageChart').getContext('2d');

        if (packageChartInstance) {
            packageChartInstance.destroy();
        }

        const colors = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981'];

        packageChartInstance = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: packages?.map(p => p.name) || ['No Packages'],
                datasets: [{
                    data: packages?.map(p => Number(p.price)) || [1],
                    backgroundColor: colors.slice(0, packages?.length || 1),
                    borderColor: '#1a1a2e',
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            color: '#9ca3af',
                            padding: 20
                        }
                    }
                }
            }
        });

    } catch (error) {
        console.error('Error loading package chart:', error);
    }
}

// Load recent activity
async function loadRecentActivity() {
    try {
        const { data: activities } = await supabase
            .from('activity_logs')
            .select('*, profiles(full_name)')
            .order('created_at', { ascending: false })
            .limit(10);

        const container = document.getElementById('adminRecentActivity');

        if (!activities || activities.length === 0) {
            container.innerHTML = `
                <div class="text-center text-gray-400 py-8">
                    <i class="fas fa-inbox text-3xl mb-2"></i>
                    <p>No recent activity</p>
                </div>
            `;
            return;
        }

        container.innerHTML = activities.map(activity => {
            const date = new Date(activity.created_at);
            const timeAgo = getTimeAgo(date);
            const actionIcons = {
                'customer_created': 'fa-user-plus text-blue-400',
                'payment_received': 'fa-money-bill-wave text-green-400',
                'package_created': 'fa-box text-purple-400',
                'router_added': 'fa-router text-cyan-400',
                'ticket_created': 'fa-ticket text-yellow-400'
            };
            const icon = actionIcons[activity.action] || 'fa-circle text-gray-400';

            return `
                <div class="flex items-center gap-4 p-3 bg-white/5 rounded-lg">
                    <div class="w-10 h-10 bg-white/5 rounded-lg flex items-center justify-center">
                        <i class="fas ${icon}"></i>
                    </div>
                    <div class="flex-1">
                        <p class="text-sm text-white">${activity.action.replace(/_/g, ' ').toUpperCase()}</p>
                        <p class="text-xs text-gray-400">
                            ${activity.profiles?.full_name || 'System'} • ${timeAgo}
                        </p>
                    </div>
                </div>
            `;
        }).join('');

    } catch (error) {
        console.error('Error loading recent activity:', error);
    }
}

// Helper: Get time ago
function getTimeAgo(date) {
    const now = new Date();
    const diff = Math.floor((now - date) / 1000);
    
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    return date.toLocaleDateString();
}
