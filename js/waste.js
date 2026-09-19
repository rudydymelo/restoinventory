/**
 * waste.js — Waste Tracking (Spoilage / Expiry / Damage)
 * Depends on: storage.js, logs.js, inventory.js
 */

/**
 * Log a waste event: deducts from inventory and records to waste[].
 * @param {Object} data - { inventoryId, qty, reason }
 * @returns {Object} The created waste record
 */
function logWaste(data) {
    data.qty = parseFloat(data.qty) || 0;
    data.timestamp = new Date().toISOString();

    // Deduct from inventory
    const invItem = getIngredientById(data.inventoryId);
    if (invItem) {
        const newQty = Math.max(0, invItem.quantity - data.qty);
        Storage.updateItem('inventory', data.inventoryId, { quantity: newQty });
        data.itemName = invItem.name;
    } else {
        data.itemName = data.itemName || 'Unknown';
    }

    const entry = Storage.addItem('waste', data);
    logActivity('waste', `Wasted ${data.qty}${invItem ? invItem.unit : ''} of ${data.itemName}: ${data.reason}`, {
        wasteId: entry.id,
        inventoryId: data.inventoryId
    });
    return entry;
}

/**
 * Get all waste log entries, newest first.
 * @returns {Array}
 */
function getAllWaste() {
    return Storage.getAll('waste').sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}

/**
 * Aggregate waste data: per-item totals and overall waste cost.
 * @returns {{ byItem: Object, totalWasteCost: number, totalEntries: number }}
 */
function getWasteSummary() {
    const waste = Storage.getAll('waste');
    const byItem = {};
    let totalWasteCost = 0;

    waste.forEach(w => {
        if (!byItem[w.inventoryId]) {
            const inv = getIngredientById(w.inventoryId);
            byItem[w.inventoryId] = {
                itemName: w.itemName,
                totalQty: 0,
                unit: inv ? inv.unit : '',
                costPerUnit: inv ? inv.costPerUnit : 0,
                totalCost: 0
            };
        }
        byItem[w.inventoryId].totalQty += w.qty;
        const cost = w.qty * byItem[w.inventoryId].costPerUnit;
        byItem[w.inventoryId].totalCost += cost;
        totalWasteCost += cost;
    });

    return { byItem, totalWasteCost, totalEntries: waste.length };
}
