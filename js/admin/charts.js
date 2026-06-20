// /orbitnetworks/js/admin/charts.js
import { supabase } from '../supabase-client.js'

export async function getRevenueData(days = 30) {
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)
    
    const { data } = await supabase
        .from('payments')
        .select('amount, created_at')
        .eq('status', 'completed')
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: true })
    
    // Group by date
    const grouped = data?.reduce((acc, payment) => {
        const date = new Date(payment.created_at).toLocaleDateString()
        acc[date] = (acc[date] || 0) + Number(payment.amount)
        return acc
    }, {})
    
    return {
        labels: Object.keys(grouped || {}),
        values: Object.values(grouped || {})
    }
}

export async function getPackageDistribution() {
    const { data } = await supabase
        .from('customers')
        .select('package_id, packages(name)')
        .not('package_id', 'is', null)
        .eq('status', 'active')
    
    const distribution = data?.reduce((acc, customer) => {
        const name = customer.packages?.name || 'Unknown'
        acc[name] = (acc[name] || 0) + 1
        return acc
    }, {})
    
    return {
        labels: Object.keys(distribution || {}),
        values: Object.values(distribution || {})
    }
}
