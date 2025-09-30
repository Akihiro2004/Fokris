// Firebase configuration using environment variables
const firebaseConfig = {
    apiKey: ENV_CONFIG.FIREBASE_API_KEY,
    authDomain: ENV_CONFIG.FIREBASE_AUTH_DOMAIN,
    projectId: ENV_CONFIG.FIREBASE_PROJECT_ID,
    storageBucket: ENV_CONFIG.FIREBASE_STORAGE_BUCKET,
    messagingSenderId: ENV_CONFIG.FIREBASE_MESSAGING_SENDER_ID,
    appId: ENV_CONFIG.FIREBASE_APP_ID,
    measurementId: ENV_CONFIG.FIREBASE_MEASUREMENT_ID
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Initialize Firebase services
const auth = firebase.auth();
const db = firebase.firestore();

// Initialize default admin settings only
const initializeAdminSettings = async () => {
    try {
        const settingsRef = db.collection('settings').doc('admin');
        const settingsDoc = await settingsRef.get();
        
        if (!settingsDoc.exists) {
            await settingsRef.set({
                noRekening: '',
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        }
    } catch (error) {
        console.error('Error initializing admin settings:', error);
    }
};

// Initialize default accounts
const initializeDefaultAccounts = async () => {
    try {
        const accountsSnapshot = await db.collection('accounts').limit(1).get();
        
        // Only create default accounts if none exist
        if (accountsSnapshot.empty) {
            const defaultAccounts = [
                {
                    name: 'Kas Tunai',
                    bankNumber: '',
                    isActive: true,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                },
                {
                    name: 'Kas Bank (Kas Lingkungan)',
                    bankNumber: '',
                    isActive: true,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                },
                {
                    name: 'Kas Bank (Dana Sosial)',
                    bankNumber: '',
                    isActive: true,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                }
            ];

            const batch = db.batch();
            defaultAccounts.forEach(account => {
                const ref = db.collection('accounts').doc();
                batch.set(ref, account);
            });
            
            await batch.commit();
        }
    } catch (error) {
        console.error('Error initializing default accounts:', error);
    }
};

// Initialize admin settings and accounts when admin logs in
firebase.auth().onAuthStateChanged(async (user) => {
    if (user && user.email === 'admin@forkris.com') {
        await initializeAdminSettings();
        await initializeDefaultAccounts();
    }
});

// Utility functions
const formatCurrency = (amount) => {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(amount);
};

const formatDate = (date) => {
    if (date && date.toDate) {
        return date.toDate().toLocaleDateString('id-ID');
    } else if (date instanceof Date) {
        return date.toLocaleDateString('id-ID');
    } else if (typeof date === 'string') {
        return new Date(date).toLocaleDateString('id-ID');
    }
    return '-';
};

const getMonthYearString = (date) => {
    if (date && date.toDate) {
        const d = date.toDate();
        return d.toLocaleDateString('id-ID', { year: 'numeric', month: 'long' });
    } else if (date instanceof Date) {
        return date.toLocaleDateString('id-ID', { year: 'numeric', month: 'long' });
    } else if (typeof date === 'string') {
        const d = new Date(date);
        return d.toLocaleDateString('id-ID', { year: 'numeric', month: 'long' });
    }
    return '-';
};

// Global error handler
window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
});

// Forkris Accounting System - Ready