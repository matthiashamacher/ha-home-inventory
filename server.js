const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const cors = require('cors');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 8099;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Determine database path
const dataDir = fs.existsSync('/data') ? '/data' : path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}
const dbPath = path.join(dataDir, 'local.db');

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database', err.message);
    } else {
        console.log('Connected to the SQLite database.');
        db.serialize(() => {
            db.run(`CREATE TABLE IF NOT EXISTS locations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE
            )`);
            db.run(`CREATE TABLE IF NOT EXISTS items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                quantity INTEGER NOT NULL DEFAULT 1,
                added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                location_id INTEGER REFERENCES locations(id) ON DELETE SET NULL
            )`);
            db.run("ALTER TABLE items ADD COLUMN location_id INTEGER REFERENCES locations(id) ON DELETE SET NULL", function (err) {
                // Ignore error if column already exists
            });
            db.run("ALTER TABLE items ADD COLUMN package_size REAL", function (err) {
                // Ignore error if column already exists
            });
            db.run("ALTER TABLE items ADD COLUMN package_unit TEXT", function (err) {
                // Ignore error if column already exists
            });
            db.run("ALTER TABLE items ADD COLUMN brand TEXT", function (err) {
                // Ignore error if column already exists
            });
        });
    }
});

// LOCATIONS
app.get('/api/locations', (req, res) => {
    db.all('SELECT * FROM locations ORDER BY name ASC', [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ locations: rows });
    });
});

app.post('/api/locations', (req, res) => {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: "Name is required" });

    db.run('INSERT INTO locations (name) VALUES (?)', [name], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ id: this.lastID, name });
    });
});

app.delete('/api/locations/:id', (req, res) => {
    const { id } = req.params;
    db.run('DELETE FROM locations WHERE id = ?', id, function (err) {
        if (err) return res.status(500).json({ error: err.message });
        db.run('UPDATE items SET location_id = NULL WHERE location_id = ?', id);
        res.json({ id });
    });
});

// BRANDS
app.get('/api/brands', (req, res) => {
    db.all('SELECT DISTINCT brand FROM items WHERE brand IS NOT NULL AND brand != "" ORDER BY brand ASC', [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ brands: rows.map(r => r.brand) });
    });
});

// ITEMS
app.get('/api/items', (req, res) => {
    db.all(`
        SELECT items.*, locations.name as location_name 
        FROM items 
        LEFT JOIN locations ON items.location_id = locations.id 
        ORDER BY items.name ASC
    `, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ items: rows });
    });
});

app.post('/api/items', (req, res) => {
    const { name, quantity, location_id, package_size, package_unit, brand } = req.body;
    if (!name) return res.status(400).json({ error: "Name is required" });
    const safeQuantity = quantity || parseInt(quantity) === 0 ? parseInt(quantity) : 1;
    const safeLocation = location_id || null;
    const safePackageSize = package_size && !isNaN(parseFloat(package_size)) ? parseFloat(package_size) : null;
    const validUnits = ['g', 'kg', 'l', 'ml'];
    const safePackageUnit = validUnits.includes(package_unit) ? package_unit : null;
    const safeBrand = brand ? brand.trim() : null;

    db.run(
        'INSERT INTO items (name, quantity, location_id, package_size, package_unit, brand) VALUES (?, ?, ?, ?, ?, ?)',
        [name, safeQuantity, safeLocation, safePackageSize, safePackageUnit, safeBrand],
        function (err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ id: this.lastID, name, quantity: safeQuantity, location_id: safeLocation, package_size: safePackageSize, package_unit: safePackageUnit, brand: safeBrand });
        });
});

app.put('/api/items/:id', (req, res) => {
    const { id } = req.params;
    const { quantity } = req.body;
    if (quantity === undefined || quantity === null) {
        return res.status(400).json({ error: "Quantity is required" });
    }

    db.run('UPDATE items SET quantity = ? WHERE id = ?', [parseInt(quantity), id], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ id, quantity: parseInt(quantity) });
    });
});

app.delete('/api/items/:id', (req, res) => {
    const { id } = req.params;
    db.run('DELETE FROM items WHERE id = ?', id, function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ id });
    });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Home Inventory addon listening on port ${PORT}`);
});
