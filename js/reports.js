/**
 * reports.js — Profit & Loss Reports
 * Depends on: storage.js, inventory.js, recipe.js
 */

/**
 * Compute full P&L report for a date range.
 * @param {string} startDate - ISO or YYYY-MM-DD
 * @param {string} endDate   - ISO or YYYY-MM-DD
 * @returns {{ bills, dishWise, dailySummary, totalRevenue, totalCost, netProfit }}
 */
function computeProfitLoss(startDate, endDate) {
    const bills = Storage.getAll('bills');

    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const filtered = bills.filter(b => {
        const t = new Date(b.timestamp);
        return t >= start && t <= end;
    });

    const dishWise = getDishWiseProfitability(filtered);
    const dailySummary = getDailyPLSummary(filtered);

    let totalRevenue = 0, totalCost = 0;
    dishWise.forEach(d => {
        totalRevenue += d.revenue;
        totalCost += d.ingredientCost;
    });

    return {
        bills: filtered,
        dishWise,
        dailySummary,
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        totalCost: Math.round(totalCost * 100) / 100,
        netProfit: Math.round((totalRevenue - totalCost) * 100) / 100
    };
}

/**
 * Break down profitability by dish.
 * @param {Array} filteredBills - Pre-filtered array of bill objects
 * @returns {Array} [{ dishName, unitsSold, revenue, ingredientCostPerUnit, ingredientCost, profit }]
 */
function getDishWiseProfitability(filteredBills) {
    const bills = Array.isArray(filteredBills) ? filteredBills : Storage.getAll('bills');
    const dishMap = {};

    bills.forEach(bill => {
        bill.items.forEach(item => {
            if (!dishMap[item.dishId]) {
                // Calculate ingredient cost per single serving
                const recipe = getRecipeById(item.dishId);
                let costPerServing = 0;
                if (recipe) {
                    recipe.ingredients.forEach(ing => {
                        const inv = getIngredientById(ing.inventoryId);
                        if (inv) costPerServing += ing.qtyRequired * inv.costPerUnit;
                    });
                }
                dishMap[item.dishId] = {
                    dishName: item.dishName,
                    unitsSold: 0,
                    revenue: 0,
                    ingredientCostPerUnit: costPerServing,
                    ingredientCost: 0,
                    profit: 0
                };
            }

            dishMap[item.dishId].unitsSold += item.qty;
            dishMap[item.dishId].revenue += item.priceAtSale * item.qty;
            dishMap[item.dishId].ingredientCost += dishMap[item.dishId].ingredientCostPerUnit * item.qty;
        });
    });

    return Object.values(dishMap).map(d => ({
        ...d,
        revenue: Math.round(d.revenue * 100) / 100,
        ingredientCost: Math.round(d.ingredientCost * 100) / 100,
        profit: Math.round((d.revenue - d.ingredientCost) * 100) / 100
    }));
}

/**
 * Aggregate P&L by calendar day.
 * @param {Array} filteredBills
 * @returns {Array} [{ date, revenue, cost, netPL }]
 */
function getDailyPLSummary(filteredBills) {
    const bills = Array.isArray(filteredBills) ? filteredBills : Storage.getAll('bills');
    const dailyMap = {};

    bills.forEach(bill => {
        const dateKey = new Date(bill.timestamp).toLocaleDateString('en-IN');
        if (!dailyMap[dateKey]) {
            dailyMap[dateKey] = { date: dateKey, revenue: 0, cost: 0, netPL: 0 };
        }

        bill.items.forEach(item => {
            const recipe = getRecipeById(item.dishId);
            let ingCost = 0;
            if (recipe) {
                recipe.ingredients.forEach(ing => {
                    const inv = getIngredientById(ing.inventoryId);
                    if (inv) ingCost += ing.qtyRequired * inv.costPerUnit;
                });
            }
            dailyMap[dateKey].revenue += item.priceAtSale * item.qty;
            dailyMap[dateKey].cost += ingCost * item.qty;
        });
    });

    return Object.values(dailyMap).map(d => ({
        date: d.date,
        revenue: Math.round(d.revenue * 100) / 100,
        cost: Math.round(d.cost * 100) / 100,
        netPL: Math.round((d.revenue - d.cost) * 100) / 100
    }));
}
