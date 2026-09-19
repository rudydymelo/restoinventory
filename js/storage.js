/**
 * storage.js — Data Abstraction Layer
 * All data access goes through this module.
 * Never call localStorage directly from other modules.
 * Designed so this layer can be swapped for a real DB later.
 */

const Storage = {

    /* ───── Core CRUD ───── */

    /**
     * Retrieve a parsed value from storage by key.
     * @param {string} key
     * @returns {*} Parsed object/array, or null if not found
     */
    getItem(key) {
        const raw = localStorage.getItem(key);
        if (raw === null) return null;
        try {
            return JSON.parse(raw);
        } catch {
            return raw;
        }
    },

    /**
     * Store a value under the given key (serialised to JSON).
     * @param {string} key
     * @param {*} value
     */
    setItem(key, value) {
        localStorage.setItem(key, JSON.stringify(value));
    },

    /**
     * Remove a key from storage.
     * @param {string} key
     */
    removeItem(key) {
        localStorage.removeItem(key);
    },

    /**
     * Get all items for an array-based key; returns [] if key is missing.
     * @param {string} key
     * @returns {Array}
     */
    getAll(key) {
        return this.getItem(key) || [];
    },

    /**
     * Append a new item to an array-based key.
     * Automatically assigns an id if missing.
     * @param {string} key
     * @param {Object} item
     * @returns {Object} The inserted item (with id)
     */
    addItem(key, item) {
        const items = this.getAll(key);
        if (!item.id) item.id = this.generateId();
        items.push(item);
        this.setItem(key, items);
        return item;
    },

    /**
     * Update an existing item by id inside an array-based key.
     * Merges updatedFields into the existing record.
     * @param {string} key
     * @param {string} id
     * @param {Object} updatedFields
     * @returns {Object|null} Updated item or null if not found
     */
    updateItem(key, id, updatedFields) {
        const items = this.getAll(key);
        const idx = items.findIndex(i => i.id === id);
        if (idx === -1) return null;
        items[idx] = { ...items[idx], ...updatedFields };
        this.setItem(key, items);
        return items[idx];
    },

    /**
     * Delete an item by id from an array-based key.
     * @param {string} key
     * @param {string} id
     * @returns {boolean} True if an item was removed
     */
    deleteItem(key, id) {
        const items = this.getAll(key);
        const filtered = items.filter(i => i.id !== id);
        this.setItem(key, filtered);
        return filtered.length < items.length;
    },

    /**
     * Find a single item by id in an array-based key.
     * @param {string} key
     * @param {string} id
     * @returns {Object|null}
     */
    findById(key, id) {
        return this.getAll(key).find(i => i.id === id) || null;
    },

    /* ───── Helpers ───── */

    /**
     * Generate a unique id string.
     * @returns {string}
     */
    generateId() {
        return 'id_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    },

    /* ───── Seed / Demo Data ───── */

    /**
     * Populate localStorage with realistic demo data on first run.
     * Subsequent calls are a no-op.
     */
    initializeDefaults() {
        if (this.getItem('_initialized')) return;

        // ── Demo user ──
        this.setItem('users', [{
            id: this.generateId(),
            username: 'admin',
            password: 'admin123',
            restaurantName: 'The Grand Kitchen',
            ownerName: 'Raj Sharma',
            email: 'raj@grandkitchen.com',
            phone: '9876543210',
            address: {
                street: '42 MG Road',
                city: 'Mumbai',
                state: 'Maharashtra',
                pincode: '400001'
            },
            fssai: '12345678901234',
            gstin: '27AAPFU0939F1ZV',
            restaurantType: 'Both',
            seatingCapacity: 60,
            openingTime: '10:00',
            closingTime: '23:00',
            cuisineType: 'Multi-Cuisine'
        }]);

        // ── Ingredients ──
        this.setItem('inventory', [
            { id: 'ing_1', name: 'Tomatoes',            category: 'Vegetables', quantity: 5000,  unit: 'g',  costPerUnit: 0.04,  lowStockThreshold: 500  },
            { id: 'ing_2', name: 'Onions',              category: 'Vegetables', quantity: 3000,  unit: 'g',  costPerUnit: 0.03,  lowStockThreshold: 500  },
            { id: 'ing_3', name: 'Cheese (Mozzarella)', category: 'Dairy',      quantity: 2000,  unit: 'g',  costPerUnit: 0.45,  lowStockThreshold: 300  },
            { id: 'ing_4', name: 'Chicken',             category: 'Meat',       quantity: 3000,  unit: 'g',  costPerUnit: 0.25,  lowStockThreshold: 500  },
            { id: 'ing_5', name: 'Basmati Rice',        category: 'Grains',     quantity: 10000, unit: 'g',  costPerUnit: 0.06,  lowStockThreshold: 1000 },
            { id: 'ing_6', name: 'Penne Pasta',         category: 'Grains',     quantity: 5000,  unit: 'g',  costPerUnit: 0.12,  lowStockThreshold: 500  },
            { id: 'ing_7', name: 'Olive Oil',           category: 'Oils',       quantity: 2000,  unit: 'mL', costPerUnit: 0.80,  lowStockThreshold: 300  },
            { id: 'ing_8', name: 'Paneer',              category: 'Dairy',      quantity: 2000,  unit: 'g',  costPerUnit: 0.32,  lowStockThreshold: 300  }
        ]);

        // ── Recipes ──
        this.setItem('recipes', [
            {
                id: 'rec_1', dishName: 'Margherita Pizza', category: 'Pizza', price: 299,
                ingredients: [
                    { inventoryId: 'ing_3', qtyRequired: 100 },
                    { inventoryId: 'ing_1', qtyRequired: 150 },
                    { inventoryId: 'ing_7', qtyRequired: 20  }
                ]
            },
            {
                id: 'rec_2', dishName: 'Butter Chicken', category: 'Main Course', price: 349,
                ingredients: [
                    { inventoryId: 'ing_4', qtyRequired: 250 },
                    { inventoryId: 'ing_1', qtyRequired: 200 },
                    { inventoryId: 'ing_2', qtyRequired: 100 },
                    { inventoryId: 'ing_7', qtyRequired: 30  }
                ]
            },
            {
                id: 'rec_3', dishName: 'Veg Biryani', category: 'Rice', price: 249,
                ingredients: [
                    { inventoryId: 'ing_5', qtyRequired: 200 },
                    { inventoryId: 'ing_2', qtyRequired: 150 },
                    { inventoryId: 'ing_1', qtyRequired: 100 },
                    { inventoryId: 'ing_8', qtyRequired: 100 },
                    { inventoryId: 'ing_7', qtyRequired: 20  }
                ]
            },
            {
                id: 'rec_4', dishName: 'Pasta Arrabiata', category: 'Pasta', price: 279,
                ingredients: [
                    { inventoryId: 'ing_6', qtyRequired: 200 },
                    { inventoryId: 'ing_1', qtyRequired: 200 },
                    { inventoryId: 'ing_2', qtyRequired: 50  },
                    { inventoryId: 'ing_7', qtyRequired: 25  }
                ]
            }
        ]);

        // ── Sample bill (yesterday) ──
        const yesterday = new Date(Date.now() - 86400000).toISOString();
        this.setItem('bills', [{
            id: 'bill_1',
            tableNumber: 5,
            items: [
                { dishId: 'rec_1', dishName: 'Margherita Pizza', qty: 2, priceAtSale: 299 },
                { dishId: 'rec_3', dishName: 'Veg Biryani',      qty: 1, priceAtSale: 249 }
            ],
            subtotal: 847,
            tax: 42.35,
            total: 889.35,
            timestamp: yesterday
        }]);

        // ── Sample logs ──
        const twoDaysAgo = new Date(Date.now() - 172800000).toISOString();
        this.setItem('logs', [
            { id: this.generateId(), category: 'billing', actionText: 'Bill #bill_1 created for Table 5 — Total: ₹889.35',     payload: { billId: 'bill_1', total: 889.35 }, timestamp: yesterday   },
            { id: this.generateId(), category: 'stock',   actionText: 'Inventory initialized with 8 default ingredients',        payload: {},                                  timestamp: twoDaysAgo },
            { id: this.generateId(), category: 'menu',    actionText: 'Menu initialized with 4 default recipes',                 payload: {},                                  timestamp: twoDaysAgo }
        ]);

        // ── Empty waste log ──
        this.setItem('waste', []);

        // Mark as initialized
        this.setItem('_initialized', true);
    }
};

// Auto-seed on first load
Storage.initializeDefaults();
