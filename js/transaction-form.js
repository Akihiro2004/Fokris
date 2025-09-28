// Transaction form functionality
let selectedCategory = null;
let allAccounts = [];

// Load accounts from Firestore
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

// Populate account dropdown
const populateAccountDropdown = async () => {
    try {
        await loadAccounts();
        
        const accountSelect = document.getElementById('accountId');
        if (!accountSelect) return;
        
        // Clear existing options except the first one
        accountSelect.innerHTML = '<option value="">Pilih Akun</option>';
        
        // Add account options
        allAccounts.forEach(account => {
            const option = document.createElement('option');
            option.value = account.id;
            option.textContent = `${account.name}${account.bankNumber ? ' - ' + account.bankNumber : ''}`;
            accountSelect.appendChild(option);
        });
        
    } catch (error) {
        console.error('Error populating account dropdown:', error);
    }
};

const calculateSaldoKas = async (transactionData) => {
    try {
        const category = getCategoryById(transactionData.categoryId);
        if (!category) {
            throw new Error('Kategori tidak ditemukan');
        }
        
        // Get the category index to determine transaction type
        const categoryIndex = category.index;
        let transactionAmount = transactionData.amount;
        
        // Determine if this is income (2.x) or expense (3.x)
        if (categoryIndex.startsWith('2')) {
            // Income - positive amount (regardless of account)
            transactionAmount = Math.abs(transactionAmount);
        } else if (categoryIndex.startsWith('3')) {
            // Expense - negative amount (regardless of account)
            transactionAmount = -Math.abs(transactionAmount);
        } else if (categoryIndex.startsWith('1')) {
            // Saldo Awal - use amount as is (should not be selectable by users)
            transactionAmount = transactionData.amount;
        }
        
        // Get the most recent Saldo Kas from existing transactions
        const previousBalance = await getPreviousSaldoKas(transactionData.date);
        
        console.log('=== SALDO KAS CALCULATION DEBUG ===');
        console.log('Transaction Category:', categoryIndex, '(' + category.fullName + ')');
        console.log('Raw Amount Entered:', transactionData.amount);
        console.log('Transaction Type:', categoryIndex.startsWith('2') ? 'INCOME (+)' : categoryIndex.startsWith('3') ? 'EXPENSE (-)' : 'OTHER');
        console.log('Processed Amount with Sign:', transactionAmount);
        console.log('Previous Saldo Kas (from most recent transaction):', previousBalance);
        console.log('Calculation: Previous Saldo Kas + Transaction Amount');
        console.log('Calculation:', previousBalance, '+', transactionAmount, '=', (previousBalance + transactionAmount));
        console.log('=====================================');
        
        // Calculate new Saldo Kas: Previous Saldo Kas + Current Transaction Amount
        const newSaldoKas = previousBalance + transactionAmount;
        
        return newSaldoKas;
        
    } catch (error) {
        console.error('Error calculating Saldo Kas:', error);
        throw error;
    }
};

const getPreviousSaldoKas = async (currentTransactionDate) => {
    try {
        // Get ALL transactions, then find the most recent one by date and time
        const allTransactionsQuery = await db.collection('transactions')
            .orderBy('date', 'desc')
            .orderBy('createdAt', 'desc')
            .get();
        
        if (!allTransactionsQuery.empty) {
            // Get the most recent transaction overall
            const mostRecentTransaction = allTransactionsQuery.docs[0].data();
            console.log('Most recent transaction Saldo Kas:', mostRecentTransaction.saldoKas || 0);
            return mostRecentTransaction.saldoKas || 0;
        } else {
            // No previous transactions at all, check for monthly starting balance
            const currentDate = new Date(currentTransactionDate);
            return await getMonthlyStartingBalance(currentDate);
        }
        
    } catch (error) {
        console.error('Error getting previous Saldo Kas:', error);
        return 0;
    }
};

const getMonthlyStartingBalance = async (currentDate) => {
    try {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        
        const previousMonth = month === 0 ? 11 : month - 1;
        const previousYear = month === 0 ? year - 1 : year;
        const monthKey = `${previousYear}-${String(previousMonth + 1).padStart(2, '0')}`;
        
        const monthlyBalanceDoc = await db.collection('monthlyBalances').doc(monthKey).get();
        
        if (monthlyBalanceDoc.exists) {
            const endingBalance = monthlyBalanceDoc.data().endingBalance || 0;
            console.log(`Found previous month balance for ${monthKey}: ${endingBalance}`);
            return endingBalance;
        }
        
        console.log(`No balance found for previous month ${monthKey}, prompting for initial balance`);
        return await promptForInitialBalance(monthKey, currentDate);
        
    } catch (error) {
        console.error('Error getting monthly starting balance:', error);
        return 0;
    }
};

const promptForInitialBalance = async (previousMonthKey, currentDate) => {
    return new Promise((resolve) => {
        // Create modal HTML
        const modalHTML = `
            <div id="initialBalanceModal" class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50" style="display: flex; align-items: center; justify-content: center;">
                <div class="relative p-5 border w-96 shadow-lg rounded-md bg-white">
                    <div class="mt-3">
                        <div class="flex items-center mb-4">
                            <div class="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-blue-100">
                                <svg class="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1"></path>
                                </svg>
                            </div>
                        </div>
                        <h3 class="text-lg font-medium text-gray-900 mb-4 text-center">Setup Saldo Awal</h3>
                        <p class="text-sm text-gray-600 mb-4">
                            Ini adalah transaksi pertama untuk bulan <strong>${new Intl.DateTimeFormat('id-ID', { year: 'numeric', month: 'long' }).format(currentDate)}</strong>.
                            <br><br>
                            Berapa Saldo Akhir bulan sebelumnya?
                        </p>
                        <form id="initialBalanceForm">
                            <div class="mb-4">
                                <label for="initialBalance" class="block text-sm font-medium text-gray-700 mb-2">Saldo Akhir Bulan Lalu (IDR)</label>
                                <div class="relative rounded-md shadow-sm">
                                    <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <span class="text-gray-500 sm:text-sm">Rp</span>
                                    </div>
                                    <input type="number" id="initialBalance" step="0.01" required class="block w-full pl-8 pr-12 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm" placeholder="0">
                                </div>
                                <p class="mt-1 text-xs text-gray-500">Masukkan saldo terakhir dari bulan sebelumnya. Ini akan menjadi Saldo Awal bulan ini.</p>
                            </div>
                            <div class="flex justify-end space-x-3">
                                <button type="button" id="cancelInitialBalance" class="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50">
                                    Batal
                                </button>
                                <button type="submit" class="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700">
                                    Simpan
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
        const modal = document.getElementById('initialBalanceModal');
        const form = document.getElementById('initialBalanceForm');
        const cancelBtn = document.getElementById('cancelInitialBalance');
        
        // Handle form submission
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const initialBalance = parseFloat(document.getElementById('initialBalance').value) || 0;
            
            try {
                // Save the initial balance as the previous month's ending balance
                await db.collection('monthlyBalances').doc(previousMonthKey).set({
                    year: parseInt(previousMonthKey.split('-')[0]),
                    month: parseInt(previousMonthKey.split('-')[1]),
                    endingBalance: initialBalance,
                    lastUpdated: firebase.firestore.FieldValue.serverTimestamp(),
                    isInitialSetup: true
                });
                
                console.log(`Initial balance ${initialBalance} saved for ${previousMonthKey}`);
                
                // Remove modal
                modal.remove();
                
                resolve(initialBalance);
                
            } catch (error) {
                console.error('Error saving initial balance:', error);
                alert('Terjadi kesalahan saat menyimpan saldo awal: ' + error.message);
            }
        });
        
        // Handle cancel
        cancelBtn.addEventListener('click', () => {
            modal.remove();
            resolve(0);
        });
    });
};

const updateMonthlyBalance = async (transactionData) => {
    try {
        const transactionDate = transactionData.date.toDate ? transactionData.date.toDate() : new Date(transactionData.date);
        const year = transactionDate.getFullYear();
        const month = transactionDate.getMonth(); // 0-11
        const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;
        
        // Update the monthly balance document with the latest Saldo Kas
        await db.collection('monthlyBalances').doc(monthKey).set({
            year: year,
            month: month + 1,
            endingBalance: transactionData.saldoKas,
            lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        
        console.log(`Monthly balance updated for ${monthKey}: ${formatCurrency(transactionData.saldoKas)}`);
        
    } catch (error) {
        console.error('Error updating monthly balance:', error);
    }
};

const checkAndSavePreviousMonthBalance = async () => {
    try {
        const now = new Date();
        const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        
        // Get previous month
        const prevMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
        const prevYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
        const prevMonthKey = `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}`;
        
        // Check if previous month balance already exists
        const prevMonthDoc = await db.collection('monthlyBalances').doc(prevMonthKey).get();
        
        if (!prevMonthDoc.exists) {
            // Get the most recent transaction from previous month
            const startOfPrevMonth = new Date(prevYear, prevMonth, 1);
            const endOfPrevMonth = new Date(prevYear, prevMonth + 1, 0, 23, 59, 59);
            
            const prevMonthTransactions = await db.collection('transactions')
                .where('date', '>=', firebase.firestore.Timestamp.fromDate(startOfPrevMonth))
                .where('date', '<=', firebase.firestore.Timestamp.fromDate(endOfPrevMonth))
                .orderBy('date', 'desc')
                .orderBy('createdAt', 'desc')
                .limit(1)
                .get();
            
            if (!prevMonthTransactions.empty) {
                const lastTransaction = prevMonthTransactions.docs[0].data();
                const endingBalance = lastTransaction.saldoKas || 0;
                
                // Save the ending balance for previous month
                await db.collection('monthlyBalances').doc(prevMonthKey).set({
                    year: prevYear,
                    month: prevMonth + 1,
                    endingBalance: endingBalance,
                    lastUpdated: firebase.firestore.FieldValue.serverTimestamp(),
                    autoSaved: true
                });
                
                console.log(`Auto-saved previous month balance for ${prevMonthKey}: ${formatCurrency(endingBalance)}`);
            }
        }
        
    } catch (error) {
        console.error('Error checking/saving previous month balance:', error);
    }
};

// Handle transaction form submission
const handleTransactionSubmit = async (event) => {
    event.preventDefault();
    
    if (!currentUser) {
        alert('Anda harus login terlebih dahulu');
        return;
    }
    
    const form = event.target;
    const submitButton = form.querySelector('button[type="submit"]');
    
    // Get form data
    const transactionData = {
        name: document.getElementById('transactionName').value.trim(),
        date: document.getElementById('transactionDate').value,
        amount: parseFloat(document.getElementById('amount').value) || 0,
        accountId: document.getElementById('accountId').value,
        description: document.getElementById('description').value.trim(),
        categoryId: getSelectedCategoryId(),
        createdBy: currentUser.uid,
        createdByEmail: currentUser.email,
        createdByRole: userRole,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    // Validation
    if (!transactionData.name) {
        alert('Nama transaksi harus diisi');
        return;
    }
    
    if (!transactionData.date) {
        alert('Tanggal transaksi harus diisi');
        return;
    }
    
    if (transactionData.amount <= 0) {
        alert('Jumlah transaksi harus lebih dari 0');
        return;
    }
    
    if (!transactionData.accountId) {
        alert('Akun harus dipilih');
        return;
    }
    
    if (!transactionData.categoryId) {
        alert('Kategori transaksi harus dipilih');
        return;
    }
    
    // Disable submit button
    submitButton.disabled = true;
    submitButton.textContent = 'Menyimpan...';
    
    try {
        // Calculate Saldo Kas based on transaction type
        const calculatedSaldoKas = await calculateSaldoKas(transactionData);
        transactionData.saldoKas = calculatedSaldoKas;
        // Convert date string to Firestore timestamp
        transactionData.date = firebase.firestore.Timestamp.fromDate(new Date(transactionData.date));
        
        // Add transaction to Firestore
        const docRef = await db.collection('transactions').add(transactionData);
        
        console.log('Transaction added with ID:', docRef.id);
        
        // Show success message
        alert('Transaksi berhasil disimpan!');
        
        // Update monthly balance after transaction is saved
        await updateMonthlyBalance(transactionData);
        
        // Check and save previous month's balance if needed
        await checkAndSavePreviousMonthBalance();
        
        // Reset form
        form.reset();
        resetCategorySelectors();
        
        // Set today's date as default
        document.getElementById('transactionDate').valueAsDate = new Date();
        
    } catch (error) {
        console.error('Error adding transaction:', error);
        alert('Terjadi kesalahan saat menyimpan transaksi: ' + error.message);
    } finally {
        // Re-enable submit button
        submitButton.disabled = false;
        submitButton.textContent = 'Simpan Transaksi';
    }
};

// Get selected category ID from the form
const getSelectedCategoryId = () => {
    const selectors = ['category5', 'category4', 'category3', 'category2', 'category1'];
    
    for (const selectorId of selectors) {
        const select = document.getElementById(selectorId);
        if (select && select.value) {
            return select.value;
        }
    }
    
    return null;
};

// Reset all category selectors
const resetCategorySelectors = () => {
    const selectors = ['category1', 'category2', 'category3', 'category4', 'category5'];
    
    selectors.forEach((selectorId, index) => {
        const select = document.getElementById(selectorId);
        const container = document.getElementById(`${selectorId}Container`);
        
        if (select) {
            select.innerHTML = index === 0 ? 
                '<option value="">Pilih Kategori Utama</option>' : 
                '<option value="">Pilih Sub Kategori</option>';
        }
        
        if (container && index > 0) {
            container.classList.add('hidden');
        }
    });
    
    // Hide category display
    const display = document.getElementById('selectedCategoryDisplay');
    if (display) {
        display.classList.add('hidden');
    }
    
    // Reset selected category
    selectedCategory = null;
    
    // Clear transaction name
    clearTransactionName();
    
    // Repopulate first level
    const category1Select = document.getElementById('category1');
    if (category1Select) {
        populateCategorySelect(category1Select, null, 1, 'Pilih Kategori Utama');
    }
};

// Enhanced category selection handling
const enhancedCategorySelection = () => {
    const selectors = ['category1', 'category2', 'category3', 'category4', 'category5'];
    
    selectors.forEach((selectorId, index) => {
        const select = document.getElementById(selectorId);
        
        if (select) {
            select.addEventListener('change', (e) => {
                const selectedValue = e.target.value;
                const nextIndex = index + 1;
                
                // Hide all subsequent selectors
                for (let i = nextIndex; i < selectors.length; i++) {
                    const container = document.getElementById(`${selectors[i]}Container`);
                    const selector = document.getElementById(selectors[i]);
                    if (container) container.classList.add('hidden');
                    if (selector) selector.innerHTML = '<option value="">Pilih Sub Kategori</option>';
                }
                
                // Hide category display initially
                const display = document.getElementById('selectedCategoryDisplay');
                if (display) display.classList.add('hidden');
                
                if (selectedValue) {
                    // Get children of selected category
                    const children = getCategoriesByParent(selectedValue, index + 2);
                    
                    if (children.length > 0) {
                        // Show next selector if there are children
                        const nextContainer = document.getElementById(`${selectors[nextIndex]}Container`);
                        const nextSelect = document.getElementById(selectors[nextIndex]);
                        
                        if (nextContainer && nextSelect) {
                            nextContainer.classList.remove('hidden');
                            populateCategorySelect(nextSelect, selectedValue, index + 2, 'Pilih Sub Kategori', ['1']);
                        }
                    } else {
                        // No children, this is the final selection
                        updateSelectedCategoryDisplay(selectedValue);
                        selectedCategory = getCategoryById(selectedValue);
                        updateTransactionName(selectedCategory);
                    }
                } else {
                    selectedCategory = null;
                    clearTransactionName();
                }
                
                // Also update transaction name if there are children (partial selection)
                if (selectedValue) {
                    const partialCategory = getCategoryById(selectedValue);
                    if (partialCategory) {
                        updateTransactionName(partialCategory);
                    }
                }
            });
        }
    });
};

// Update transaction name based on selected category
const updateTransactionName = (category) => {
    const transactionNameField = document.getElementById('transactionName');
    if (transactionNameField && category) {
        transactionNameField.value = category.fullName;
    }
};

// Clear transaction name
const clearTransactionName = () => {
    const transactionNameField = document.getElementById('transactionName');
    if (transactionNameField) {
        transactionNameField.value = '';
    }
};

// Validate form fields in real-time
const setupFormValidation = () => {
    const amountField = document.getElementById('amount');
    const transactionNameField = document.getElementById('transactionName');
    
    // Amount validation
    if (amountField) {
        amountField.addEventListener('input', (e) => {
            const value = e.target.value;
            if (value && (isNaN(value) || parseFloat(value) <= 0)) {
                e.target.setCustomValidity('Jumlah harus berupa angka positif');
            } else {
                e.target.setCustomValidity('');
            }
        });
    }
    
    // Transaction name validation
    if (transactionNameField) {
        transactionNameField.addEventListener('input', (e) => {
            const value = e.target.value.trim();
            if (value.length > 100) {
                e.target.setCustomValidity('Nama transaksi maksimal 100 karakter');
            } else {
                e.target.setCustomValidity('');
            }
        });
    }
};


// Initialize transaction form
const initializeTransactionForm = async () => {
    try {
        // Load categories and accounts first
        await loadCategories();
        await populateAccountDropdown();
        
        // Set up form
        const form = document.getElementById('transactionForm');
        if (form) {
            form.addEventListener('submit', handleTransactionSubmit);
        }
        
        // Set today's date as default
        const dateField = document.getElementById('transactionDate');
        if (dateField) {
            dateField.valueAsDate = new Date();
        }
        
        // Setup enhanced category selection
        enhancedCategorySelection();
        
        // Setup form validation
        setupFormValidation();
        
        // Populate first level categories (exclude category 1 - Saldo Awal)
        const category1Select = document.getElementById('category1');
        if (category1Select) {
            populateCategorySelect(category1Select, null, 1, 'Pilih Kategori Utama', ['1']);
        }
        
        
    } catch (error) {
        console.error('Error initializing transaction form:', error);
    }
};

// Handle page navigation
const handleNavigation = () => {
    // Warn user about unsaved changes
    let formModified = false;
    const form = document.getElementById('transactionForm');
    
    if (form) {
        const inputs = form.querySelectorAll('input, select, textarea');
        inputs.forEach(input => {
            input.addEventListener('change', () => {
                formModified = true;
            });
        });
        
        window.addEventListener('beforeunload', (e) => {
            if (formModified) {
                e.preventDefault();
                e.returnValue = '';
                return 'Anda memiliki perubahan yang belum disimpan. Yakin ingin meninggalkan halaman?';
            }
        });
        
        // Reset flag when form is submitted
        form.addEventListener('submit', () => {
            formModified = false;
        });
    }
};

// Initialize when DOM is ready - but only call handleNavigation
// initializeTransactionForm will be called by auth system
document.addEventListener('DOMContentLoaded', () => {
    handleNavigation();
});

