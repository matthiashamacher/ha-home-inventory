const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const HA_CONFIG_PATH = '/config/configuration.yaml';
const HA_DEFAULT_DB = '/config/home-assistant_v2.db';

const LOCAL_FALLBACK_DB = path.join(__dirname, '..', 'data', 'local.db');

// Home Assistant uses custom YAML tags that js-yaml doesn't understand.
// Define a custom schema that treats them as pass-through values.
const HA_CUSTOM_TAGS = [
    'include', 'include_dir_list', 'include_dir_named',
    'include_dir_merge_list', 'include_dir_merge_named',
    'secret', 'env_var',
];

const HA_YAML_SCHEMA = yaml.DEFAULT_SCHEMA.extend(
    HA_CUSTOM_TAGS.map(tag =>
        new yaml.Type(`!${tag}`, {
            kind: 'scalar',
            construct: (data) => data,
        })
    )
);

function getRecorderDbUrl() {
    if (!fs.existsSync(HA_CONFIG_PATH)) {
        console.log('Home Assistant configuration not found. Using local SQLite fallback.');
        return `sqlite:///${LOCAL_FALLBACK_DB}`;
    }

    try {
        const configContent = fs.readFileSync(HA_CONFIG_PATH, 'utf8');
        const config = yaml.load(configContent, { schema: HA_YAML_SCHEMA });

        if (config && config.recorder && config.recorder.db_url) {
            return config.recorder.db_url;
        }

        console.log('No recorder.db_url configured, using Home Assistant default SQLite.');
        return `sqlite:///${HA_DEFAULT_DB}`;
    } catch (err) {
        throw new Error(`Error reading Home Assistant configuration: ${err.message}`);
    }
}

function parseSqliteUrl(dbUrl) {
    // sqlite:///path/to/db or sqlite:////absolute/path
    const filePath = dbUrl.replace(/^sqlite:\/\/\//, '');
    return {
        client: 'better-sqlite3',
        connection: { filename: filePath.startsWith('/') ? filePath : `/${filePath}` },
        useNullAsDefault: true,
        pool: {
            afterCreate: (conn, done) => {
                conn.pragma('journal_mode = WAL');
                done(null, conn);
            }
        }
    };
}

function parseMysqlUrl(dbUrl) {
    // Strip Python dialect suffixes like +pymysql
    const normalized = dbUrl.replace(/^mysql\+\w+:\/\//, 'mysql://');
    const url = new URL(normalized);
    return {
        client: 'mysql2',
        connection: {
            host: url.hostname,
            port: parseInt(url.port) || 3306,
            user: decodeURIComponent(url.username),
            password: decodeURIComponent(url.password),
            database: url.pathname.replace(/^\//, '')
        }
    };
}

function parsePostgresUrl(dbUrl) {
    // Strip Python dialect suffixes like +psycopg2
    const normalized = dbUrl.replace(/^postgresql\+\w+:\/\//, 'postgresql://');
    const url = new URL(normalized);
    return {
        client: 'pg',
        connection: {
            host: url.hostname,
            port: parseInt(url.port) || 5432,
            user: decodeURIComponent(url.username),
            password: decodeURIComponent(url.password),
            database: url.pathname.replace(/^\//, '')
        }
    };
}

function getKnexConfig() {
    const dbUrl = getRecorderDbUrl();

    if (dbUrl.startsWith('sqlite:')) {
        return parseSqliteUrl(dbUrl);
    }

    if (dbUrl.startsWith('mysql:') || dbUrl.startsWith('mysql+')) {
        return parseMysqlUrl(dbUrl);
    }

    if (dbUrl.startsWith('postgresql:') || dbUrl.startsWith('postgresql+') || dbUrl.startsWith('postgres:')) {
        return parsePostgresUrl(dbUrl);
    }

    throw new Error(`Unsupported database URL scheme: ${dbUrl}`);
}

module.exports = { getKnexConfig };
