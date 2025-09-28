// Home page functionality
let allTransactions = [];
let filteredTransactions = [];
let allAccounts = [];
let currentFilters = {
    month: '',
    category: ''
};

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

// Get account name by ID
const getAccountNameById = (accountId) => {
    const account = allAccounts.find(acc => acc.id === accountId);
    return account ? account.name : 'Unknown Account';
};

// Load transactions from Firestore
const loadTransactions = async () => {
    try {
        const snapshot = await db.collection('transactions')
            .orderBy('date', 'desc')
            .orderBy('createdAt', 'desc')
            .get();
        
        allTransactions = [];
        snapshot.forEach(doc => {
            const transaction = { id: doc.id, ...doc.data() };
            allTransactions.push(transaction);
        });
        
        
        // Apply current filters
        applyFilters();
        
        return allTransactions;
    } catch (error) {
        console.error('Error loading transactions:', error);
        return [];
    }
};

// Apply filters to transactions
const applyFilters = () => {
    filteredTransactions = allTransactions.filter(transaction => {
        // Month filter
        if (currentFilters.month) {
            const transactionMonth = getMonthYearFromDate(transaction.date);
            if (transactionMonth !== currentFilters.month) {
                return false;
            }
        }
        
        // Category filter
        if (currentFilters.category) {
            // Check if transaction category matches the selected category or is a child of it
            const transactionCategory = getCategoryById(transaction.categoryId);
            const filterCategory = getCategoryById(currentFilters.category);
            
            if (!transactionCategory || !filterCategory) {
                return false;
            }
            
            // Check if transaction category matches selected category or is its descendant
            const isMatch = transactionCategory.index.startsWith(filterCategory.index);
            if (!isMatch) {
                return false;
            }
        }
        
        return true;
    });
    
    // Update displays
    displayTransactions();
    updateSummaryCards();
};

// Get month-year string from date
const getMonthYearFromDate = (date) => {
    if (date && date.toDate) {
        const d = date.toDate();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    } else if (date instanceof Date) {
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    } else if (typeof date === 'string') {
        const d = new Date(date);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    }
    return '';
};

// Group transactions by month-year
const groupTransactionsByMonth = (transactions) => {
    const groups = {};
    
    transactions.forEach(transaction => {
        const monthYear = getMonthYearFromDate(transaction.date);
        if (!groups[monthYear]) {
            groups[monthYear] = [];
        }
        groups[monthYear].push(transaction);
    });
    
    return groups;
};

const getMonthlyBalances = (monthYear, monthTransactions) => {
    let saldoAkhir = 0;
    if (allTransactions.length > 0) {
        const sortedAllTransactions = [...allTransactions].sort((a, b) => {
            const dateA = a.date.toDate ? a.date.toDate() : new Date(a.date);
            const dateB = b.date.toDate ? b.date.toDate() : new Date(b.date);
            
            if (dateA.getTime() !== dateB.getTime()) {
                return dateB.getTime() - dateA.getTime();
            }
            
            const createdA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(0);
            const createdB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(0);
            return createdB.getTime() - createdA.getTime();
        });
        
        saldoAkhir = sortedAllTransactions[0].saldoKas || 0;
    }
    
    let saldoAwal = 0;
    if (monthTransactions.length > 0) {
        const [year, month] = monthYear.split('-');
        const monthStart = new Date(year, month - 1, 1);
        const monthEnd = new Date(year, month, 0, 23, 59, 59, 999);
        
        const allMonthTransactions = allTransactions.filter(transaction => {
            const transDate = transaction.date.toDate ? transaction.date.toDate() : new Date(transaction.date);
            return transDate >= monthStart && transDate <= monthEnd;
        });
        
        if (allMonthTransactions.length > 0) {
            const sortedMonthTransactions = [...allMonthTransactions].sort((a, b) => {
                const dateA = a.date.toDate ? a.date.toDate() : new Date(a.date);
                const dateB = b.date.toDate ? b.date.toDate() : new Date(b.date);
                
                if (dateA.getTime() !== dateB.getTime()) {
                    return dateA.getTime() - dateB.getTime(); // Oldest first
                }
                
                const createdA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(0);
                const createdB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(0);
                return createdA.getTime() - createdB.getTime();
            });
            
            const firstTransaction = sortedMonthTransactions[0];
            
            const category = getCategoryById(firstTransaction.categoryId);
            let firstTransactionAmount = firstTransaction.amount;
            
            if (category && category.index.startsWith('2')) {
                firstTransactionAmount = Math.abs(firstTransactionAmount);
            } else if (category && category.index.startsWith('3')) {
                firstTransactionAmount = -Math.abs(firstTransactionAmount);
            }
            
            saldoAwal = (firstTransaction.saldoKas || 0) - firstTransactionAmount;
        }
    }
    
    return { saldoAwal, saldoAkhir };
};

const displaySaldoAwalOnly = () => {
    const transactionList = document.getElementById('transactionList');
    if (!transactionList) return;
    
    const monthlyGroups = groupTransactionsByMonth(allTransactions);
    const sortedMonths = Object.keys(monthlyGroups).sort().reverse();
    
    if (sortedMonths.length === 0) {
        transactionList.innerHTML = `
            <li class="px-6 py-4 text-center text-gray-500">
                <div class="text-center">
                    <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                    </svg>
                    <h3 class="mt-2 text-sm font-medium text-gray-900">Tidak ada data Saldo Awal</h3>
                    <p class="mt-1 text-sm text-gray-500">Belum ada transaksi untuk menampilkan Saldo Awal.</p>
                </div>
            </li>
        `;
        return;
    }
    
    let transactionHTML = '';
    
    // Apply month filter if selected
    const filteredMonths = currentFilters.month 
        ? sortedMonths.filter(month => month === currentFilters.month)
        : sortedMonths;
    
    filteredMonths.forEach((monthYear, monthIndex) => {
        const monthTransactions = monthlyGroups[monthYear];
        const { saldoAwal } = getMonthlyBalances(monthYear, monthTransactions);
        
        const [year, month] = monthYear.split('-');
        const date = new Date(year, month - 1, 1);
        const monthName = date.toLocaleDateString('id-ID', { year: 'numeric', month: 'long' });
        
        transactionHTML += `
            <li class="px-6 py-3 bg-gray-100 border-b border-gray-200">
                <h3 class="text-lg font-semibold text-gray-800">${monthName}</h3>
            </li>
        `;
        
        transactionHTML += `
            <li class="px-6 py-4 bg-green-50 border-l-4 border-green-400 ${monthIndex < filteredMonths.length - 1 ? 'mb-6' : ''}">
                <div class="flex items-center justify-between">
                    <div class="flex-1 min-w-0">
                        <h4 class="text-sm font-semibold text-green-900">
                            Saldo Awal
                        </h4>
                        <p class="text-sm text-green-700">
                            Saldo pembuka bulan ${monthName}
                        </p>
                        <p class="text-xs text-green-600">
                            Posisi awal bulan
                        </p>
                    </div>
                    <div class="text-right">
                        <div class="font-bold text-green-900 text-xl">${formatCurrency(saldoAwal)}</div>
                        <div class="text-xs text-green-600 font-medium">Saldo Kas</div>
                    </div>
                </div>
            </li>
        `;
    });
    
    transactionList.innerHTML = transactionHTML;
};

// Display transactions in the list with monthly grouping
const displayTransactions = () => {
    const transactionList = document.getElementById('transactionList');
    if (!transactionList) return;
    
    // Special handling for "Saldo Awal" filter
    if (currentFilters.category === 'saldo-awal') {
        displaySaldoAwalOnly();
        return;
    }
    
    if (filteredTransactions.length === 0) {
        transactionList.innerHTML = `
            <li class="px-6 py-4 text-center text-gray-500">
                <div class="text-center">
                    <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                    </svg>
                    <h3 class="mt-2 text-sm font-medium text-gray-900">Tidak ada transaksi</h3>
                    <p class="mt-1 text-sm text-gray-500">Belum ada transaksi yang sesuai dengan filter yang dipilih.</p>
                </div>
            </li>
        `;
        return;
    }
    
    // Group transactions by month
    const monthlyGroups = groupTransactionsByMonth(filteredTransactions);
    const sortedMonths = Object.keys(monthlyGroups).sort().reverse(); // Most recent first
    
    let transactionHTML = '';
    
    sortedMonths.forEach((monthYear, monthIndex) => {
        const monthTransactions = monthlyGroups[monthYear];
        const { saldoAwal, saldoAkhir } = getMonthlyBalances(monthYear, monthTransactions);
        
        // Convert monthYear to readable format
        const [year, month] = monthYear.split('-');
        const date = new Date(year, month - 1, 1);
        const monthName = date.toLocaleDateString('id-ID', { year: 'numeric', month: 'long' });
        
        // Add month header
        transactionHTML += `
            <li class="px-6 py-3 bg-gray-100 border-b border-gray-200">
                <h3 class="text-lg font-semibold text-gray-800">${monthName}</h3>
            </li>
        `;
        
        // Add Saldo Akhir (at top of month)
        transactionHTML += `
            <li class="px-6 py-4 bg-blue-50 border-l-4 border-blue-400">
                <div class="flex items-center justify-between">
                    <div class="flex-1 min-w-0">
                        <h4 class="text-sm font-semibold text-blue-900">
                            Saldo Akhir
                        </h4>
                        <p class="text-sm text-blue-700">
                            Saldo penutup bulan ${monthName}
                        </p>
                        <p class="text-xs text-blue-600">
                            Posisi akhir bulan
                        </p>
                    </div>
                    <div class="text-right">
                        <div class="font-bold text-blue-900 text-xl">${formatCurrency(saldoAkhir)}</div>
                        <div class="text-xs text-blue-600 font-medium">Saldo Kas</div>
                    </div>
                </div>
            </li>
        `;
        
        // Sort transactions in this month (newest first)
        const sortedMonthTransactions = [...monthTransactions].sort((a, b) => {
            const dateA = a.date.toDate ? a.date.toDate() : new Date(a.date);
            const dateB = b.date.toDate ? b.date.toDate() : new Date(b.date);
            
            if (dateA.getTime() !== dateB.getTime()) {
                return dateB.getTime() - dateA.getTime(); // Newest first
            }
            
            const createdA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(0);
            const createdB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(0);
            return createdB.getTime() - createdA.getTime();
        });
        
        // Add regular transactions
        sortedMonthTransactions.forEach(transaction => {
            const category = getCategoryById(transaction.categoryId);
            const categoryName = category ? category.fullName : transaction.categoryId;
            const isExpense = transaction.categoryId.startsWith('3');
            const isIncome = transaction.categoryId.startsWith('2');
            
            // Get account name
            const accountName = getAccountNameById(transaction.accountId);
            
            // Format transaction amount
            const formattedAmount = formatCurrency(Math.abs(transaction.amount));
            let amountDisplay = formattedAmount;
            
            // Add sign based on transaction type for display
            if (isExpense) {
                amountDisplay = `-${formattedAmount}`;
            } else if (isIncome) {
                amountDisplay = `+${formattedAmount}`;
            }
            
            // Format Saldo Kas
            const saldoKasDisplay = transaction.saldoKas !== undefined 
                ? formatCurrency(transaction.saldoKas) 
                : '-';
            
            transactionHTML += `
                <li class="px-6 py-4 hover:bg-gray-50 transition duration-150 ease-in-out border-l-4 border-transparent hover:border-gray-300">
                    <div class="flex items-center justify-between">
                        <div class="flex-1 min-w-0">
                            <div class="flex items-center justify-between">
                                <div class="flex-1">
                                    <h4 class="text-sm font-medium text-gray-900 truncate">
                                        ${transaction.name || 'Transaksi'}
                                    </h4>
                                    <p class="text-sm text-gray-600 truncate">
                                        ${categoryName}
                                    </p>
                                    <p class="text-xs text-gray-500">
                                        ${formatDate(transaction.date)} | ${accountName}
                                    </p>
                                    ${transaction.description ? `<p class="text-xs text-gray-400 mt-1">${transaction.description}</p>` : ''}
                                </div>
                                <div class="grid grid-cols-3 gap-4 text-right text-sm">
                                    <div>
                                        <div class="font-medium text-gray-900">${accountName}</div>
                                        <div class="text-xs text-gray-500">Akun</div>
                                    </div>
                                    <div>
                                        <div class="font-medium ${isExpense ? 'text-red-600' : isIncome ? 'text-green-600' : 'text-gray-900'}">${amountDisplay}</div>
                                        <div class="text-xs text-gray-500">Jumlah</div>
                                    </div>
                                    <div>
                                        <div class="font-medium text-blue-600">${saldoKasDisplay}</div>
                                        <div class="text-xs text-gray-500">Saldo Kas</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </li>
            `;
        });
        
        // Add Saldo Awal (at bottom of month)
        transactionHTML += `
            <li class="px-6 py-4 bg-green-50 border-l-4 border-green-400 ${monthIndex < sortedMonths.length - 1 ? 'mb-6' : ''}">
                <div class="flex items-center justify-between">
                    <div class="flex-1 min-w-0">
                        <h4 class="text-sm font-semibold text-green-900">
                            Saldo Awal
                        </h4>
                        <p class="text-sm text-green-700">
                            Saldo pembuka bulan ${monthName}
                        </p>
                        <p class="text-xs text-green-600">
                            Posisi awal bulan
                        </p>
                    </div>
                    <div class="text-right">
                        <div class="font-bold text-green-900 text-xl">${formatCurrency(saldoAwal)}</div>
                        <div class="text-xs text-green-600 font-medium">Saldo Kas</div>
                    </div>
                </div>
            </li>
        `;
    });
    
    transactionList.innerHTML = transactionHTML;
};

// Update summary cards with current Saldo Kas and filtered balances
const updateSummaryCards = () => {
    // Get the current Saldo Kas (from the most recent transaction across ALL transactions, not just filtered)
    let currentSaldoKas = 0;
    if (allTransactions.length > 0) {
        // Sort by date and created time to get the most recent
        const sortedTransactions = [...allTransactions].sort((a, b) => {
            const dateA = a.date.toDate ? a.date.toDate() : new Date(a.date);
            const dateB = b.date.toDate ? b.date.toDate() : new Date(b.date);
            
            if (dateA.getTime() !== dateB.getTime()) {
                return dateB.getTime() - dateA.getTime(); // Most recent first
            }
            
            // If same date, use createdAt
            const createdA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(0);
            const createdB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(0);
            return createdB.getTime() - createdA.getTime();
        });
        
        currentSaldoKas = sortedTransactions[0].saldoKas || 0;
    }
    
    // Calculate account balances from FILTERED transactions (this shows totals for selected period/category)
    const accountBalances = {};
    allAccounts.forEach(account => {
        accountBalances[account.id] = 0;
    });
    
    filteredTransactions.forEach(transaction => {
        if (transaction.accountId && accountBalances.hasOwnProperty(transaction.accountId)) {
            // Get the actual transaction category to determine if it's income or expense
            const category = getCategoryById(transaction.categoryId);
            if (category) {
                let isIncome = category.index.startsWith('2');
                let isExpense = category.index.startsWith('3');
                
                if (isIncome) {
                    accountBalances[transaction.accountId] += Math.abs(transaction.amount || 0);
                } else if (isExpense) {
                    accountBalances[transaction.accountId] -= Math.abs(transaction.amount || 0);
                } else {
                    // For other categories (like Saldo Awal), use the amount as is
                    accountBalances[transaction.accountId] += (transaction.amount || 0);
                }
            }
        }
    });
    
    // Update current Saldo Kas (always shows the actual current balance, not filtered)
    const totalSaldoKas = document.getElementById('totalSaldoKas');
    if (totalSaldoKas) {
        totalSaldoKas.textContent = formatCurrency(currentSaldoKas);
    }
    
    // Update all account cards dynamically
    allAccounts.forEach(account => {
        const cleanId = account.name.replace(/[^a-zA-Z0-9]/g, '');
        const element = document.getElementById(`total${cleanId}`);
        if (element) {
            element.textContent = formatCurrency(accountBalances[account.id] || 0);
        }
    });
    
    console.log('Summary cards updated:');
    console.log('Current Saldo Kas:', formatCurrency(currentSaldoKas));
    console.log('Account balances (filtered):', accountBalances);
};

// Setup month filter dropdown
const setupMonthFilter = () => {
    const monthFilter = document.getElementById('monthFilter');
    if (!monthFilter) return;
    
    // Get unique months from all transactions
    const months = new Set();
    allTransactions.forEach(transaction => {
        if (transaction.date) {
            const monthYear = getMonthYearFromDate(transaction.date);
            if (monthYear) {
                months.add(monthYear);
            }
        }
    });
    
    // Sort months in descending order
    const sortedMonths = Array.from(months).sort().reverse();
    
    // Clear existing options except the first one
    monthFilter.innerHTML = '<option value="">Semua Bulan</option>';
    
    // Add month options
    sortedMonths.forEach(monthYear => {
        const [year, month] = monthYear.split('-');
        const date = new Date(year, month - 1, 1);
        const displayText = date.toLocaleDateString('id-ID', { year: 'numeric', month: 'long' });
        
        const option = document.createElement('option');
        option.value = monthYear;
        option.textContent = displayText;
        monthFilter.appendChild(option);
    });
    
    // Add event listener for month filter changes
    monthFilter.addEventListener('change', (e) => {
        currentFilters.month = e.target.value;
        console.log('Month filter changed to:', currentFilters.month);
        applyFilters();
    });
};

// Setup category filter dropdown
const setupCategoryFilter = () => {
    const categoryFilter = document.getElementById('categoryFilter');
    if (!categoryFilter) return;
    
    categoryFilter.innerHTML = '<option value="">Semua Kategori</option>';
    
    // Add special "Saldo Awal" option
    const saldoAwalOption = document.createElement('option');
    saldoAwalOption.value = 'saldo-awal';
    saldoAwalOption.textContent = 'Saldo Awal';
    categoryFilter.appendChild(saldoAwalOption);
    
    // Add separator
    const separatorOption = document.createElement('option');
    separatorOption.disabled = true;
    separatorOption.textContent = '─────────────';
    categoryFilter.appendChild(separatorOption);
    
    // Add main categories (level 1) - exclude "1. Saldo Awal" since we have it as special filter
    const mainCategories = getCategoriesByParent(null, 1);
    mainCategories.forEach(category => {
        // Skip "1. Saldo Awal" category since we have it as a special filter option
        if (category.index && category.index.startsWith('1')) {
            return; // Skip this category
        }
        
        const option = document.createElement('option');
        option.value = category.id;
        option.textContent = category.fullName;
        categoryFilter.appendChild(option);
    });
    
    // Add event listener for category filter changes
    categoryFilter.addEventListener('change', (e) => {
        currentFilters.category = e.target.value;
        console.log('Category filter changed to:', currentFilters.category);
        applyFilters();
    });
};

// Apply filters function (called by button)
window.applyFilters = () => {
    const monthFilter = document.getElementById('monthFilter');
    const categoryFilter = document.getElementById('categoryFilter');
    
    currentFilters.month = monthFilter ? monthFilter.value : '';
    currentFilters.category = categoryFilter ? categoryFilter.value : '';
    
    applyFilters();
};

// Generate dynamic summary cards based on accounts
const generateSummaryCards = () => {
    const summaryCardsContainer = document.getElementById('summaryCards');
    if (!summaryCardsContainer) return;
    
    // Color schemes for different accounts
    const colorSchemes = [
        { bg: 'bg-green-100', text: 'text-green-600' },
        { bg: 'bg-blue-100', text: 'text-blue-600' },
        { bg: 'bg-purple-100', text: 'text-purple-600' },
        { bg: 'bg-indigo-100', text: 'text-indigo-600' },
        { bg: 'bg-pink-100', text: 'text-pink-600' },
        { bg: 'bg-red-100', text: 'text-red-600' },
    ];
    
    // Icons for different types of accounts
    const getAccountIcon = (accountName) => {
        const name = accountName.toLowerCase();
        if (name.includes('tunai')) {
            return `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1"></path>`;
        } else if (name.includes('bank')) {
            return `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"></path>`;
        } else {
            return `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path>`;
        }
    };
    
    let cardsHTML = '';
    
    // Generate account cards
    allAccounts.forEach((account, index) => {
        const colorScheme = colorSchemes[index % colorSchemes.length];
        const icon = getAccountIcon(account.name);
        const cleanId = account.name.replace(/[^a-zA-Z0-9]/g, '');
        
        cardsHTML += `
            <div class="bg-white overflow-hidden shadow rounded-lg">
                <div class="p-5">
                    <div class="flex items-center">
                        <div class="flex-shrink-0">
                            <div class="w-8 h-8 ${colorScheme.bg} rounded-full flex items-center justify-center">
                                <svg class="w-5 h-5 ${colorScheme.text}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    ${icon}
                                </svg>
                            </div>
                        </div>
                        <div class="ml-5 w-0 flex-1">
                            <dl>
                                <dt class="text-sm font-medium text-gray-500 truncate">${account.name}</dt>
                                <dd class="text-lg font-medium text-gray-900" id="total${cleanId}">Rp 0</dd>
                            </dl>
                        </div>
                    </div>
                </div>
            </div>
        `;
    });
    
    // Add Saldo Kas card at the end
    cardsHTML += `
        <div class="bg-white overflow-hidden shadow rounded-lg">
            <div class="p-5">
                <div class="flex items-center">
                    <div class="flex-shrink-0">
                        <div class="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center">
                            <svg class="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path>
                            </svg>
                        </div>
                    </div>
                    <div class="ml-5 w-0 flex-1">
                        <dl>
                            <dt class="text-sm font-medium text-gray-500 truncate">Saldo Kas</dt>
                            <dd class="text-lg font-medium text-gray-900" id="totalSaldoKas">Rp 0</dd>
                        </dl>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    summaryCardsContainer.innerHTML = cardsHTML;
};

// Initialize home page
const initializePage = async () => {
    try {
        // Load categories and accounts first
        await loadCategories();
        await loadAccounts();
        
        // Generate summary cards after accounts are loaded
        generateSummaryCards();
        
        // Load transactions
        await loadTransactions();
        
        // Setup filters
        setupMonthFilter();
        setupCategoryFilter();
        
        
    } catch (error) {
        console.error('Error initializing home page:', error);
    }
};

// Real-time transaction updates
const setupRealtimeUpdates = () => {
    // Listen for transaction changes
    db.collection('transactions')
        .orderBy('createdAt', 'desc')
        .onSnapshot((snapshot) => {
            snapshot.docChanges().forEach((change) => {
                if (change.type === 'added' || change.type === 'modified') {
                    loadTransactions();
                }
            });
        });
};

// Initialize when DOM is ready - but only call setupRealtimeUpdates
// initializePage will be called by auth system
document.addEventListener('DOMContentLoaded', () => {
    setupRealtimeUpdates();
});

