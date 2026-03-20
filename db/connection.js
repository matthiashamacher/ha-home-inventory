const knex = require('knex');
const { getKnexConfig } = require('./config');

const config = getKnexConfig();
console.log(`Database client: ${config.client}`);

const db = knex(config);

module.exports = db;
