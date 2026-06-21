// js/login.js
// Customer Login Page - Standalone

import { AuthService } from './services/auth.service.js';
import { showToast } from './utils/helpers.js';

// ============================================
// DOM ELEMENTS
// ============================================
const loginForm = document.getElementById('loginForm');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const loginError = document.getElementById('loginError');

// ============================================
// CHECK IF ALREADY LOGGED IN
// ============================================
if (AuthService.isAuthenticated()) {
    // Check role and redirect
    const user = AuthService.getCurrentUser();
    const role = user?.profile?.role || 'customer';
    
    if (role === 'admin' || role === 'super_admin') {
        window.location.href = '/orbitnetworks/admin/dashboard.html';
    } else {
        window.location.href = '/orbitnetworks/customer/dashboard.html';
    }
}

// ============================================
// LOGIN FORM HANDLER
// ============================================
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = emailInput.value.trim();
        const password = passwordInput.value;
        
        // Hide previous error
        loginError.classList.add('hidden');
        
        // Validate
        if (!email || !password) {
            loginError.textContent = 'Please fill in all fields';
            loginError.classList.remove('hidden');
            return;
        }
        
        // Show loading state
        const submitBtn = loginForm.querySelector('button[type="submit"]');
        const originalText = submitBtn?.innerHTML || 'Sign In';
        if (submitBtn) {
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Signing in...';
            submitBtn.disabled = true;
        }
        
        try {
            // Attempt login
            const result = await AuthService.login(email, password);
            
            if (result.success) {
                // Check if admin
                if (AuthService.isAdmin()) {
                    window.location.href = '/orbitnetworks/admin/dashboard.html';
                    return;
                }
                
                // Customer - redirect to dashboard
                showToast('Welcome back!', 'success');
                window.location.href = '/orbitnetworks/customer/dashboard.html';
                
            } else {
                // Show error
                loginError.textContent = result.error || 'Invalid email or password';
                loginError.classList.remove('hidden');
                showToast('Login failed: ' + (result.error || 'Invalid credentials'), 'error');
                
                // Reset button
                if (submitBtn) {
                    submitBtn.innerHTML = originalText;
                    submitBtn.disabled = false;
                }
            }
            
        } catch (error) {
            console.error('Login error:', error);
            loginError.textContent = 'An error occurred. Please try again.';
            loginError.classList.remove('hidden');
            showToast('Login error: ' + error.message, 'error');
            
            // Reset button
            if (submitBtn) {
                submitBtn.innerHTML = originalText;
                submitBtn.disabled = false;
            }
        }
    });
}

// ============================================
// ENTER KEY SUPPORT
// ============================================
document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        const submitBtn = loginForm?.querySelector('button[type="submit"]');
        if (submitBtn && document.activeElement?.tagName !== 'BUTTON') {
            submitBtn.click();
        }
    }
});

console.log('🚀 Login page ready');
console.log('📧 Use your customer email to login');
