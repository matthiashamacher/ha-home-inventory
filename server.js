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
        db.run(`CREATE TABLE IF NOT EXISTS items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            quantity INTEGER NOT NULL DEFAULT 1,
            added_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);
    }
});

app.get('/api/items', (req, res) => {
    db.all('SELECT * FROM items ORDER BY name ASC', [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ items: rows });
    });
});

app.post('/api/items', (req, res) => {
    const { name, quantity } = req.body;
    if (!name) return res.status(400).json({ error: "Name is required" });
    const safeQuantity = quantity || parseInt(quantity) === 0 ? parseInt(quantity) : 1;

    db.run('INSERT INTO items (name, quantity) VALUES (?, ?)', [name, safeQuantity], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ id: this.lastID, name, quantity: safeQuantity });
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
