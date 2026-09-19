/**
 * auth.js — Authentication & User Management
 * Depends on: storage.js
 */

/**
 * Register a new restaurant/user.
 * Validates username uniqueness before saving.
 * @param {Object} userData - Full user profile object
 * @returns {{ success: boolean, message: string }}
 */
function registerUser(userData) {
    const users = Storage.getAll('users');

    // Check username uniqueness
    if (users.find(u => u.username.toLowerCase() === userData.username.toLowerCase())) {
        return { success: false, message: 'Username already exists. Please choose a different one.' };
    }

    userData.id = Storage.generateId();
    Storage.addItem('users', userData);
    return { success: true, message: 'Registration successful! You can now log in.' };
}

/**
 * Authenticate a user by username and password.
 * On success, creates a session object in storage.
 * @param {string} username
 * @param {string} password
 * @returns {{ success: boolean, message: string, user?: Object }}
 */
function loginUser(username, password) {
    const users = Storage.getAll('users');
    const user = users.find(u => u.username === username && u.password === password);

    if (!user) {
        return { success: false, message: 'Invalid username or password.' };
    }

    // Create session
    Storage.setItem('session', {
        username: user.username,
        restaurantName: user.restaurantName,
        loginTime: new Date().toISOString()
    });

    return { success: true, message: 'Login successful!', user };
}

/**
 * End the current session and redirect to login page.
 */
function logoutUser() {
    Storage.removeItem('session');
    window.location.href = 'index.html';
}

/**
 * Return the current session object, or null if not logged in.
 * @returns {Object|null}
 */
function getSession() {
    return Storage.getItem('session');
}

/**
 * Reset a user's password (client-side only).
 * @param {string} username
 * @param {string} newPassword
 * @returns {{ success: boolean, message: string }}
 */
function resetPassword(username, newPassword) {
    const users = Storage.getAll('users');
    const idx = users.findIndex(u => u.username === username);

    if (idx === -1) {
        return { success: false, message: 'Username not found.' };
    }

    users[idx].password = newPassword;
    Storage.setItem('users', users);
    return { success: true, message: 'Password has been reset successfully. You can now log in with your new password.' };
}

/**
 * Look up whether a username exists (for forgot-password flow).
 * @param {string} username
 * @returns {boolean}
 */
function usernameExists(username) {
    const users = Storage.getAll('users');
    return users.some(u => u.username === username);
}
