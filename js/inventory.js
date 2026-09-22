/**
 * inventory.js — Inventory (Ingredient) Management
 * Depends on: storage.js, logs.js
 */

/**
 * Find an existing ingredient by name (case-insensitive).
 * @param {string} name
 * @returns {Object|null}
 */
function findIngredientByName(name) {
    const normalized = name.trim().toLowerCase();
    return getAllIngredients().find(item => item.name.toLowerCase() === normalized) || null;
}

/**
 * Recalculate total quantity from all batches and sync it to the item record.
 * @param {string} id - Ingredient id
 * @returns {Object|null} Updated item
 */
function syncQuantityFromBatches(id) {
    const item = Storage.findById('inventory', id);
    if (!item) return null;
    const total = (item.batches || []).reduce((sum, b) => sum + (b.qty || 0), 0);
    return Storage.updateItem('inventory', id, { quantity: total });
}

/**
 * Add a new ingredient to inventory.
 * If an ingredient with the same name already exists (case-insensitive),
 * a new batch is added to that item instead of creating a duplicate.
 * @param {Object} data - { name, category, quantity, unit, costPerUnit, lowStockThreshold, expiryDate }
 * @returns {Object} Created or merged ingredient record
 */
function addIngredient(data) {
    const qty      = parseFloat(data.quantity) || 0;
    const expiry   = data.expiryDate || '';

    // Case-insensitive duplicate guard
    const existing = findIngredientByName(data.name);
    if (existing) {
        showToast(`"${existing.name}" already exists — new stock added as a new batch.`, 'info');
        return addStockBatch(existing.id, qty, expiry, data.costPerUnit);
    }

    data.quantity         = qty;
    data.costPerUnit      = parseFloat(data.costPerUnit) || 0;
    data.lowStockThreshold = parseFloat(data.lowStockThreshold) || 50;

    data.batches = [{
        batchId:    Storage.generateId(),
        qty,
        expiryDate: expiry,
        addedOn:    new Date().toISOString()
    }];

    const item        = Storage.addItem('inventory', data);
    const expiryText  = expiry ? `, expires ${formatDateShort(expiry)}` : ', no expiry date set';
    logActivity('stock',
        `New ingredient added: "${data.name}" — ${qty} ${data.unit} at ${formatCurrency(data.costPerUnit)} per ${data.unit}${expiryText}.`,
        { itemId: item.id, name: data.name, qty, unit: data.unit, expiryDate: expiry }
    );
    return item;
}

/**
 * Add a new stock batch to an existing ingredient.
 * @param {string} id           - Ingredient id
 * @param {number} qty          - Quantity being added
 * @param {string} expiryDate   - YYYY-MM-DD expiry date
 * @param {number} [newCost]    - Optionally update cost per unit
 * @returns {Object|null} Updated ingredient record
 */
function addStockBatch(id, qty, expiryDate, newCost) {
    qty = parseFloat(qty) || 0;
    const item = Storage.findById('inventory', id);
    if (!item) return null;

    const newBatch = {
        batchId:    Storage.generateId(),
        qty,
        expiryDate: expiryDate || '',
        addedOn:    new Date().toISOString()
    };

    const batches = [...(item.batches || []), newBatch];
    const updates = { batches };
    if (newCost !== undefined && newCost !== '') {
        updates.costPerUnit = parseFloat(newCost) || item.costPerUnit;
    }
    Storage.updateItem('inventory', id, updates);
    const updated    = syncQuantityFromBatches(id);
    const expiryText = expiryDate ? `, expires ${formatDateShort(expiryDate)}` : ', no expiry date set';

    logActivity('stock',
        `Stock restocked: "${item.name}" — ${qty} ${item.unit} added as a new batch${expiryText}. New total: ${updated ? updated.quantity : '?'} ${item.unit}.`,
        { itemId: id, name: item.name, addedQty: qty, expiryDate }
    );
    return updated;
}

/**
 * Remove a quantity from a specific batch. The removed stock is logged to
 * the Waste Log with the supplied reason.
 * @param {string} itemId  - Ingredient id
 * @param {string} batchId - Batch id
 * @param {number} qty     - Quantity to remove
 * @param {string} reason  - Required reason for removal
 * @returns {Object|null} Updated ingredient record
 */
function removeBatch(itemId, batchId, qty, reason) {
    qty = parseFloat(qty) || 0;
    const item = Storage.findById('inventory', itemId);
    if (!item) return null;

    let batches  = item.batches || [];
    const bIdx   = batches.findIndex(b => b.batchId === batchId);
    if (bIdx === -1) return null;

    const batch     = batches[bIdx];
    const actualQty = Math.min(qty, batch.qty);

    if (actualQty >= batch.qty) {
        batches.splice(bIdx, 1);          // remove entire batch
    } else {
        batches[bIdx] = { ...batch, qty: batch.qty - actualQty }; // partial
    }

    Storage.updateItem('inventory', itemId, { batches });
    const updated = syncQuantityFromBatches(itemId);

    // Record removal in waste log
    Storage.addItem('waste', {
        inventoryId: itemId,
        itemName:    item.name,
        qty:         actualQty,
        unit:        item.unit,
        reason:      reason || 'Manual stock removal',
        costPerUnit: item.costPerUnit,
        timestamp:   new Date().toISOString()
    });

    logActivity('stock',
        `Stock removed: "${item.name}" — ${actualQty} ${item.unit} taken out of inventory. Reason: "${reason || 'Manual stock removal'}". Remaining total: ${updated ? updated.quantity : '?'} ${item.unit}.`,
        { itemId, name: item.name, removedQty: actualQty, reason }
    );
    return updated;
}

/**
 * Deduct ingredient stock in FIFO order (earliest expiry consumed first).
 * Used by billing when a dish is prepared. Falls back gracefully for
 * legacy items that have no batch data.
 * @param {string} itemId
 * @param {number} qty
 */
function deductFromBatches(itemId, qty) {
    const item = Storage.findById('inventory', itemId);
    if (!item) return;

    // Legacy item (no batches) — simple quantity deduction
    if (!item.batches || item.batches.length === 0) {
        const newQty = Math.max(0, item.quantity - qty);
        Storage.updateItem('inventory', itemId, { quantity: newQty });
        return;
    }

    // Sort by expiry: soonest first; batches without expiry go last
    let batches = [...item.batches].sort((a, b) => {
        if (!a.expiryDate && !b.expiryDate) return 0;
        if (!a.expiryDate) return 1;
        if (!b.expiryDate) return -1;
        return a.expiryDate.localeCompare(b.expiryDate);
    });

    let remaining = qty;
    batches = batches.map(b => {
        if (remaining <= 0) return b;
        const deduct = Math.min(remaining, b.qty);
        remaining   -= deduct;
        return { ...b, qty: b.qty - deduct };
    }).filter(b => b.qty > 0);

    Storage.updateItem('inventory', itemId, { batches });
    syncQuantityFromBatches(itemId);
}

/**
 * Update ingredient details (name, category, unit, cost, threshold).
 * Quantity is always computed from batches — do not pass it here.
 * @param {string} id
 * @param {Object} data
 * @returns {Object|null}
 */
function updateIngredient(id, data) {
    if (data.costPerUnit      !== undefined) data.costPerUnit      = parseFloat(data.costPerUnit);
    if (data.lowStockThreshold !== undefined) data.lowStockThreshold = parseFloat(data.lowStockThreshold);
    delete data.quantity; // controlled by batches, never override directly
    const item = Storage.updateItem('inventory', id, data);
    if (item) logActivity('stock',
        `Ingredient details updated: "${item.name}" — category, unit cost, or low-stock threshold was changed.`,
        { itemId: id }
    );
    return item;
}

/**
 * Delete an ingredient and all of its batches permanently.
 * @param {string} id
 * @returns {boolean}
 */
function deleteIngredient(id) {
    const item = Storage.findById('inventory', id);
    const ok   = Storage.deleteItem('inventory', id);
    if (item) logActivity('stock',
        `Ingredient deleted: "${item.name}" — ${(item.batches || []).length} batch(es) totalling ${item.quantity} ${item.unit} permanently removed from inventory.`,
        { itemId: id, name: item.name }
    );
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
 * Get ingredients whose quantity is below their low-stock threshold.
 * @returns {Array}
 */
function getLowStockItems() {
    return getAllIngredients().filter(item => item.quantity < (item.lowStockThreshold || 50));
}

/**
 * Return the nearest (soonest) expiry date among an item's batches.
 * @param {Object} item
 * @returns {string|null} YYYY-MM-DD or null
 */
function getNearestExpiry(item) {
    const batches = (item.batches || []).filter(b => b.expiryDate);
    if (!batches.length) return null;
    return batches.reduce((min, b) => (!min || b.expiryDate < min) ? b.expiryDate : min, null);
}

/**
 * Scan every batch of every ingredient. Automatically moves expired batches
 * to the Waste Log. Shows warning toasts for batches expiring within 3 days.
 * Call this on every page load.
 */
function checkExpiryAndAutoWaste() {
    const today    = new Date(); today.setHours(0, 0, 0, 0);
    const warnDate = new Date(today); warnDate.setDate(warnDate.getDate() + 3);

    const items       = getAllIngredients();
    let   expiredCount = 0;
    const soonExpiring = [];

    items.forEach(item => {
        const batches  = item.batches || [];
        const toExpire = [];
        const toWarn   = [];

        batches.forEach(batch => {
            if (!batch.expiryDate) return;
            const exp = new Date(batch.expiryDate); exp.setHours(0, 0, 0, 0);
            if      (exp <  today)    toExpire.push(batch);
            else if (exp <= warnDate) toWarn.push(batch);
        });

        // Auto-waste each expired batch
        toExpire.forEach(batch => {
            const current = Storage.findById('inventory', item.id);
            if (!current) return;

            const remaining = (current.batches || []).filter(b => b.batchId !== batch.batchId);
            Storage.updateItem('inventory', item.id, { batches: remaining });
            syncQuantityFromBatches(item.id);

            const expiredOn = formatDateShort(batch.expiryDate);
            Storage.addItem('waste', {
                inventoryId:  item.id,
                itemName:     item.name,
                qty:          batch.qty,
                unit:         item.unit,
                reason:       `Auto-expired: batch expired on ${expiredOn}`,
                costPerUnit:  item.costPerUnit,
                timestamp:    new Date().toISOString(),
                autoExpired:  true
            });

            logActivity('waste',
                `AUTO-EXPIRY: "${item.name}" — ${batch.qty} ${item.unit} passed its expiry date (${expiredOn}) and has been automatically moved to the Waste Log.`,
                { itemId: item.id, expiredQty: batch.qty, expiryDate: batch.expiryDate }
            );
            expiredCount++;
        });

        // Collect one warning per item (the soonest-expiring batch)
        if (toWarn.length) {
            const nearest = toWarn.reduce((mn, b) => (!mn || b.expiryDate < mn.expiryDate) ? b : mn, null);
            soonExpiring.push({ name: item.name, expiryDate: nearest.expiryDate, qty: nearest.qty, unit: item.unit });
        }
    });

    // Show notification toasts
    if (expiredCount > 0) {
        showToast(`🗑️ ${expiredCount} expired batch(es) automatically moved to Waste Log.`, 'danger');
    }
    soonExpiring.forEach(i => {
        showToast(`⚠️ Expiring Soon: "${i.name}" — ${i.qty} ${i.unit} expires on ${formatDateShort(i.expiryDate)}.`, 'warning');
    });
}

/**
 * Generate a purchase order suggestion for all low-stock items.
 * @returns {Array}
 */
function generatePurchaseOrder() {
    return getLowStockItems().map(item => {
        const target   = (item.lowStockThreshold || 50) * 2;
        const orderQty = Math.max(0, target - item.quantity);
        return { ...item, requiredQty: orderQty, estimatedCost: orderQty * item.costPerUnit };
    });
}

/**
 * HTML stock-level badge.
 * @param {Object} item
 * @returns {string} HTML string
 */
function getStockBadge(item) {
    const threshold = item.lowStockThreshold || 50;
    if (item.quantity === 0)          return '<span class="badge bg-danger">Out of Stock</span>';
    if (item.quantity < threshold)    return '<span class="badge bg-warning text-dark">Low Stock</span>';
    return '<span class="badge bg-success">In Stock</span>';
}

/**
 * HTML expiry badge showing the nearest expiry date.
 * Red = expired, Orange = within 3 days, Green = healthy.
 * @param {Object} item
 * @returns {string} HTML string
 */
function getExpiryBadge(item) {
    const nearest = getNearestExpiry(item);
    if (!nearest) return '<span class="text-muted small">—</span>';

    const today = new Date(); today.setHours(0, 0, 0, 0);
    const exp   = new Date(nearest); exp.setHours(0, 0, 0, 0);
    const days  = Math.ceil((exp - today) / 86400000);

    if (days < 0)  return `<span class="badge bg-danger">Expired</span>`;
    if (days === 0) return `<span class="badge bg-danger">Expires Today!</span>`;
    if (days <= 3) return `<span class="badge bg-warning text-dark">Expires in ${days}d</span>`;
    return `<span class="badge bg-success">${formatDateShort(nearest)}</span>`;
}
