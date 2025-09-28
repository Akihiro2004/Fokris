// Settings page functionality

// Global variables for account management
let allAccounts = [];

// Load all accounts from Firestore
const loadAccounts = async () => {
    try {
        const snapshot = await db.collection('accounts').where('isActive', '==', true).orderBy('createdAt').get();
        allAccounts = [];
        
        snapshot.forEach(doc => {
            const account = { id: doc.id, ...doc.data() };
            allAccounts.push(account);
        });
        
        return allAccounts;
    } catch (error) {
        console.error('Error loading accounts:', error);
        return [];
    }
};

// Load and display accounts in table
const loadAccountTable = async () => {
    if (userRole !== 'admin') return;
    
    try {
        await loadAccounts();
        
        const tableBody = document.getElementById('accountTableBody');
        if (!tableBody) return;
        
        if (allAccounts.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="4" class="px-6 py-4 text-center text-gray-500">
                        Tidak ada akun ditemukan
                    </td>
                </tr>
            `;
            return;
        }
        
        const tableHTML = allAccounts.map(account => `
            <tr class="hover:bg-gray-50">
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    ${account.name}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    ${account.bankNumber || '-'}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                        Aktif
                    </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div class="flex space-x-2">
                        <button onclick="editAccount('${account.id}')" class="text-blue-600 hover:text-blue-900 text-sm font-medium">
                            Edit
                        </button>
                        <button onclick="deactivateAccount('${account.id}')" class="text-red-600 hover:text-red-900 text-sm font-medium">
                            Nonaktifkan
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
        
        tableBody.innerHTML = tableHTML;
        
    } catch (error) {
        console.error('Error loading account table:', error);
    }
};

// Add account using prompt
const showAddAccountModal = () => {
    if (userRole !== 'admin') {
        alert('Akses ditolak. Fitur ini hanya untuk admin.');
        return;
    }
    
    const accountName = prompt('Masukkan nama akun baru:');
    if (accountName && accountName.trim()) {
        const bankNumber = prompt('Masukkan nomor bank (opsional):') || '';
        addAccount(accountName.trim(), bankNumber.trim());
    }
};

// Add new account
const addAccount = async (name, bankNumber) => {
    try {
        const accountData = {
            name: name,
            bankNumber: bankNumber,
            isActive: true,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        await db.collection('accounts').add(accountData);
        alert('Akun berhasil ditambahkan!');
        await loadAccountTable();
        
    } catch (error) {
        console.error('Error adding account:', error);
        alert('Terjadi kesalahan saat menambah akun: ' + error.message);
    }
};

// Edit account using prompt
const editAccount = (accountId) => {
    if (userRole !== 'admin') {
        alert('Akses ditolak. Fitur ini hanya untuk admin.');
        return;
    }
    
    const account = allAccounts.find(acc => acc.id === accountId);
    if (!account) {
        alert('Akun tidak ditemukan');
        return;
    }
    
    const newName = prompt(`Edit nama akun "${account.name}":`, account.name);
    if (newName && newName.trim() && newName.trim() !== account.name) {
        const newBankNumber = prompt(`Edit nomor bank "${account.name}":`, account.bankNumber || '');
        updateAccount(accountId, newName.trim(), newBankNumber ? newBankNumber.trim() : '');
    }
};

// Update account
const updateAccount = async (accountId, name, bankNumber) => {
    try {
        const updatedData = {
            name: name,
            bankNumber: bankNumber,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        await db.collection('accounts').doc(accountId).update(updatedData);
        alert('Akun berhasil diupdate!');
        await loadAccountTable();
        
    } catch (error) {
        console.error('Error updating account:', error);
        alert('Terjadi kesalahan saat mengupdate akun: ' + error.message);
    }
};

// Soft delete account (deactivate)
const deactivateAccount = async (accountId) => {
    if (userRole !== 'admin') {
        alert('Akses ditolak. Fitur ini hanya untuk admin.');
        return;
    }
    
    const account = allAccounts.find(acc => acc.id === accountId);
    if (!account) {
        alert('Akun tidak ditemukan');
        return;
    }
    
    if (confirm(`Apakah Anda yakin ingin menonaktifkan akun "${account.name}"? Akun ini akan disembunyikan dari sistem.`)) {
        try {
            await db.collection('accounts').doc(accountId).update({
                isActive: false,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            alert('Akun berhasil dinonaktifkan!');
            await loadAccountTable();
            
        } catch (error) {
            console.error('Error deactivating account:', error);
            alert('Terjadi kesalahan saat menonaktifkan akun: ' + error.message);
        }
    }
};

// Load and display categories in table
const loadCategoryTable = async () => {
    if (userRole !== 'admin') return;
    
    try {
        await loadCategories();
        
        const tableBody = document.getElementById('categoryTableBody');
        if (!tableBody) return;
        
        if (allCategories.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="4" class="px-6 py-4 text-center text-gray-500">
                        Tidak ada kategori ditemukan
                    </td>
                </tr>
            `;
            return;
        }
        
        // Sort categories by index for proper hierarchical display
        const sortedCategories = [...allCategories].sort((a, b) => {
            const aIndex = a.index.split('.').map(n => parseInt(n)).reduce((acc, n, i) => acc + n * Math.pow(1000, 10-i), 0);
            const bIndex = b.index.split('.').map(n => parseInt(n)).reduce((acc, n, i) => acc + n * Math.pow(1000, 10-i), 0);
            return aIndex - bIndex;
        });
        
        const tableHTML = sortedCategories.map(category => {
            // Create indentation based on level
            const indent = '&nbsp;'.repeat((category.level - 1) * 4);
            const canAddSubCategory = category.level < 5;
            
            return `
                <tr class="hover:bg-gray-50">
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        ${category.index}
                    </td>
                    <td class="px-6 py-4 text-sm text-gray-900">
                        <div class="flex items-center">
                            <span style="color: #6B7280;">${indent}</span>
                            <span class="max-w-xs truncate" title="${category.name}">
                                ${category.name}
                            </span>
                        </div>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        Level ${category.level}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div class="flex space-x-2">
                            <button onclick="editCategory('${category.id}')" class="text-blue-600 hover:text-blue-900 text-sm font-medium">
                                Edit
                            </button>
                            ${canAddSubCategory ? `
                                <button onclick="addSubCategory('${category.id}')" class="text-green-600 hover:text-green-900 text-sm font-medium">
                                    Tambah Sub
                                </button>
                            ` : ''}
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
        
        tableBody.innerHTML = tableHTML;
        
    } catch (error) {
        console.error('Error loading category table:', error);
    }
};

// Add root category using prompt
const showAddCategoryModal = () => {
    if (userRole !== 'admin') {
        alert('Akses ditolak. Fitur ini hanya untuk admin.');
        return;
    }
    
    const categoryName = prompt('Masukkan nama kategori baru:');
    if (categoryName && categoryName.trim()) {
        addRootCategory(categoryName.trim());
    }
};

// Add root category
const addRootCategory = async (categoryName) => {
    try {
        // Find next available root index
        const rootCategories = allCategories.filter(cat => cat.level === 1);
        const maxIndex = rootCategories.length > 0 ? Math.max(...rootCategories.map(cat => parseInt(cat.index))) : 0;
        const newIndex = maxIndex + 1;
        
        const categoryData = {
            name: categoryName,
            level: 1,
            parentId: null,
            index: newIndex.toString(),
            fullName: `${newIndex}. ${categoryName}`
        };
        
        await addCategory(categoryData);
        alert('Kategori berhasil ditambahkan!');
        await loadCategoryTable();
        
    } catch (error) {
        console.error('Error adding root category:', error);
        alert('Terjadi kesalahan saat menambah kategori: ' + error.message);
    }
};

// Add sub-category
const addSubCategory = async (parentId) => {
    if (userRole !== 'admin') {
        alert('Akses ditolak. Fitur ini hanya untuk admin.');
        return;
    }
    
    const parent = getCategoryById(parentId);
    if (!parent) {
        alert('Parent kategori tidak ditemukan');
        return;
    }
    
    if (parent.level >= 5) {
        alert('Maksimal 5 level kategori');
        return;
    }
    
    const categoryName = prompt(`Masukkan nama sub-kategori untuk "${parent.fullName}":`);
    if (categoryName && categoryName.trim()) {
        try {
            // Find next available sub-index for this parent
            const siblings = allCategories.filter(cat => cat.parentId === parentId);
            const maxSubIndex = siblings.length > 0 ? Math.max(...siblings.map(cat => {
                const parts = cat.index.split('.');
                return parseInt(parts[parts.length - 1]) || 0;
            })) : 0;
            
            const newSubIndex = maxSubIndex + 1;
            const newIndex = `${parent.index}.${newSubIndex}`;
            
            const categoryData = {
                name: categoryName.trim(),
                level: parent.level + 1,
                parentId: parentId,
                index: newIndex,
                fullName: `${newIndex}. ${categoryName.trim()}`
            };
            
            await addCategory(categoryData);
            alert('Sub-kategori berhasil ditambahkan!');
            await loadCategoryTable();
            
        } catch (error) {
            console.error('Error adding sub-category:', error);
            alert('Terjadi kesalahan saat menambah sub-kategori: ' + error.message);
        }
    }
};


// Edit category using prompt
const editCategory = (categoryId) => {
    if (userRole !== 'admin') {
        alert('Akses ditolak. Fitur ini hanya untuk admin.');
        return;
    }
    
    const category = getCategoryById(categoryId);
    if (!category) {
        alert('Kategori tidak ditemukan');
        return;
    }
    
    const newName = prompt(`Edit nama kategori "${category.fullName}":`, category.name);
    if (newName && newName.trim() && newName.trim() !== category.name) {
        updateCategoryName(categoryId, newName.trim());
    }
};

// Update category name
const updateCategoryName = async (categoryId, newName) => {
    try {
        const category = getCategoryById(categoryId);
        if (!category) {
            alert('Kategori tidak ditemukan');
            return;
        }
        
        // Update the category with new name and fullName
        const updatedData = {
            name: newName,
            fullName: `${category.index}. ${newName}`,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        await db.collection('categories').doc(categoryId).update(updatedData);
        alert('Kategori berhasil diupdate!');
        await loadCategoryTable();
        
    } catch (error) {
        console.error('Error updating category:', error);
        alert('Terjadi kesalahan saat mengupdate kategori: ' + error.message);
    }
};

// Hide edit category modal
const hideEditCategoryModal = () => {
    const modal = document.getElementById('editCategoryModal');
    const form = document.getElementById('editCategoryForm');
    
    if (modal) {
        modal.classList.add('hidden');
    }
    
    if (form) {
        form.reset();
    }
};



// Initialize settings page
const initializeSettingsPage = async () => {
    try {
        // Load categories and accounts
        await loadCategories();
        await loadAccounts();
        
        // Load admin-specific data
        if (userRole === 'admin') {
            await loadAccountTable();
            await loadCategoryTable();
        }
        
    } catch (error) {
        console.error('Error initializing settings page:', error);
    }
};

// Make functions globally available
window.showAddCategoryModal = showAddCategoryModal;
window.editCategory = editCategory;
window.addSubCategory = addSubCategory;
window.showAddAccountModal = showAddAccountModal;
window.editAccount = editAccount;
window.deactivateAccount = deactivateAccount;

// Initialize when DOM is ready - initializeSettingsPage will be called by auth system
document.addEventListener('DOMContentLoaded', () => {
    // Page initialization will be handled by auth system
});

