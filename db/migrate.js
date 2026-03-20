const fs = require('fs');
const path = require('path');
const { LOCATIONS_TABLE, ITEMS_TABLE } = require('./schema');

const OLD_DB_PATH = fs.existsSync('/data') ? '/data/local.db' : path.join(__dirname, '..', 'data', 'local.db');

async function migrateFromOldDb(knex) {
    if (!fs.existsSync(OLD_DB_PATH)) {
        return;
    }

    // Check if new tables already have data (migration already done)
    const existingLocations = await knex(LOCATIONS_TABLE).count('* as count').first();
    const existingItems = await knex(ITEMS_TABLE).count('* as count').first();

    if (existingLocations.count > 0 || existingItems.count > 0) {
        console.log('Target tables already contain data, skipping migration.');
        return;
    }

    console.log(`Migrating data from ${OLD_DB_PATH}...`);

    // Open old database with better-sqlite3 (synchronous API for reading)
    const Database = require('better-sqlite3');
    let oldDb;
    try {
        oldDb = new Database(OLD_DB_PATH, { readonly: true });
    } catch (err) {
        console.error('Could not open old database for migration:', err.message);
        return;
    }

    try {
        // Read old data
        let oldLocations = [];
        let oldItems = [];

        try {
            oldLocations = oldDb.prepare('SELECT * FROM locations').all();
        } catch (err) {
            console.log('No locations table in old database.');
        }

        try {
            oldItems = oldDb.prepare('SELECT * FROM items').all();
        } catch (err) {
            console.log('No items table in old database.');
        }

        if (oldLocations.length === 0 && oldItems.length === 0) {
            console.log('Old database is empty, nothing to migrate.');
            return;
        }

        // Migrate within a transaction
        await knex.transaction(async (trx) => {
            // Migrate locations and build ID mapping
            const locationIdMap = {};
            for (const loc of oldLocations) {
                const [newId] = await trx(LOCATIONS_TABLE).insert({ name: loc.name });
                locationIdMap[loc.id] = typeof newId === 'object' ? newId.id : newId;
            }

            // Migrate items with remapped location IDs
            for (const item of oldItems) {
                await trx(ITEMS_TABLE).insert({
                    name: item.name,
                    quantity: item.quantity || 1,
                    added_at: item.added_at || new Date(),
                    location_id: item.location_id ? (locationIdMap[item.location_id] || null) : null,
                    package_size: item.package_size || null,
                    package_unit: item.package_unit || null,
                    brand: item.brand || null
                });
            }
        });

        console.log(`Migration complete: ${oldLocations.length} locations, ${oldItems.length} items.`);

        // Rename old database as backup
        const backupPath = OLD_DB_PATH + '.migrated';
        fs.renameSync(OLD_DB_PATH, backupPath);
        console.log(`Old database backed up to ${backupPath}`);
    } finally {
        oldDb.close();
    }
}

module.exports = { migrateFromOldDb };
