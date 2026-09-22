/**
 * billing.js — Billing & Order Management
 * Depends on: storage.js, logs.js, inventory.js, recipe.js, app.js
 */

/**
 * Check whether the inventory has enough stock to prepare a dish × qty.
 * @param {string} recipeId
 * @param {number} qty - Number of servings
 * @returns {{ available: boolean, message: string, shortages?: Array }}
 */
function checkStockAvailability(recipeId, qty) {
    const recipe = getRecipeById(recipeId);
    if (!recipe) return { available: false, message: 'Recipe not found.' };

    const shortages = [];

    for (const ing of recipe.ingredients) {
        const invItem  = getIngredientById(ing.inventoryId);
        const required = ing.qtyRequired * qty;

        if (!invItem) {
            shortages.push({ name: 'Unknown ingredient', unit: '', required, available: 0, shortBy: required });
            continue;
        }

        if (invItem.quantity < required) {
            shortages.push({
                name:      invItem.name,
                unit:      invItem.unit,
                required,
                available: invItem.quantity,
                shortBy:   required - invItem.quantity
            });
        }
    }

    if (shortages.length > 0) {
        const msgs = shortages.map(s => `${s.name} short by ${s.shortBy}${s.unit}`);
        return {
            available: false,
            message:   `Cannot prepare ${recipe.dishName}: ${msgs.join(', ')}`,
            shortages
        };
    }

    return { available: true, message: 'Stock sufficient.' };
}

/**
 * Deduct ingredient quantities for a dish × qty using FIFO batch deduction,
 * and fire low-stock toasts for any ingredient that drops below its threshold.
 * @param {string} recipeId
 * @param {number} qty
 */
function deductStockAndNotify(recipeId, qty) {
    const recipe = getRecipeById(recipeId);
    if (!recipe) return;

    const alerts = [];

    for (const ing of recipe.ingredients) {
        const invItem = getIngredientById(ing.inventoryId);
        if (!invItem) continue;

        // FIFO batch deduction (defined in inventory.js)
        deductFromBatches(ing.inventoryId, ing.qtyRequired * qty);

        // Re-fetch updated quantity to check threshold
        const refreshed = getIngredientById(ing.inventoryId);
        if (refreshed && refreshed.quantity < (refreshed.lowStockThreshold || 50)) {
            alerts.push({ name: refreshed.name, qty: refreshed.quantity, unit: refreshed.unit });
        }
    }

    // Fire low-stock toasts
    alerts.forEach(a => {
        showToast(`⚠️ Low Stock: "${a.name}" is running low (${a.qty} ${a.unit} remaining).`, 'warning');
    });

    logActivity('stock',
        `Ingredients deducted for cooking: ${qty}× "${recipe.dishName}" prepared — stock reduced for ${recipe.ingredients.length} ingredient(s).`,
        { recipeId, dishName: recipe.dishName, qty }
    );
}

/**
 * Calculate subtotal, tax (5%), and total for an array of order items.
 * @param {Array} items - [{ priceAtSale, qty }]
 * @returns {{ subtotal: number, tax: number, total: number }}
 */
function calculateTotal(items) {
    const subtotal = items.reduce((sum, item) => sum + (item.priceAtSale * item.qty), 0);
    const tax      = Math.round(subtotal * 0.05 * 100) / 100;  // 5% GST
    const total    = Math.round((subtotal + tax) * 100) / 100;
    return { subtotal, tax, total };
}

/**
 * Persist a completed bill and log the activity.
 * @param {Object} billData - { tableNumber, items, subtotal, tax, total }
 * @returns {Object} The saved bill record
 */
function createBill(billData) {
    billData.timestamp = new Date().toISOString();
    const bill = Storage.addItem('bills', billData);

    const itemsSummary = billData.items
        .map(i => `${i.qty}× ${i.dishName} (${formatCurrency(i.priceAtSale)} each)`)
        .join('; ');

    logActivity('billing',
        `New bill created for Table ${billData.tableNumber} — ${billData.items.length} item(s): ${itemsSummary}. Subtotal: ${formatCurrency(billData.subtotal)}, Tax (5% GST): ${formatCurrency(billData.tax)}, Total Charged: ${formatCurrency(billData.total)}.`,
        { billId: bill.id, tableNumber: billData.tableNumber, total: billData.total }
    );
    return bill;
}

/**
 * Get all bills.
 * @returns {Array}
 */
function getAllBills() {
    return Storage.getAll('bills');
}
