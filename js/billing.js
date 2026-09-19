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
        const invItem = getIngredientById(ing.inventoryId);
        const required = ing.qtyRequired * qty;

        if (!invItem) {
            shortages.push({ name: 'Unknown ingredient', unit: '', required, available: 0, shortBy: required });
            continue;
        }

        if (invItem.quantity < required) {
            shortages.push({
                name: invItem.name,
                unit: invItem.unit,
                required,
                available: invItem.quantity,
                shortBy: required - invItem.quantity
            });
        }
    }

    if (shortages.length > 0) {
        const msgs = shortages.map(s => `${s.name} short by ${s.shortBy}${s.unit}`);
        return {
            available: false,
            message: `Cannot prepare ${recipe.dishName}: ${msgs.join(', ')}`,
            shortages
        };
    }

    return { available: true, message: 'Stock sufficient.' };
}

/**
 * Deduct ingredient quantities for a dish × qty and fire low-stock toasts.
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

        const newQty = Math.max(0, invItem.quantity - (ing.qtyRequired * qty));
        Storage.updateItem('inventory', ing.inventoryId, { quantity: newQty });

        if (newQty < (invItem.lowStockThreshold || 50)) {
            alerts.push(invItem.name);
        }
    }

    // Fire low-stock toasts
    alerts.forEach(name => {
        showToast(`⚠️ Low Stock Alert: ${name} is running low!`, 'warning');
    });

    logActivity('stock', `Stock deducted for ${qty}× ${recipe.dishName}`, { recipeId, qty });
}

/**
 * Calculate subtotal, tax (5%), and total for an array of order items.
 * @param {Array} items - [{ priceAtSale, qty }]
 * @returns {{ subtotal: number, tax: number, total: number }}
 */
function calculateTotal(items) {
    const subtotal = items.reduce((sum, item) => sum + (item.priceAtSale * item.qty), 0);
    const tax = Math.round(subtotal * 0.05 * 100) / 100;  // 5% GST
    const total = Math.round((subtotal + tax) * 100) / 100;
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
    logActivity('billing', `Bill #${bill.id} created for Table ${billData.tableNumber} — Total: ${formatCurrency(billData.total)}`, {
        billId: bill.id,
        total: billData.total
    });
    return bill;
}

/**
 * Get all bills.
 * @returns {Array}
 */
function getAllBills() {
    return Storage.getAll('bills');
}
