/**
 * app.js — Shared Utilities for All Protected Pages
 * Depends on: storage.js, auth.js
 *
 * Provides: sidebar rendering, toast notifications, auth guard, formatters.
 */

/**
 * Session guard — redirects to login if no active session.
 * @returns {Object|null}
 */
function requireAuth() {
    const session = getSession();
    if (!session) {
        window.location.href = 'index.html';
        return null;
    }
    return session;
}

/**
 * Show a Bootstrap 5 toast notification.
 * @param {string} message
 * @param {string} type - 'success' | 'warning' | 'danger' | 'info'
 */
function showToast(message, type = 'success') {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'toast-container position-fixed top-0 end-0 p-3';
        container.style.zIndex = '1090';
        document.body.appendChild(container);
    }

    const toastId = 'toast_' + Date.now();
    const bgMap = { success: 'bg-success', warning: 'bg-warning', danger: 'bg-danger', info: 'bg-info' };
    const iconMap = { success: '✓', warning: '⚠', danger: '✕', info: 'ℹ' };
    const bg = bgMap[type] || 'bg-info';
    const icon = iconMap[type] || 'ℹ';

    container.insertAdjacentHTML('beforeend', `
        <div id="${toastId}" class="toast align-items-center text-white ${bg} border-0" role="alert">
            <div class="d-flex">
                <div class="toast-body fw-semibold"><span class="me-1">${icon}</span> ${message}</div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
            </div>
        </div>`);

    const el = document.getElementById(toastId);
    new bootstrap.Toast(el, { delay: 4000 }).show();
    el.addEventListener('hidden.bs.toast', () => el.remove());
}

/**
 * Render the sidebar navigation and top bar.
 * Call on every protected page inside DOMContentLoaded.
 * Requires .app-layout > aside#sidebar-container + main.main-content > header#topbar-container
 * @param {string} pageTitle - The current page title for the breadcrumb
 */
function renderNavbar(pageTitle) {
    const session = getSession();
    const restaurant = session ? session.restaurantName : 'RestoInventory';
    const user = session ? session.username : '';
    const page = window.location.pathname.split('/').pop();
    const initial = user ? user.charAt(0).toUpperCase() : '?';

    const link = (href, icon, label) => {
        const active = page === href ? 'active' : '';
        return `<a href="${href}" class="sidebar-link ${active}"><i class="bi ${icon}"></i> ${label}</a>`;
    };

    // Sidebar
    const sidebar = document.getElementById('sidebar-container');
    if (sidebar) {
        sidebar.innerHTML = `
            <div class="sidebar-brand">
                <div class="brand-name"><span class="brand-emoji">🍽️</span> Smart RestoInventory</div>
                <span class="brand-sub" title="${restaurant}">${restaurant}</span>
            </div>
            <nav class="sidebar-nav">
                <div class="sidebar-section-title">Main</div>
                ${link('dashboard.html', 'bi-grid-1x2', 'Dashboard')}
                ${link('inventory.html', 'bi-box-seam', 'Inventory')}
                ${link('recipe.html', 'bi-journal-richtext', 'Recipe Menu')}
                ${link('billing.html', 'bi-receipt', 'Billing')}
                <div class="sidebar-section-title">Tracking</div>
                ${link('logs.html', 'bi-clock-history', 'Activity Logs')}
                ${link('waste.html', 'bi-trash3', 'Waste Tracker')}
                ${link('reports.html', 'bi-bar-chart-line', 'P&L Reports')}
            </nav>
            <div class="sidebar-footer">
                <div class="user-info">
                    <div class="user-avatar">${initial}</div>
                    <div>
                        <div class="user-name">${user}</div>
                        <div class="user-role">Restaurant Admin</div>
                    </div>
                </div>
                <button class="btn btn-outline-custom btn-sm w-100" onclick="logoutUser()">
                    <i class="bi bi-box-arrow-left me-1"></i> Sign Out
                </button>
            </div>`;
    }

    // Top bar
    const topbar = document.getElementById('topbar-container');
    if (topbar) {
        topbar.innerHTML = `
            <div class="d-flex align-items-center gap-2">
                <button class="sidebar-toggle" onclick="toggleSidebar()" aria-label="Toggle menu">
                    <i class="bi bi-list"></i>
                </button>
                <div class="breadcrumb-area">
                    <strong>${pageTitle || 'Dashboard'}</strong>
                </div>
            </div>
            <div class="top-bar-actions no-print">
            </div>`;
    }

    // Mobile overlay
    if (!document.getElementById('sidebar-overlay')) {
        const overlay = document.createElement('div');
        overlay.id = 'sidebar-overlay';
        overlay.className = 'sidebar-overlay';
        overlay.onclick = () => toggleSidebar(false);
        document.body.appendChild(overlay);
    }
}

/** Toggle sidebar on mobile */
function toggleSidebar(forceState) {
    const sb = document.getElementById('sidebar-container');
    const ov = document.getElementById('sidebar-overlay');
    const open = typeof forceState === 'boolean' ? forceState : !sb.classList.contains('open');
    sb.classList.toggle('open', open);
    ov.classList.toggle('show', open);
}

/* ───── Formatters ───── */

function formatCurrency(amount) {
    return '₹' + parseFloat(amount).toFixed(2);
}

function formatDate(timestamp) {
    return new Date(timestamp).toLocaleDateString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });
}

function formatDateShort(timestamp) {
    return new Date(timestamp).toLocaleDateString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric'
    });
}
