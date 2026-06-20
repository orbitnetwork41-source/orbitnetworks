// js/utils/helpers.js

// ============================================================
// TOAST NOTIFICATIONS
// ============================================================
export function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) {
        const newContainer = document.createElement('div');
        newContainer.id = 'toastContainer';
        newContainer.className = 'fixed top-4 right-4 z-[100] space-y-2';
        document.body.appendChild(newContainer);
    }
    
    const toast = document.createElement('div');
    const colors = {
        success: 'bg-green-500/90',
        error: 'bg-red-500/90',
        info: 'bg-blue-500/90',
        warning: 'bg-yellow-500/90 text-black'
    };
    
    const icons = {
        success: 'fa-check-circle',
        error: 'fa-exclamation-circle',
        info: 'fa-info-circle',
        warning: 'fa-exclamation-triangle'
    };
    
    toast.className = `${colors[type] || colors.info} text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-3 transition-all duration-300`;
    if (type === 'warning') {
        toast.className = toast.className.replace('text-white', 'text-black');
    }
    
    toast.innerHTML = `
        <i class="fas ${icons[type] || icons.info}"></i>
        <span>${message}</span>
        <button onclick="this.parentElement.remove()" class="ml-auto hover:opacity-70">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    document.getElementById('toastContainer').appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// ============================================================
// TIME AGO
// ============================================================
export function getTimeAgo(date) {
    if (!date) return 'Never';
    
    const now = new Date();
    const past = new Date(date);
    const diff = Math.floor((now - past) / 1000);
    
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    if (diff < 2592000) return `${Math.floor(diff / 604800)}w ago`;
    if (diff < 31536000) return `${Math.floor(diff / 2592000)}mo ago`;
    return `${Math.floor(diff / 31536000)}y ago`;
}

// ============================================================
// CURRENCY FORMATTING - FIXED!
// ============================================================
export function formatCurrency(amount, currency = 'KES') {
    // Handle null, undefined, or invalid values
    if (amount === undefined || amount === null || amount === '') {
        return currency === 'KES' ? 'KES 0.00' : '$0.00';
    }
    
    // Parse string numbers
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    
    // Check if it's a valid number
    if (isNaN(numAmount)) {
        return currency === 'KES' ? 'KES 0.00' : '$0.00';
    }
    
    // Format based on currency
    try {
        return new Intl.NumberFormat('en-KE', {
            style: 'currency',
            currency: currency,
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(numAmount);
    } catch (e) {
        // Fallback if currency code is invalid
        return `${currency} ${numAmount.toFixed(2)}`;
    }
}

// ============================================================
// ADDITIONAL USEFUL HELPERS
// ============================================================

// Format date
export function formatDate(date, format = 'medium') {
    if (!date) return 'N/A';
    const d = new Date(date);
    if (isNaN(d.getTime())) return 'Invalid Date';
    
    const options = {
        short: { month: 'short', day: 'numeric', year: 'numeric' },
        medium: { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' },
        long: { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }
    };
    
    return d.toLocaleDateString('en-KE', options[format] || options.medium);
}

// Get initials from name
export function getInitials(name) {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Truncate text
export function truncateText(text, maxLength = 50) {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength) + '...';
}

// Generate random ID
export function generateId(length = 8) {
    return Math.random().toString(36).substring(2, 2 + length);
}

// Debounce function
export function debounce(fn, delay = 300) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => fn.apply(this, args), delay);
    };
}

// ============================================================
// DEFAULT EXPORT (for convenience)
// ============================================================
export default {
    showToast,
    getTimeAgo,
    formatCurrency,
    formatDate,
    getInitials,
    truncateText,
    generateId,
    debounce
};
