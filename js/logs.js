/**
 * logs.js — Activity Logging
 * Depends on: storage.js
 *
 * Categories: 'billing', 'menu', 'stock', 'waste'
 */

/**
 * Record an activity log entry.
 * @param {string} category  - One of: billing, menu, stock, waste
 * @param {string} actionText - Human-readable description of the action
 * @param {Object} payload    - Arbitrary data to attach to the log entry
 * @returns {Object} The created log entry
 */
function logActivity(category, actionText, payload = {}) {
    const entry = {
        id: Storage.generateId(),
        category,
        actionText,
        payload,
        timestamp: new Date().toISOString()
    };
    Storage.addItem('logs', entry);
    return entry;
}

/**
 * Retrieve all log entries for a given category, newest first.
 * @param {string} category
 * @returns {Array}
 */
function getLogsByCategory(category) {
    return Storage.getAll('logs')
        .filter(log => log.category === category)
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}

/**
 * Retrieve all log entries across all categories, newest first.
 * @returns {Array}
 */
function getAllLogs() {
    return Storage.getAll('logs')
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}
