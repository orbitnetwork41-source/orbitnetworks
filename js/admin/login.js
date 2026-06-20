// js/admin/login.js
import { AuthService } from '../services/auth.service.js';
import { showToast } from '../utils/helpers.js';

document.getElementById('adminLoginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('adminEmail').value;
    const password = document.getElementById('adminPassword').value;
    
    const result = await AuthService.login(email, password);
    
    if (result.success) {
        // Check if user has admin role
        if (AuthService.isAdmin()) {
            window.location.href = '/orbitnetworks/admin/dashboard.html';
        } else {
            document.getElementById('adminLoginError').textContent = 'You do not have admin access.';
            document.getElementById('adminLoginError').classList.remove('hidden');
            showToast('Access denied. Admin privileges required.', 'error');
        }
    } else {
        document.getElementById('adminLoginError').textContent = result.error;
        document.getElementById('adminLoginError').classList.remove('hidden');
        showToast('Login failed: ' + result.error, 'error');
    }
});
