// Categories management system
let allCategories = [];
let categoryHierarchy = {};

// Load all categories from Firestore
const loadCategories = async () => {
    try {
        const snapshot = await db.collection('categories').orderBy('index').get();
        allCategories = [];
        categoryHierarchy = {};
        
        snapshot.forEach(doc => {
            const category = { id: doc.id, ...doc.data() };
            allCategories.push(category);
            
            // Build hierarchy
            if (!categoryHierarchy[category.level]) {
                categoryHierarchy[category.level] = {};
            }
            
            const parentKey = category.parentId || 'root';
            if (!categoryHierarchy[category.level][parentKey]) {
                categoryHierarchy[category.level][parentKey] = [];
            }
            categoryHierarchy[category.level][parentKey].push(category);
        });
        
        return allCategories;
    } catch (error) {
        console.error('Error loading categories:', error);
        return [];
    }
};

// Get categories by parent ID
const getCategoriesByParent = (parentId = null, level = 1) => {
    const parentKey = parentId || 'root';
    return categoryHierarchy[level] && categoryHierarchy[level][parentKey] 
        ? categoryHierarchy[level][parentKey] 
        : [];
};

// Get category by ID
const getCategoryById = (categoryId) => {
    return allCategories.find(cat => cat.id === categoryId) || null;
};

// Get full category path
const getCategoryPath = (categoryId) => {
    const category = getCategoryById(categoryId);
    if (!category) return '';
    
    let path = category.fullName;
    return path;
};

// Get all child categories of a parent (recursive)
const getAllChildCategories = (parentId) => {
    let children = [];
    
    // Get direct children
    const directChildren = allCategories.filter(cat => cat.parentId === parentId);
    children.push(...directChildren);
    
    // Get children of children recursively
    directChildren.forEach(child => {
        children.push(...getAllChildCategories(child.id));
    });
    
    return children;
};

// Populate category select dropdown
const populateCategorySelect = (selectElement, parentId = null, level = 1, placeholder = 'Pilih kategori...', excludeIndexes = []) => {
    selectElement.innerHTML = `<option value="">${placeholder}</option>`;
    
    const categories = getCategoriesByParent(parentId, level);
    
    // Filter out excluded categories
    const filteredCategories = categories.filter(category => {
        return !excludeIndexes.some(excludeIndex => category.index.startsWith(excludeIndex));
    });
    
    filteredCategories.forEach(category => {
        const option = document.createElement('option');
        option.value = category.id;
        option.textContent = category.fullName;
        selectElement.appendChild(option);
    });
};

// Handle dynamic category selection for forms
const setupCategorySelectors = () => {
    const selectors = ['category1', 'category2', 'category3', 'category4', 'category5'];
    
    selectors.forEach((selectorId, index) => {
        const select = document.getElementById(selectorId);
        const nextIndex = index + 1;
        const nextSelector = selectors[nextIndex];
        
        if (select) {
            select.addEventListener('change', async (e) => {
                const selectedValue = e.target.value;
                
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
                
                if (selectedValue && nextSelector) {
                    // Get children of selected category
                    const children = getCategoriesByParent(selectedValue, index + 2);
                    
                    if (children.length > 0) {
                        // Show next selector if there are children
                        const nextContainer = document.getElementById(`${nextSelector}Container`);
                        const nextSelect = document.getElementById(nextSelector);
                        
                        if (nextContainer && nextSelect) {
                            nextContainer.classList.remove('hidden');
                            populateCategorySelect(nextSelect, selectedValue, index + 2);
                        }
                    } else {
                        // No children, show selected category
                        updateSelectedCategoryDisplay(selectedValue);
                    }
                } else if (selectedValue) {
                    // Show selected category
                    updateSelectedCategoryDisplay(selectedValue);
                }
            });
        }
    });
};

// Update selected category display
const updateSelectedCategoryDisplay = (categoryId) => {
    const display = document.getElementById('selectedCategoryDisplay');
    const text = document.getElementById('selectedCategoryText');
    
    if (display && text && categoryId) {
        const category = getCategoryById(categoryId);
        if (category) {
            text.textContent = category.fullName;
            display.classList.remove('hidden');
            
            // Store selected category data
            if (window.selectedCategory !== undefined) {
                window.selectedCategory = category;
            }
        }
    } else if (display) {
        display.classList.add('hidden');
        if (window.selectedCategory !== undefined) {
            window.selectedCategory = null;
        }
    }
};

// Get currently selected category from form
const getSelectedCategory = () => {
    const selectors = ['category5', 'category4', 'category3', 'category2', 'category1'];
    
    for (const selectorId of selectors) {
        const select = document.getElementById(selectorId);
        if (select && select.value) {
            return getCategoryById(select.value);
        }
    }
    
    return null;
};

// Add new category
const addCategory = async (categoryData) => {
    try {
        // Generate new ID based on parent
        let newId;
        if (categoryData.parentId) {
            const siblings = getCategoriesByParent(categoryData.parentId, categoryData.level);
            let maxIndex = 0;
            if (siblings.length > 0) {
                const indices = siblings.map(cat => {
                    const parts = cat.index.split('.');
                    return parseInt(parts[parts.length - 1]) || 0;
                });
                maxIndex = Math.max(...indices);
            }
            newId = `${categoryData.parentId}.${maxIndex + 1}`;
        } else {
            const rootCategories = getCategoriesByParent(null, 1);
            let maxIndex = 0;
            if (rootCategories.length > 0) {
                const indices = rootCategories.map(cat => parseInt(cat.index) || 0);
                maxIndex = Math.max(...indices);
            }
            newId = (maxIndex + 1).toString();
        }
        
        const fullName = `${newId}. ${categoryData.name}`;
        
        const newCategory = {
            ...categoryData,
            id: newId,
            index: newId,
            fullName: fullName,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        await db.collection('categories').doc(newId).set(newCategory);
        
        // Reload categories
        await loadCategories();
        return newCategory;
    } catch (error) {
        console.error('Error adding category:', error);
        throw error;
    }
};

// Update category
const updateCategory = async (categoryId, updates) => {
    try {
        const category = getCategoryById(categoryId);
        if (!category) {
            throw new Error('Category not found');
        }
        
        // Update full name if name is being changed
        if (updates.name) {
            updates.fullName = `${category.index}. ${updates.name}`;
        }
        
        updates.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
        
        await db.collection('categories').doc(categoryId).update(updates);
        
        // Reload categories
        await loadCategories();
        return true;
    } catch (error) {
        console.error('Error updating category:', error);
        throw error;
    }
};

// Get category statistics
const getCategoryStatistics = async (categoryId, startDate = null, endDate = null) => {
    try {
        let query = db.collection('transactions')
            .where('categoryId', '==', categoryId);
        
        if (startDate) {
            query = query.where('date', '>=', startDate);
        }
        
        if (endDate) {
            query = query.where('date', '<=', endDate);
        }
        
        const snapshot = await query.get();
        
        const stats = {
            kasTunai: 0,
            kasBankLingkungan: 0,
            kasBankDanaSosial: 0,
            saldoKas: 0,
            totalTransactions: snapshot.size
        };
        
        snapshot.forEach(doc => {
            const transaction = doc.data();
            const amount = transaction.amount || 0;
            
            switch (transaction.accountType) {
                case 'kas-tunai':
                    stats.kasTunai += amount;
                    break;
                case 'kas-bank-lingkungan':
                    stats.kasBankLingkungan += amount;
                    break;
                case 'kas-bank-dana-sosial':
                    stats.kasBankDanaSosial += amount;
                    break;
                case 'saldo-kas':
                    stats.saldoKas += amount;
                    break;
            }
        });
        
        return stats;
    } catch (error) {
        console.error('Error getting category statistics:', error);
        return {
            kasTunai: 0,
            kasBankLingkungan: 0,
            kasBankDanaSosial: 0,
            saldoKas: 0,
            totalTransactions: 0
        };
    }
};

// Get aggregated statistics for category and all its children
const getAggregatedCategoryStatistics = async (categoryId, startDate = null, endDate = null) => {
    try {
        const category = getCategoryById(categoryId);
        if (!category) {
            throw new Error('Category not found');
        }
        
        // Get the category and all its children
        const categoriesToCheck = [categoryId, ...getAllChildCategories(categoryId).map(cat => cat.id)];
        
        let query = db.collection('transactions')
            .where('categoryId', 'in', categoriesToCheck.slice(0, 10)); // Firestore 'in' limit is 10
        
        if (startDate) {
            query = query.where('date', '>=', startDate);
        }
        
        if (endDate) {
            query = query.where('date', '<=', endDate);
        }
        
        const snapshot = await query.get();
        
        const stats = {
            kasTunai: 0,
            kasBankLingkungan: 0,
            kasBankDanaSosial: 0,
            saldoKas: 0,
            totalTransactions: snapshot.size,
            categoryName: category.fullName
        };
        
        snapshot.forEach(doc => {
            const transaction = doc.data();
            const amount = transaction.amount || 0;
            
            // Determine if it's income or expense based on category
            const isExpense = category.index.startsWith('3');
            const multiplier = isExpense ? -1 : 1;
            const adjustedAmount = amount * multiplier;
            
            switch (transaction.accountType) {
                case 'kas-tunai':
                    stats.kasTunai += adjustedAmount;
                    break;
                case 'kas-bank-lingkungan':
                    stats.kasBankLingkungan += adjustedAmount;
                    break;
                case 'kas-bank-dana-sosial':
                    stats.kasBankDanaSosial += adjustedAmount;
                    break;
                case 'saldo-kas':
                    stats.saldoKas += adjustedAmount;
                    break;
            }
        });
        
        return stats;
    } catch (error) {
        console.error('Error getting aggregated category statistics:', error);
        return {
            kasTunai: 0,
            kasBankLingkungan: 0,
            kasBankDanaSosial: 0,
            saldoKas: 0,
            totalTransactions: 0,
            categoryName: 'Unknown'
        };
    }
};

// Initialize categories when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
    await loadCategories();
    
    // Setup category selectors if they exist
    if (document.getElementById('category1')) {
        setupCategorySelectors();
        
        // Populate first level
        const category1Select = document.getElementById('category1');
        populateCategorySelect(category1Select, null, 1, 'Pilih Kategori Utama');
    }
});

