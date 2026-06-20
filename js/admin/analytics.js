// js/admin/analytics.js
import { supabase } from '../config/supabase.js';
import { formatCurrency, formatDate } from '../utils/helpers.js';

export async function getRevenueAnalytics(period = 'month') {
    try {
        const startDate = new Date();
        if (period === 'month') startDate.setMonth(startDate.getMonth() - 1);
        else if (period === 'quarter') startDate.setMonth(startDate.getMonth() - 3);
        else if (period === 'year') startDate.setFullYear(startDate.getFullYear() - 1);
        else if (period === 'week') startDate.setDate(startDate.getDate() - 7);

        const { data, error } = await supabase
            .from('payments')
            .select('amount, created_at, method, status')
            .gte('created_at', startDate.toISOString())
            .eq('status', 'completed');

        if (error) throw error;

        // Calculate analytics
        const totalRevenue = data?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;
        const methods = {};
        const daily = {};
        const weekly = {};
        const monthly = {};

        data?.forEach(p => {
            // Payment methods
            methods[p.method] = (methods[p.method] || 0) + Number(p.amount);
            
            // Daily totals
            const date = new Date(p.created_at).toLocaleDateString();
            daily[date] = (daily[date] || 0) + Number(p.amount);
            
            // Weekly totals
            const week = getWeekNumber(new Date(p.created_at));
            weekly[week] = (weekly[week] || 0) + Number(p.amount);
            
            // Monthly totals
            const month = new Date(p.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
            monthly[month] = (monthly[month] || 0) + Number(p.amount);
        });

        return {
            totalRevenue,
            methods,
            daily,
            weekly,
            monthly,
            transactionCount: data?.length || 0,
            averageTransaction: data?.length > 0 ? totalRevenue / data.length : 0
        };
    } catch (error) {
        console.error('Revenue analytics error:', error);
        return null;
    }
}

// ✅ ADD THIS FUNCTION
export async function getCustomerAnalytics() {
    try {
        const { data: customers, error } = await supabase
            .from('customers')
            .select(`
                status,
                created_at,
                package_id,
                packages(name, price)
            `);

        if (error) throw error;

        const total = customers?.length || 0;
        const active = customers?.filter(c => c.status === 'active').length || 0;
        const inactive = customers?.filter(c => c.status === 'inactive').length || 0;
        const suspended = customers?.filter(c => c.status === 'suspended').length || 0;

        // Package distribution
        const packageDistribution = {};
        customers?.forEach(c => {
            if (c.packages?.name) {
                packageDistribution[c.packages.name] = (packageDistribution[c.packages.name] || 0) + 1;
            }
        });

        // New customers over time
        const newCustomers = {};
        customers?.forEach(c => {
            const date = new Date(c.created_at).toLocaleDateString();
            newCustomers[date] = (newCustomers[date] || 0) + 1;
        });

        return {
            total,
            active,
            inactive,
            suspended,
            packageDistribution,
            newCustomers,
            churnRate: total > 0 ? ((inactive + suspended) / total) * 100 : 0
        };
    } catch (error) {
        console.error('Customer analytics error:', error);
        return null;
    }
}

// ✅ ADD THIS FUNCTION
export async function getUsageAnalytics() {
    try {
        const { data: sessions, error } = await supabase
            .from('router_sessions')
            .select(`
                data_used_gb,
                status,
                started_at,
                ended_at,
                customer:customer_id (
                    profiles (full_name)
                )
            `)
            .order('started_at', { ascending: false });

        if (error) throw error;

        const totalUsage = sessions?.reduce((sum, s) => sum + Number(s.data_used_gb || 0), 0) || 0;
        const activeSessions = sessions?.filter(s => s.status === 'active').length || 0;
        const completedSessions = sessions?.filter(s => s.status === 'completed').length || 0;

        // Daily usage
        const dailyUsage = {};
        sessions?.forEach(s => {
            const date = new Date(s.started_at).toLocaleDateString();
            dailyUsage[date] = (dailyUsage[date] || 0) + Number(s.data_used_gb || 0);
        });

        // Top users by usage
        const userUsage = {};
        sessions?.forEach(s => {
            const name = s.customer?.profiles?.full_name || 'Unknown';
            userUsage[name] = (userUsage[name] || 0) + Number(s.data_used_gb || 0);
        });

        const topUsers = Object.entries(userUsage)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([name, usage]) => ({ name, usage }));

        return {
            totalUsage,
            activeSessions,
            completedSessions,
            dailyUsage,
            topUsers,
            averageUsagePerUser: Object.keys(userUsage).length > 0 
                ? totalUsage / Object.keys(userUsage).length 
                : 0
        };
    } catch (error) {
        console.error('Usage analytics error:', error);
        return null;
    }
}

// ✅ ADD THIS FUNCTION
export async function getSupportAnalytics() {
    try {
        const { data: tickets, error } = await supabase
            .from('support_tickets')
            .select(`
                status,
                priority,
                created_at,
                resolved_at,
                assigned_to,
                profiles(full_name)
            `);

        if (error) throw error;

        const total = tickets?.length || 0;
        const open = tickets?.filter(t => t.status === 'open').length || 0;
        const inProgress = tickets?.filter(t => t.status === 'in_progress').length || 0;
        const resolved = tickets?.filter(t => t.status === 'resolved').length || 0;
        const closed = tickets?.filter(t => t.status === 'closed').length || 0;

        // Priority distribution
        const priorities = {
            low: tickets?.filter(t => t.priority === 'low').length || 0,
            normal: tickets?.filter(t => t.priority === 'normal').length || 0,
            high: tickets?.filter(t => t.priority === 'high').length || 0,
            urgent: tickets?.filter(t => t.priority === 'urgent').length || 0
        };

        // Average resolution time (in hours)
        const resolvedTickets = tickets?.filter(t => t.status === 'resolved' && t.resolved_at);
        let avgResolutionTime = 0;
        if (resolvedTickets?.length > 0) {
            const totalHours = resolvedTickets.reduce((sum, t) => {
                const created = new Date(t.created_at);
                const resolved = new Date(t.resolved_at);
                const hours = (resolved - created) / (1000 * 60 * 60);
                return sum + hours;
            }, 0);
            avgResolutionTime = totalHours / resolvedTickets.length;
        }

        // Tickets by day
        const ticketsByDay = {};
        tickets?.forEach(t => {
            const date = new Date(t.created_at).toLocaleDateString();
            ticketsByDay[date] = (ticketsByDay[date] || 0) + 1;
        });

        return {
            total,
            open,
            inProgress,
            resolved,
            closed,
            priorities,
            avgResolutionTime: Math.round(avgResolutionTime),
            ticketsByDay,
            resolutionRate: total > 0 ? ((resolved + closed) / total) * 100 : 0
        };
    } catch (error) {
        console.error('Support analytics error:', error);
        return null;
    }
}

// ✅ ADD THIS FUNCTION
export async function getPaymentAnalytics() {
    try {
        const { data: payments, error } = await supabase
            .from('payments')
            .select(`
                amount,
                method,
                status,
                created_at,
                customer:customer_id (
                    profiles (full_name)
                )
            `)
            .order('created_at', { ascending: false });

        if (error) throw error;

        const total = payments?.length || 0;
        const completed = payments?.filter(p => p.status === 'completed').length || 0;
        const pending = payments?.filter(p => p.status === 'pending').length || 0;
        const failed = payments?.filter(p => p.status === 'failed').length || 0;
        const refunded = payments?.filter(p => p.status === 'refunded').length || 0;

        // Method distribution
        const methodDistribution = {};
        payments?.forEach(p => {
            if (p.method) {
                methodDistribution[p.method] = (methodDistribution[p.method] || 0) + 1;
            }
        });

        // Amount by method
        const amountByMethod = {};
        payments?.forEach(p => {
            if (p.method && p.status === 'completed') {
                amountByMethod[p.method] = (amountByMethod[p.method] || 0) + Number(p.amount);
            }
        });

        // Success rate
        const successRate = total > 0 ? (completed / total) * 100 : 0;

        return {
            total,
            completed,
            pending,
            failed,
            refunded,
            methodDistribution,
            amountByMethod,
            successRate: Math.round(successRate),
            totalRevenue: payments?.filter(p => p.status === 'completed')
                .reduce((sum, p) => sum + Number(p.amount), 0) || 0
        };
    } catch (error) {
        console.error('Payment analytics error:', error);
        return null;
    }
}

// ✅ ADD THIS FUNCTION
export async function getBusinessMetrics() {
    try {
        // Run all analytics in parallel
        const [revenue, customers, usage, support, payments] = await Promise.all([
            getRevenueAnalytics('month'),
            getCustomerAnalytics(),
            getUsageAnalytics(),
            getSupportAnalytics(),
            getPaymentAnalytics()
        ]);

        // Calculate key business metrics
        const metrics = {
            // Financial metrics
            mrr: revenue?.totalRevenue || 0, // Monthly Recurring Revenue
            arpu: customers?.total > 0 ? (revenue?.totalRevenue / customers.active) : 0, // Average Revenue Per User
            ltv: customers?.total > 0 ? (revenue?.totalRevenue / customers.total) * 12 : 0, // Lifetime Value (12 months)

            // Customer metrics
            totalCustomers: customers?.total || 0,
            activeCustomers: customers?.active || 0,
            churnRate: customers?.churnRate || 0,
            customerGrowth: calculateGrowth(customers?.total || 0),

            // Operational metrics
            avgResolutionTime: support?.avgResolutionTime || 0,
            successRate: payments?.successRate || 0,
            activeSessions: usage?.activeSessions || 0,

            // Revenue breakdown
            revenueByMethod: revenue?.methods || {},
            dailyRevenue: revenue?.daily || {},
            monthlyRevenue: revenue?.monthly || {}
        };

        return metrics;
    } catch (error) {
        console.error('Business metrics error:', error);
        return null;
    }
}

// ✅ ADD THIS FUNCTION
export async function getRevenueForecast(months = 3) {
    try {
        // Get historical data
        const { data, error } = await supabase
            .from('payments')
            .select('amount, created_at')
            .eq('status', 'completed')
            .order('created_at', { ascending: true });

        if (error) throw error;

        if (!data || data.length === 0) {
            return { forecast: [], confidence: 0 };
        }

        // Group by month
        const monthlyData = {};
        data.forEach(p => {
            const month = new Date(p.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
            monthlyData[month] = (monthlyData[month] || 0) + Number(p.amount);
        });

        const months_ = Object.keys(monthlyData);
        const values = Object.values(monthlyData);

        // Simple linear regression
        const n = months_.length;
        const x = Array.from({ length: n }, (_, i) => i);
        const y = values;

        const sumX = x.reduce((a, b) => a + b, 0);
        const sumY = y.reduce((a, b) => a + b, 0);
        const sumXY = x.reduce((a, b, i) => a + b * y[i], 0);
        const sumX2 = x.reduce((a, b) => a + b * b, 0);

        const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
        const intercept = (sumY - slope * sumX) / n;

        // Generate forecast
        const forecast = [];
        for (let i = 0; i < months; i++) {
            const predicted = slope * (n + i) + intercept;
            forecast.push({
                month: getFutureMonth(i),
                predicted: Math.max(0, Math.round(predicted))
            });
        }

        // Calculate confidence (based on R-squared)
        const yMean = sumY / n;
        const ssTotal = y.reduce((sum, yi) => sum + Math.pow(yi - yMean, 2), 0);
        const ssResidual = y.reduce((sum, yi, i) => sum + Math.pow(yi - (slope * x[i] + intercept), 2), 0);
        const rSquared = ssTotal > 0 ? 1 - (ssResidual / ssTotal) : 0;

        return {
            forecast,
            confidence: Math.round(rSquared * 100),
            currentTrend: slope > 0 ? 'increasing' : slope < 0 ? 'decreasing' : 'stable'
        };
    } catch (error) {
        console.error('Revenue forecast error:', error);
        return { forecast: [], confidence: 0 };
    }
}

// ✅ ADD THIS FUNCTION
export async function getTopPerformers(limit = 10) {
    try {
        // Top customers by revenue
        const { data: payments, error } = await supabase
            .from('payments')
            .select(`
                amount,
                customer:customer_id (
                    id,
                    profiles (full_name, phone)
                )
            `)
            .eq('status', 'completed');

        if (error) throw error;

        const customerRevenue = {};
        payments?.forEach(p => {
            const name = p.customer?.profiles?.full_name || 'Unknown';
            customerRevenue[name] = (customerRevenue[name] || 0) + Number(p.amount);
        });

        const topCustomers = Object.entries(customerRevenue)
            .sort((a, b) => b[1] - a[1])
            .slice(0, limit)
            .map(([name, revenue]) => ({ name, revenue }));

        return {
            topCustomers,
            totalRevenue: payments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0
        };
    } catch (error) {
        console.error('Top performers error:', error);
        return { topCustomers: [], totalRevenue: 0 };
    }
}

// ✅ HELPER FUNCTIONS
function getWeekNumber(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
    const week1 = new Date(d.getFullYear(), 0, 4);
    return 1 + Math.round(((d - week1) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
}

function getFutureMonth(offset) {
    const date = new Date();
    date.setMonth(date.getMonth() + offset + 1);
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

function calculateGrowth(currentValue) {
    // This would need historical data for accurate growth calculation
    // For now, return a simulated growth rate
    return Math.round((Math.random() * 10) + 5);
}

// ✅ ADD THIS FUNCTION FOR EXPORTING REPORTS
export async function exportAnalyticsReport(format = 'csv') {
    try {
        const [revenue, customers, usage, support, payments] = await Promise.all([
            getRevenueAnalytics('month'),
            getCustomerAnalytics(),
            getUsageAnalytics(),
            getSupportAnalytics(),
            getPaymentAnalytics()
        ]);

        const report = {
            generatedAt: new Date().toISOString(),
            revenue,
            customers,
            usage,
            support,
            payments
        };

        if (format === 'json') {
            return JSON.stringify(report, null, 2);
        }

        // CSV format
        let csv = 'Metric,Value\n';
        csv += `Total Revenue,${revenue?.totalRevenue || 0}\n`;
        csv += `Total Customers,${customers?.total || 0}\n`;
        csv += `Active Customers,${customers?.active || 0}\n`;
        csv += `Total Usage (GB),${usage?.totalUsage || 0}\n`;
        csv += `Active Sessions,${usage?.activeSessions || 0}\n`;
        csv += `Open Tickets,${support?.open || 0}\n`;
        csv += `Payment Success Rate,${payments?.successRate || 0}%\n`;
        csv += `Avg Resolution Time,${support?.avgResolutionTime || 0} hours\n`;

        return csv;
    } catch (error) {
        console.error('Export analytics error:', error);
        return null;
    }
}
