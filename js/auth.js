let currentUser = null;
let userRole = null;
let authListenerInitialized = false;

const checkAuthAndRedirect = () => {
    if (authListenerInitialized) {
        return;
    }
    authListenerInitialized = true;
    
    auth.onAuthStateChanged(async (user) => {
        const currentPage = window.location.pathname.split('/').pop() || 'index.html';
        
        if (user) {
            currentUser = user;
            
            try {
                const userDoc = await db.collection('users').doc(user.uid).get();
                if (userDoc.exists) {
                    userRole = userDoc.data().role;
                } else {
                    // Determine role based on email
                    if (user.email === 'admin@forkris.com') {
                        userRole = 'admin';
                    } else if (user.email === 'guest@forkris.com') {
                        userRole = 'guest';
                    } else {
                        userRole = 'guest';
                    }
                    
                    await db.collection('users').doc(user.uid).set({
                        email: user.email,
                        role: userRole,
                        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                        lastLogin: firebase.firestore.FieldValue.serverTimestamp()
                    });
                }
                
                if ((currentPage === 'index.html' || currentPage === '') && window.location.href.indexOf('home.html') === -1) {
                    setTimeout(() => {
                        window.location.href = 'home.html';
                    }, 100);
                    return;
                }
                
                updateUserInfoDisplays();
                
                setTimeout(() => {
                    if (typeof initializePage === 'function') {
                        initializePage();
                    } else if (typeof initializeTransactionForm === 'function') {
                        initializeTransactionForm();
                    } else if (typeof initializeSettingsPage === 'function') {
                        initializeSettingsPage();
                    } else if (typeof initializeExtractPage === 'function') {
                        initializeExtractPage();
                    }
                }, 200);
                
            } catch (error) {
                console.error('Error fetching user role:', error);
                userRole = 'guest';
                updateUserInfoDisplays();
            }
        } else {
            currentUser = null;
            userRole = null;
            
            if (currentPage !== 'index.html' && currentPage !== '') {
                setTimeout(() => {
                    window.location.href = 'index.html';
                }, 100);
            }
        }
    });
};

const handleLogin = async (event) => {
    event.preventDefault();
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const errorMessage = document.getElementById('errorMessage');
    const errorText = document.getElementById('errorText');
    const submitButton = event.target.querySelector('button[type="submit"]');
    
    // Hide previous errors
    if (errorMessage) {
        errorMessage.classList.add('hidden');
    }
    
    // Disable submit button
    if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = 'Signing in...';
    }
    
    try {
        // Check if the email is allowed
        const allowedEmails = ['admin@forkris.com', 'guest@forkris.com'];
        if (!allowedEmails.includes(email)) {
            throw new Error('Email tidak diizinkan. Gunakan admin@forkris.com atau guest@forkris.com');
        }
        
        // Try to sign in with the actual password entered by user
        await auth.signInWithEmailAndPassword(email, password);
        
    } catch (error) {
        console.error('Login error:', error);
        
        // Show error message
        if (errorMessage && errorText) {
            let errorMsg = 'Terjadi kesalahan saat login';
            
            switch (error.code) {
                case 'auth/user-not-found':
                    errorMsg = 'Pengguna tidak ditemukan. Akun akan dibuat secara otomatis.';
                    // Try to create the account with the password entered by user
                    try {
                        await auth.createUserWithEmailAndPassword(email, password);
                        return; // Let onAuthStateChanged handle the redirect
                    } catch (createError) {
                        errorMsg = 'Gagal membuat akun: ' + createError.message;
                    }
                    break;
                case 'auth/wrong-password':
                    errorMsg = 'Password salah. Periksa kembali password Anda.';
                    break;
                case 'auth/invalid-email':
                    errorMsg = 'Format email tidak valid';
                    break;
                case 'auth/too-many-requests':
                    errorMsg = 'Terlalu banyak percobaan login. Coba lagi nanti.';
                    break;
                default:
                    errorMsg = error.message;
            }
            
            errorText.textContent = errorMsg;
            errorMessage.classList.remove('hidden');
        }
    } finally {
        // Re-enable submit button
        if (submitButton) {
            submitButton.disabled = false;
            submitButton.textContent = 'Sign in';
        }
    }
};

// Update user info displays across the app
const updateUserInfoDisplays = () => {
    const userInfoElements = document.querySelectorAll('#userInfo');
    const userEmailElements = document.querySelectorAll('#userEmail');
    const userRoleElements = document.querySelectorAll('#userRole');
    
    if (currentUser) {
        const displayText = `${currentUser.email} (${userRole})`;
        
        userInfoElements.forEach(element => {
            element.textContent = displayText;
        });
        
        userEmailElements.forEach(element => {
            element.textContent = currentUser.email;
        });
        
        userRoleElements.forEach(element => {
            element.textContent = userRole;
        });
        
        // Show/hide admin-only elements
        const adminElements = document.querySelectorAll('[data-admin-only]');
        adminElements.forEach(element => {
            if (userRole === 'admin') {
                element.style.display = 'block';
                element.classList.remove('hidden');
            } else {
                element.style.display = 'none';
                element.classList.add('hidden');
            }
        });
        
        // Show admin sections in settings (additional check)
        if (userRole === 'admin') {
            const rekeningSection = document.getElementById('rekeningSection');
            const categorySection = document.getElementById('categorySection');
            
            if (rekeningSection) {
                rekeningSection.style.display = 'block';
                rekeningSection.classList.remove('hidden');
            }
            if (categorySection) {
                categorySection.style.display = 'block';
                categorySection.classList.remove('hidden');
            }
        }
    }
};

// Logout function
const logout = async () => {
    try {
        await auth.signOut();
        window.location.href = 'index.html';
    } catch (error) {
        console.error('Logout error:', error);
        alert('Error signing out: ' + error.message);
    }
};

// Check user permission for actions
const hasPermission = (action) => {
    if (!currentUser || !userRole) {
        return false;
    }
    
    switch (action) {
        case 'add-transaction':
            return true; // Both admin and guest can add transactions
        case 'edit-category':
        case 'add-category':
        case 'edit-settings':
            return userRole === 'admin';
        case 'view-transactions':
            return true; // Both can view
        default:
            return false;
    }
};

// Require authentication for protected pages
const requireAuth = () => {
    // Don't redirect here - let the auth state listener handle redirects
    return !!currentUser;
};

// Require admin role for admin-only actions
const requireAdmin = () => {
    if (!requireAuth()) {
        return false;
    }
    
    if (userRole !== 'admin') {
        alert('Akses ditolak. Fitur ini hanya untuk admin.');
        return false;
    }
    
    return true;
};

// Initialize authentication
document.addEventListener('DOMContentLoaded', () => {
    // Set up login form if it exists
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
    
    // Initialize auth state checking
    checkAuthAndRedirect();
});

// Make functions globally available
window.logout = logout;
window.hasPermission = hasPermission;
window.requireAuth = requireAuth;
window.requireAdmin = requireAdmin;

