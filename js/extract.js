// Extract Data functionality
let allTransactions = [];
let allAccounts = [];
let extractData = [];
// Note: allCategories is already declared globally in categories.js

// Initialize extract page
const initializeExtractPage = async () => {
    try {
        // Load necessary data
        await loadCategories(); // This populates the global allCategories array
        await loadAccounts();
        await loadAllTransactions();
        
        // Set default date range (current month)
        setDefaultDateRange();
        
    } catch (error) {
        console.error('Error initializing extract page:', error);
        showError('Gagal memuat data. Silakan refresh halaman.');
    }
};

// Load all accounts from Firestore
const loadAccounts = async () => {
    try {
        const snapshot = await db.collection('accounts').where('isActive', '==', true).orderBy('createdAt').get();
        allAccounts = [];
        
        snapshot.forEach(doc => {
            const account = { id: doc.id, ...doc.data() };
            allAccounts.push(account);
        });
        
        console.log('Loaded accounts:', allAccounts.length);
        return allAccounts;
    } catch (error) {
        console.error('Error loading accounts:', error);
        return [];
    }
};

// Load all transactions from Firestore
const loadAllTransactions = async () => {
    try {
        const snapshot = await db.collection('transactions').orderBy('date', 'desc').get();
        allTransactions = [];
        
        snapshot.forEach(doc => {
            const transaction = { id: doc.id, ...doc.data() };
            allTransactions.push(transaction);
        });
        
        console.log('Loaded transactions:', allTransactions.length);
        return allTransactions;
    } catch (error) {
        console.error('Error loading transactions:', error);
        return [];
    }
};

// Set default date range
const setDefaultDateRange = () => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = String(now.getMonth() + 1).padStart(2, '0');
    
    // Set current month as default for both start and end
    const defaultDate = `${currentYear}-${currentMonth}`;
    
    document.getElementById('startMonth').value = defaultDate;
    document.getElementById('endMonth').value = defaultDate;
};

// Handle form submission
document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('dateRangeForm');
    if (form) {
        form.addEventListener('submit', handleExtractSubmit);
    }
});

// Handle extract form submission
const handleExtractSubmit = async (e) => {
    e.preventDefault();
    
    const startMonth = document.getElementById('startMonth').value;
    const endMonth = document.getElementById('endMonth').value;
    
    if (!startMonth || !endMonth) {
        showError('Silakan pilih bulan mulai dan bulan selesai.');
        return;
    }
    
    // Validate date range
    if (new Date(startMonth + '-01') > new Date(endMonth + '-01')) {
        showError('Bulan mulai harus lebih awal atau sama dengan bulan selesai.');
        return;
    }
    
    try {
        showLoading(true);
        hideError();
        
        // Generate extract data
        await generateExtractData(startMonth, endMonth);
        
        // Display results
        displayExtractResults(startMonth, endMonth);
        
    } catch (error) {
        console.error('Error generating extract:', error);
        showError('Terjadi kesalahan saat membuat ekstrak data: ' + error.message);
    } finally {
        showLoading(false);
    }
};

// Generate extract data
const generateExtractData = async (startMonth, endMonth) => {
    console.log('Generating extract data from', startMonth, 'to', endMonth);
    
    // Filter transactions by date range
    const filteredTransactions = filterTransactionsByDateRange(startMonth, endMonth);
    console.log('Filtered transactions:', filteredTransactions.length);
    
    // Get all categories and create initial structure
    const categoryData = createCategoryStructure();
    
    // Get starting balances from previous month's monthlyBalances
    await addSaldoAwalFromMonthlyBalances(categoryData, startMonth);
    
    // Process transactions and group by category
    filteredTransactions.forEach(transaction => {
        const categoryId = transaction.categoryId;
        const accountId = transaction.accountId;
        const amount = transaction.amount || 0;
        
        // Find category in our structure
        if (categoryData[categoryId]) {
            // Initialize account totals if not exists
            if (!categoryData[categoryId].accounts[accountId]) {
                categoryData[categoryId].accounts[accountId] = 0;
            }
            
            // Amount is already stored with correct sign (positive or negative)
            // No need to adjust based on category - use the amount as stored
            categoryData[categoryId].accounts[accountId] += amount;
        }
    });
    
    // Convert to array and sort by category index
    extractData = Object.values(categoryData).sort((a, b) => {
        // Sort by index (1, 2, 2.1, 2.1.1, etc.)
        return compareIndexes(a.index, b.index);
    });
    
    console.log('Generated extract data:', extractData);
};

// Add Saldo Awal from previous month's monthlyBalances
const addSaldoAwalFromMonthlyBalances = async (categoryData, startMonth) => {
    try {
        // Calculate previous month
        const startDate = new Date(startMonth + '-01');
        const prevMonth = new Date(startDate);
        prevMonth.setMonth(prevMonth.getMonth() - 1);
        
        const prevYear = prevMonth.getFullYear();
        const prevMonthNumber = prevMonth.getMonth() + 1; // getMonth() returns 0-11
        const prevMonthKey = `${prevYear}-${String(prevMonthNumber).padStart(2, '0')}`;
        
        console.log(`Getting Saldo Awal from previous month: ${prevMonthKey}`);
        
        // Get monthlyBalances document for previous month
        const monthlyBalanceDoc = await db.collection('monthlyBalances').doc(prevMonthKey).get();
        
        if (monthlyBalanceDoc.exists) {
            const data = monthlyBalanceDoc.data();
            const accountBalances = data.accountBalances || {};
            
            console.log(`Found ${Object.keys(accountBalances).length} account balances for ${prevMonthKey}:`, accountBalances);
            
            // Find "1. Saldo Awal" category
            const saldoAwalCategory = allCategories.find(cat => cat.index.startsWith('1'));
            
            if (saldoAwalCategory && categoryData[saldoAwalCategory.id]) {
                // Add each account balance to Saldo Awal category
                Object.keys(accountBalances).forEach(accountId => {
                    const accountBalance = accountBalances[accountId];
                    if (accountBalance && typeof accountBalance.total === 'number') {
                        // Initialize if not exists
                        if (!categoryData[saldoAwalCategory.id].accounts[accountId]) {
                            categoryData[saldoAwalCategory.id].accounts[accountId] = 0;
                        }
                        
                        // Add the ending balance from previous month as starting balance
                        categoryData[saldoAwalCategory.id].accounts[accountId] += accountBalance.total;
                        
                        console.log(`Added ${formatCurrency(accountBalance.total)} to Saldo Awal for account: ${accountBalance.name}`);
                    }
                });
                
                console.log('Successfully added Saldo Awal from monthlyBalances');
            } else {
                console.log('Saldo Awal category not found or not in categoryData');
            }
        } else {
            console.log(`No monthlyBalances found for previous month: ${prevMonthKey}`);
        }
        
    } catch (error) {
        console.error('Error adding Saldo Awal from monthlyBalances:', error);
    }
};

// Filter transactions by date range
const filterTransactionsByDateRange = (startMonth, endMonth) => {
    const startDate = new Date(startMonth + '-01');
    const endDate = new Date(endMonth + '-01');
    endDate.setMonth(endDate.getMonth() + 1); // Include the entire end month
    endDate.setDate(0); // Last day of the end month
    endDate.setHours(23, 59, 59, 999);
    
    return allTransactions.filter(transaction => {
        const transactionDate = transaction.date.toDate ? transaction.date.toDate() : new Date(transaction.date);
        return transactionDate >= startDate && transactionDate <= endDate;
    });
};

// Create initial category structure
const createCategoryStructure = () => {
    const structure = {};
    
    // Get all categories from global categories array
    allCategories.forEach(category => {
        structure[category.id] = {
            id: category.id,
            name: category.fullName,
            index: category.index,
            accounts: {} // Will hold account_id: total_amount
        };
        
        // Initialize all accounts with 0
        allAccounts.forEach(account => {
            structure[category.id].accounts[account.id] = 0;
        });
    });
    
    return structure;
};

// Compare category indexes for sorting (1, 1.1, 1.2, 2, 2.1, etc.)
const compareIndexes = (a, b) => {
    const partsA = a.split('.').map(Number);
    const partsB = b.split('.').map(Number);
    
    const maxLength = Math.max(partsA.length, partsB.length);
    
    for (let i = 0; i < maxLength; i++) {
        const numA = partsA[i] || 0;
        const numB = partsB[i] || 0;
        
        if (numA !== numB) {
            return numA - numB;
        }
    }
    
    return 0;
};

// Display extract results
const displayExtractResults = (startMonth, endMonth) => {
    // Show results container
    document.getElementById('extractResults').classList.remove('hidden');
    
    // Display period
    const startDate = new Date(startMonth + '-01');
    const endDate = new Date(endMonth + '-01');
    const periodText = `Periode: ${startDate.toLocaleDateString('id-ID', { year: 'numeric', month: 'long' })} - ${endDate.toLocaleDateString('id-ID', { year: 'numeric', month: 'long' })}`;
    document.getElementById('extractPeriod').textContent = periodText;
    
    // Generate table headers
    generateTableHeaders();
    
    // Generate table rows
    generateTableRows();
    
    // Generate summary
    generateSummary();
    
    // Scroll to results
    document.getElementById('extractResults').scrollIntoView({ behavior: 'smooth' });
};

// Generate table headers
const generateTableHeaders = () => {
    const thead = document.querySelector('#extractTable thead');
    
    let headerHTML = '<tr>';
    
    // Keterangan column
    headerHTML += '<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50 sticky left-0">Keterangan</th>';
    
    // Account columns
    allAccounts.forEach(account => {
        headerHTML += `<th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Sum of ${account.name}</th>`;
    });
    
    // Total Kas Bank column
    headerHTML += '<th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider bg-blue-50 font-bold">Total Kas Bank</th>';
    
    // Total Kas column  
    headerHTML += '<th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider bg-yellow-50 font-bold">Total Kas</th>';
    
    headerHTML += '</tr>';
    
    thead.innerHTML = headerHTML;
};

// Generate table rows
const generateTableRows = () => {
    const tbody = document.getElementById('extractTableBody');
    let rowHTML = '';
    
    extractData.forEach((categoryData, index) => {
        rowHTML += '<tr class="' + (index % 2 === 0 ? 'bg-white' : 'bg-gray-50') + ' hover:bg-blue-50">';
        
        // Keterangan column with indentation based on category level
        const level = categoryData.index.split('.').length;
        const levelClass = `category-level-${Math.min(level, 5)}`;
        rowHTML += `<td class="py-3 text-sm font-medium text-gray-900 sticky left-0 bg-inherit ${levelClass}">${categoryData.name}</td>`;
        
        // Account columns
        let totalKasBank = 0;
        let totalKasTunai = 0;
        
        allAccounts.forEach(account => {
            const amount = categoryData.accounts[account.id] || 0;
            let formattedAmount = formatCurrency(amount);
            
            // Track totals
            if (account.name.toLowerCase().includes('bank')) {
                totalKasBank += amount;
            } else if (account.name.toLowerCase().includes('tunai')) {
                totalKasTunai += amount;
            }
            
            // Add color coding for positive/negative amounts
            let cellClass = 'py-3 text-sm text-right currency-cell';
            if (amount > 0) {
                cellClass += ' text-green-600 font-medium';
            } else if (amount < 0) {
                cellClass += ' text-red-600 font-medium';
            } else {
                cellClass += ' text-gray-500';
                formattedAmount = '-'; // Show dash for zero amounts
            }
            
            rowHTML += `<td class="${cellClass}">${formattedAmount}</td>`;
        });
        
        // Total Kas Bank column
        const totalKasBankFormatted = totalKasBank === 0 ? '-' : formatCurrency(totalKasBank);
        rowHTML += `<td class="py-3 text-sm text-right font-bold bg-blue-50 currency-cell ${totalKasBank >= 0 ? 'text-blue-600' : 'text-red-600'}">${totalKasBankFormatted}</td>`;
        
        // Total Kas column (Total Kas Bank + Kas Tunai)
        const totalKas = totalKasBank + totalKasTunai;
        const totalKasFormatted = totalKas === 0 ? '-' : formatCurrency(totalKas);
        rowHTML += `<td class="py-3 text-sm text-right font-bold bg-yellow-50 currency-cell ${totalKas >= 0 ? 'text-yellow-600' : 'text-red-600'}">${totalKasFormatted}</td>`;
        
        rowHTML += '</tr>';
    });
    
    tbody.innerHTML = rowHTML;
};

// Generate summary statistics
const generateSummary = () => {
    const summaryContainer = document.getElementById('extractSummary');
    
    // Calculate overall totals by account
    const accountTotals = {};
    allAccounts.forEach(account => {
        accountTotals[account.id] = {
            name: account.name,
            total: 0
        };
    });
    
    // Sum up all account totals from extract data
    extractData.forEach(categoryData => {
        allAccounts.forEach(account => {
            accountTotals[account.id].total += categoryData.accounts[account.id] || 0;
        });
    });
    
    // Generate dynamic summary cards for each account
    let summaryHTML = '';
    
    allAccounts.forEach((account, index) => {
        const total = accountTotals[account.id].total;
        const colorScheme = index % 3 === 0 ? 'blue' : index % 3 === 1 ? 'green' : 'purple';
        
        summaryHTML += `
            <div class="bg-${colorScheme}-50 border border-${colorScheme}-200 rounded-lg p-4">
                <h4 class="text-lg font-medium text-${colorScheme}-800 mb-2">${account.name}</h4>
                <p class="text-2xl font-bold text-${colorScheme}-600">${formatCurrency(total)}</p>
            </div>
        `;
    });
    
    // Calculate grand total
    const grandTotal = Object.values(accountTotals).reduce((sum, account) => sum + account.total, 0);
    
    summaryHTML += `
        <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <h4 class="text-lg font-medium text-yellow-800 mb-2">Total Keseluruhan</h4>
            <p class="text-2xl font-bold text-yellow-600">${formatCurrency(grandTotal)}</p>
        </div>
    `;
    
    summaryContainer.innerHTML = summaryHTML;
};

// Export to CSV
const exportToCSV = () => {
    if (!extractData || extractData.length === 0) {
        showError('Tidak ada data untuk diekspor.');
        return;
    }
    
    try {
        let csv = '';
        
        // Headers
        let headers = ['Keterangan'];
        allAccounts.forEach(account => {
            headers.push(`Sum of ${account.name}`);
        });
        headers.push('Total Kas Bank');
        headers.push('Total Kas');
        csv += headers.join(',') + '\n';
        
        // Data rows
        extractData.forEach(categoryData => {
            let row = [`"${categoryData.name}"`];
            
            let totalKasBank = 0;
            let totalKasTunai = 0;
            
            allAccounts.forEach(account => {
                const amount = categoryData.accounts[account.id] || 0;
                row.push(amount);
                
                if (account.name.toLowerCase().includes('bank')) {
                    totalKasBank += amount;
                } else if (account.name.toLowerCase().includes('tunai')) {
                    totalKasTunai += amount;
                }
            });
            
            row.push(totalKasBank);
            row.push(totalKasBank + totalKasTunai);
            
            csv += row.join(',') + '\n';
        });
        
        // Download CSV
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        
        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            
            const startMonth = document.getElementById('startMonth').value;
            const endMonth = document.getElementById('endMonth').value;
            link.setAttribute('download', `ekstrak_data_${startMonth}_${endMonth}.csv`);
            
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
        
    } catch (error) {
        console.error('Error exporting CSV:', error);
        showError('Gagal mengekspor data ke CSV: ' + error.message);
    }
};

// Print table
const printTable = () => {
    const printContent = document.getElementById('extractResults').innerHTML;
    const originalContent = document.body.innerHTML;
    
    document.body.innerHTML = `
        <html>
        <head>
            <title>Ekstrak Data - Forkris Accounting</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 20px; }
                table { border-collapse: collapse; width: 100%; font-size: 12px; }
                th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                th { background-color: #f2f2f2; font-weight: bold; }
                .text-right { text-align: right; }
                .bg-blue-50 { background-color: #eff6ff; }
                .bg-yellow-50 { background-color: #fefce8; }
                @media print {
                    .no-print { display: none; }
                }
            </style>
        </head>
        <body>
            ${printContent}
        </body>
        </html>
    `;
    
    // Hide buttons in print
    const buttons = document.querySelectorAll('button');
    buttons.forEach(btn => btn.style.display = 'none');
    
    window.print();
    document.body.innerHTML = originalContent;
    
    // Reinitialize page after print
    setTimeout(() => {
        initializeExtractPage();
    }, 100);
};

// Clear data and reset form
const clearData = () => {
    // Reset form
    document.getElementById('dateRangeForm').reset();
    setDefaultDateRange();
    
    // Hide results
    document.getElementById('extractResults').classList.add('hidden');
    hideError();
    
    // Clear data
    extractData = [];
};

// Show loading indicator
const showLoading = (show) => {
    const loading = document.getElementById('loadingIndicator');
    if (show) {
        loading.classList.remove('hidden');
    } else {
        loading.classList.add('hidden');
    }
};

// Show error message
const showError = (message) => {
    const errorDiv = document.getElementById('errorMessage');
    const errorText = document.getElementById('errorText');
    
    errorText.textContent = message;
    errorDiv.classList.remove('hidden');
    
    // Scroll to error
    errorDiv.scrollIntoView({ behavior: 'smooth' });
};

// Hide error message
const hideError = () => {
    document.getElementById('errorMessage').classList.add('hidden');
};

// Initialize page when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Page will be initialized by auth system, but set up form listener
    const form = document.getElementById('dateRangeForm');
    if (form) {
        form.addEventListener('submit', handleExtractSubmit);
    }
});

// Global functions
window.exportToCSV = exportToCSV;
window.printTable = printTable;
window.clearData = clearData;
