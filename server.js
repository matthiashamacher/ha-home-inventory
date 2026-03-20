const express = require('express');
const path = require('path');
const cors = require('cors');
const db = require('./db/connection');
const { ensureSchema, LOCATIONS_TABLE, ITEMS_TABLE } = require('./db/schema');

const app = express();
const PORT = process.env.PORT || 8099;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Initialize database
async function initDb() {
    await ensureSchema(db);
    console.log('Database ready.');
}

initDb().catch(err => {
    console.error('Database initialization failed:', err);
    process.exit(1);
});

// Helper to extract inserted ID across database engines
function getInsertedId(result) {
    if (Array.isArray(result) && result.length > 0) {
        if (typeof result[0] === 'object') return result[0].id; // PostgreSQL
        return result[0]; // SQLite, MySQL
    }
    return result;
}

// LOCATIONS
app.get('/api/locations', async (req, res) => {
    try {
        const rows = await db(LOCATIONS_TABLE).orderBy('name', 'asc');
        res.json({ locations: rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/locations', async (req, res) => {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: "Name is required" });

    try {
        const result = await db(LOCATIONS_TABLE).insert({ name }).returning('id');
        const id = getInsertedId(result);
        res.json({ id, name });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/locations/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await db(ITEMS_TABLE).where('location_id', id).update({ location_id: null });
        await db(LOCATIONS_TABLE).where('id', id).del();
        res.json({ id });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// BRANDS
app.get('/api/brands', async (req, res) => {
    try {
        const rows = await db(ITEMS_TABLE)
            .distinct('brand')
            .whereNotNull('brand')
            .where('brand', '!=', '')
            .orderBy('brand', 'asc');
        res.json({ brands: rows.map(r => r.brand) });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ITEMS
app.get('/api/items', async (req, res) => {
    try {
        const rows = await db(ITEMS_TABLE)
            .leftJoin(LOCATIONS_TABLE, `${ITEMS_TABLE}.location_id`, `${LOCATIONS_TABLE}.id`)
            .select(`${ITEMS_TABLE}.*`, `${LOCATIONS_TABLE}.name as location_name`)
            .orderBy(`${ITEMS_TABLE}.name`, 'asc');
        res.json({ items: rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/items', async (req, res) => {
    const { name, quantity, location_id, package_size, package_unit, brand } = req.body;
    if (!name) return res.status(400).json({ error: "Name is required" });

    const safeQuantity = quantity || parseInt(quantity) === 0 ? parseInt(quantity) : 1;
    const safeLocation = location_id || null;
    const safePackageSize = package_size && !isNaN(parseFloat(package_size)) ? parseFloat(package_size) : null;
    const validUnits = ['g', 'kg', 'l', 'ml'];
    const safePackageUnit = validUnits.includes(package_unit) ? package_unit : null;
    const safeBrand = brand ? brand.trim() : null;

    try {
        const result = await db(ITEMS_TABLE).insert({
            name,
            quantity: safeQuantity,
            location_id: safeLocation,
            package_size: safePackageSize,
            package_unit: safePackageUnit,
            brand: safeBrand
        }).returning('id');
        const id = getInsertedId(result);
        res.json({ id, name, quantity: safeQuantity, location_id: safeLocation, package_size: safePackageSize, package_unit: safePackageUnit, brand: safeBrand });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/items/:id', async (req, res) => {
    const { id } = req.params;
    const { name, quantity, brand, location_id, package_size, package_unit } = req.body;

    try {
        // Handle quantity-only update (legacy/fast update)
        if (quantity !== undefined && name === undefined) {
            await db(ITEMS_TABLE).where('id', id).update({ quantity: parseInt(quantity) });
            return res.json({ id, quantity: parseInt(quantity) });
        }

        // Handle full item update
        if (!name) return res.status(400).json({ error: "Name is required for full update" });
        const safeQuantity = quantity || parseInt(quantity) === 0 ? parseInt(quantity) : 1;
        const safeLocation = location_id || null;
        const safePackageSize = package_size && !isNaN(parseFloat(package_size)) ? parseFloat(package_size) : null;
        const validUnits = ['g', 'kg', 'l', 'ml'];
        const safePackageUnit = validUnits.includes(package_unit) ? package_unit : null;
        const safeBrand = brand ? brand.trim() : null;

        await db(ITEMS_TABLE).where('id', id).update({
            name,
            quantity: safeQuantity,
            brand: safeBrand,
            location_id: safeLocation,
            package_size: safePackageSize,
            package_unit: safePackageUnit
        });
        res.json({ id, name, quantity: safeQuantity, brand: safeBrand, location_id: safeLocation, package_size: safePackageSize, package_unit: safePackageUnit });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/items/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await db(ITEMS_TABLE).where('id', id).del();
        res.json({ id });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Home Inventory addon listening on port ${PORT}`);
});
