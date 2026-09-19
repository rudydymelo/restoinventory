/**
 * inventory.js — Inventory (Ingredient) Management
 * Depends on: storage.js, logs.js
 */

/**
 * Add a new ingredient to inventory.
 * @param {Object} data - { name, category, quantity, unit, costPerUnit, lowStockThreshold }
 * @returns {Object} The created ingredient record
 */
function addIngredient(data) {
    data.quantity = parseFloat(data.quantity) || 0;
    data.costPerUnit = parseFloat(data.costPerUnit) || 0;
    data.lowStockThreshold = parseFloat(data.lowStockThreshold) || 50;
    const item = Storage.addItem('inventory', data);
    logActivity('stock', `Added ingredient: ${data.name} (${data.quantity} ${data.unit})`, { itemId: item.id, name: data.name });
    return item;
}

/**
 * Update an existing ingredient.
 * @param {string} id
 * @param {Object} data - Fields to update
 * @returns {Object|null} Updated record or null
 */
function updateIngredient(id, data) {
    if (data.quantity !== undefined) data.quantity = parseFloat(data.quantity);
    if (data.costPerUnit !== undefined) data.costPerUnit = parseFloat(data.costPerUnit);
    if (data.lowStockThreshold !== undefined) data.lowStockThreshold = parseFloat(data.lowStockThreshold);
    const item = Storage.updateItem('inventory', id, data);
    if (item) logActivity('stock', `Updated ingredient: ${item.name}`, { itemId: id, changes: data });
    return item;
}

/**
 * Delete an ingredient by id.
 * @param {string} id
 * @returns {boolean}
 */
function deleteIngredient(id) {
    const item = Storage.findById('inventory', id);
    const ok = Storage.deleteItem('inventory', id);
    if (item) logActivity('stock', `Deleted ingredient: ${item.name}`, { itemId: id });
    return ok;
}

/**
 * Get all ingredients.
 * @returns {Array}
 */
function getAllIngredients() {
    return Storage.getAll('inventory');
}

/**
 * Find a single ingredient by id.
 * @param {string} id
 * @returns {Object|null}
 */
function getIngredientById(id) {
    return Storage.findById('inventory', id);
}

/**
 * Get ingredients whose quantity is below their lowStockThreshold.
 * @returns {Array}
 */
function getLowStockItems() {
    return getAllIngredients().filter(item => item.quantity < (item.lowStockThreshold || 50));
}

/**
 * Generate a purchase order for low-stock items.
 * Suggests ordering enough to reach 2× the threshold.
 * @returns {Array} Purchase order line items
 */
function generatePurchaseOrder() {
    return getLowStockItems().map(item => {
        const target = (item.lowStockThreshold || 50) * 2;
        const orderQty = Math.max(0, target - item.quantity);
        return {
            ...item,
            requiredQty: orderQty,
            estimatedCost: orderQty * item.costPerUnit
        };
    });
}

/**
 * Return an HTML badge string reflecting the stock status.
 * Green ≥ threshold, Orange 1..threshold-1, Red = 0
 * @param {Object} item - Inventory item
 * @returns {string} HTML badge
 */
function getStockBadge(item) {
    const threshold = item.lowStockThreshold || 50;
    if (item.quantity === 0) return '<span class="badge bg-danger">Out of Stock</span>';
    if (item.quantity < threshold) return '<span class="badge bg-warning text-dark">Low Stock</span>';
    return '<span class="badge bg-success">In Stock</span>';
}
