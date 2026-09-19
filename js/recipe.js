/**
 * recipe.js — Recipe / Dish Management
 * Depends on: storage.js, logs.js, inventory.js
 */

/**
 * Add a new dish/recipe.
 * @param {Object} data - { dishName, category, price, ingredients: [{ inventoryId, qtyRequired }] }
 * @returns {Object} The created recipe record
 */
function addDish(data) {
    data.price = parseFloat(data.price) || 0;
    data.ingredients = (data.ingredients || []).map(ing => ({
        inventoryId: ing.inventoryId,
        qtyRequired: parseFloat(ing.qtyRequired) || 0
    }));
    const item = Storage.addItem('recipes', data);
    logActivity('menu', `Added dish: ${data.dishName} (${formatCurrency(data.price)})`, { dishId: item.id });
    return item;
}

/**
 * Edit an existing dish/recipe.
 * @param {string} id
 * @param {Object} data - Fields to update
 * @returns {Object|null}
 */
function editDish(id, data) {
    if (data.price !== undefined) data.price = parseFloat(data.price);
    if (data.ingredients) {
        data.ingredients = data.ingredients.map(ing => ({
            inventoryId: ing.inventoryId,
            qtyRequired: parseFloat(ing.qtyRequired) || 0
        }));
    }
    const item = Storage.updateItem('recipes', id, data);
    if (item) logActivity('menu', `Updated dish: ${item.dishName}`, { dishId: id, changes: data });
    return item;
}

/**
 * Delete a dish by id.
 * @param {string} id
 * @returns {boolean}
 */
function deleteDish(id) {
    const item = Storage.findById('recipes', id);
    const ok = Storage.deleteItem('recipes', id);
    if (item) logActivity('menu', `Deleted dish: ${item.dishName}`, { dishId: id });
    return ok;
}

/**
 * Get all dishes/recipes.
 * @returns {Array}
 */
function getAllDishes() {
    return Storage.getAll('recipes');
}

/**
 * Find a single recipe by id.
 * @param {string} id
 * @returns {Object|null}
 */
function getRecipeById(id) {
    return Storage.findById('recipes', id);
}
