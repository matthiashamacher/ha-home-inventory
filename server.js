const express = require('express');
const path = require('path');
const cors = require('cors');
const db = require('./db/connection');
const { ensureSchema, LOCATIONS_TABLE, ITEMS_TABLE } = require('./db/schema');

const app = express();
const PORT = process.env.PORT || 8099;

app.use(cors());
app.use(express.json());

// Allow camera access when embedded in Home Assistant ingress iframe
app.use((req, res, next) => {
    res.setHeader('Permissions-Policy', 'camera=*');
    next();
});

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

// BARCODE LOOKUP
app.get('/api/barcode/:code', async (req, res) => {
    const { code } = req.params;
    if (!code) return res.status(400).json({ error: 'Barcode is required' });

    try {
        // Check local DB for existing items with this barcode
        const existingItems = await db(ITEMS_TABLE)
            .leftJoin(LOCATIONS_TABLE, `${ITEMS_TABLE}.location_id`, `${LOCATIONS_TABLE}.id`)
            .where(`${ITEMS_TABLE}.barcode`, code)
            .select(`${ITEMS_TABLE}.id`, `${ITEMS_TABLE}.name`, `${ITEMS_TABLE}.brand`,
                `${ITEMS_TABLE}.package_size`, `${ITEMS_TABLE}.package_unit`,
                `${ITEMS_TABLE}.quantity`, `${ITEMS_TABLE}.location_id`,
                `${LOCATIONS_TABLE}.name as location_name`);

        // If we have local data, use it as product info
        if (existingItems.length > 0) {
            const first = existingItems[0];
            return res.json({
                found: true,
                source: 'local',
                product: {
                    name: first.name,
                    brand: first.brand,
                    package_size: first.package_size,
                    package_unit: first.package_unit,
                    barcode: code
                },
                existing_items: existingItems.map(i => ({
                    id: i.id, location_id: i.location_id,
                    location_name: i.location_name, quantity: i.quantity
                }))
            });
        }

        // Lookup on Open Food Facts
        const offRes = await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json`, {
            headers: { 'User-Agent': 'CellarStorage/1.0 (Home Assistant Add-on)' }
        });
        const offData = await offRes.json();

        if (offData.status === 1 && offData.product) {
            const p = offData.product;
            const name = p.product_name || p.product_name_en || p.generic_name || '';
            const brand = p.brands ? p.brands.split(',')[0].trim() : null;

            // Parse quantity string like "500ml", "1.5 L", "750 g"
            let package_size = null;
            let package_unit = null;
            if (p.quantity) {
                const match = p.quantity.match(/^([\d.,]+)\s*(g|kg|ml|l|cl)\b/i);
                if (match) {
                    package_size = parseFloat(match[1].replace(',', '.'));
                    package_unit = match[2].toLowerCase();
                    if (package_unit === 'cl') {
                        package_size = package_size * 10;
                        package_unit = 'ml';
                    }
                }
            }

            return res.json({
                found: true,
                source: 'openfoodfacts',
                product: { name, brand, package_size, package_unit, barcode: code },
                existing_items: []
            });
        }

        res.json({ found: false, product: { barcode: code }, existing_items: [] });
    } catch (err) {
        console.error('Barcode lookup error:', err.message);
        res.json({ found: false, product: { barcode: code }, existing_items: [], error: err.message });
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
    const { name, quantity, location_id, package_size, package_unit, brand, barcode } = req.body;
    if (!name) return res.status(400).json({ error: "Name is required" });

    const safeQuantity = quantity || parseInt(quantity) === 0 ? parseInt(quantity) : 1;
    const safeLocation = location_id || null;
    const safePackageSize = package_size && !isNaN(parseFloat(package_size)) ? parseFloat(package_size) : null;
    const validUnits = ['g', 'kg', 'l', 'ml'];
    const safePackageUnit = validUnits.includes(package_unit) ? package_unit : null;
    const safeBrand = brand ? brand.trim() : null;
    const safeBarcode = barcode ? barcode.trim() : null;

    try {
        const result = await db(ITEMS_TABLE).insert({
            name,
            quantity: safeQuantity,
            location_id: safeLocation,
            package_size: safePackageSize,
            package_unit: safePackageUnit,
            brand: safeBrand,
            barcode: safeBarcode
        }).returning('id');
        const id = getInsertedId(result);
        res.json({ id, name, quantity: safeQuantity, location_id: safeLocation, package_size: safePackageSize, package_unit: safePackageUnit, brand: safeBrand, barcode: safeBarcode });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/items/:id', async (req, res) => {
    const { id } = req.params;
    const { name, quantity, brand, location_id, package_size, package_unit, barcode } = req.body;

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
        const safeBarcode = barcode ? barcode.trim() : null;

        await db(ITEMS_TABLE).where('id', id).update({
            name,
            quantity: safeQuantity,
            brand: safeBrand,
            location_id: safeLocation,
            package_size: safePackageSize,
            package_unit: safePackageUnit,
            barcode: safeBarcode
        });
        res.json({ id, name, quantity: safeQuantity, brand: safeBrand, location_id: safeLocation, package_size: safePackageSize, package_unit: safePackageUnit, barcode: safeBarcode });
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
