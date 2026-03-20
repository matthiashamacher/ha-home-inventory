const LOCATIONS_TABLE = 'home_inventory_locations';
const ITEMS_TABLE = 'home_inventory_items';

async function ensureSchema(knex) {
    if (!(await knex.schema.hasTable(LOCATIONS_TABLE))) {
        await knex.schema.createTable(LOCATIONS_TABLE, (table) => {
            table.increments('id').primary();
            table.string('name').notNullable().unique();
        });
        console.log(`Created table: ${LOCATIONS_TABLE}`);
    }

    if (!(await knex.schema.hasTable(ITEMS_TABLE))) {
        await knex.schema.createTable(ITEMS_TABLE, (table) => {
            table.increments('id').primary();
            table.string('name').notNullable();
            table.integer('quantity').notNullable().defaultTo(1);
            table.timestamp('added_at').defaultTo(knex.fn.now());
            table.integer('location_id').unsigned().nullable()
                .references('id').inTable(LOCATIONS_TABLE).onDelete('SET NULL');
            table.float('package_size').nullable();
            table.string('package_unit').nullable();
            table.string('brand').nullable();
        });
        console.log(`Created table: ${ITEMS_TABLE}`);
    }
}

module.exports = { ensureSchema, LOCATIONS_TABLE, ITEMS_TABLE };
