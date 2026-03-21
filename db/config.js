const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const HA_CONFIG_PATH = '/config/configuration.yaml';
const HA_DEFAULT_DB = '/config/home-assistant_v2.db';

const LOCAL_FALLBACK_DB = path.join(__dirname, '..', 'data', 'local.db');

/**
 * Load and resolve a Home Assistant YAML file, handling custom tags:
 *   !include <file>                  → parse the referenced YAML file
 *   !include_dir_list <dir>          → array of parsed YAML files in dir
 *   !include_dir_named <dir>         → object keyed by filename (no ext)
 *   !include_dir_merge_list <dir>    → flat array merged from all files
 *   !include_dir_merge_named <dir>   → merged object from all files
 *   !secret <key>                    → lookup in secrets.yaml
 *   !env_var <name>                  → process.env lookup
 */
function loadHaYaml(filePath) {
    const baseDir = path.dirname(filePath);

    const customTypes = [
        new yaml.Type('!include', {
            kind: 'scalar',
            construct: (data) => {
                const target = path.resolve(baseDir, data);
                if (!fs.existsSync(target)) return null;
                return loadHaYaml(target);
            },
        }),
        new yaml.Type('!include_dir_list', {
            kind: 'scalar',
            construct: (data) => {
                const dir = path.resolve(baseDir, data);
                return readYamlDir(dir).map(f => loadHaYaml(f));
            },
        }),
        new yaml.Type('!include_dir_named', {
            kind: 'scalar',
            construct: (data) => {
                const dir = path.resolve(baseDir, data);
                const result = {};
                for (const f of readYamlDir(dir)) {
                    const key = path.basename(f, path.extname(f));
                    result[key] = loadHaYaml(f);
                }
                return result;
            },
        }),
        new yaml.Type('!include_dir_merge_list', {
            kind: 'scalar',
            construct: (data) => {
                const dir = path.resolve(baseDir, data);
                const result = [];
                for (const f of readYamlDir(dir)) {
                    const content = loadHaYaml(f);
                    if (Array.isArray(content)) result.push(...content);
                    else if (content != null) result.push(content);
                }
                return result;
            },
        }),
        new yaml.Type('!include_dir_merge_named', {
            kind: 'scalar',
            construct: (data) => {
                const dir = path.resolve(baseDir, data);
                const result = {};
                for (const f of readYamlDir(dir)) {
                    const content = loadHaYaml(f);
                    if (content && typeof content === 'object' && !Array.isArray(content)) {
                        Object.assign(result, content);
                    }
                }
                return result;
            },
        }),
        new yaml.Type('!secret', {
            kind: 'scalar',
            construct: (data) => {
                const secretsPath = path.resolve(baseDir, 'secrets.yaml');
                if (!fs.existsSync(secretsPath)) return data;
                try {
                    const secrets = yaml.load(fs.readFileSync(secretsPath, 'utf8'));
                    return (secrets && secrets[data]) || data;
                } catch {
                    return data;
                }
            },
        }),
        new yaml.Type('!env_var', {
            kind: 'scalar',
            construct: (data) => process.env[data] || data,
        }),
    ];

    const schema = yaml.DEFAULT_SCHEMA.extend(customTypes);
    const content = fs.readFileSync(filePath, 'utf8');
    return yaml.load(content, { schema });
}

/**
 * Return sorted list of .yaml/.yml files in a directory.
 */
function readYamlDir(dir) {
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir)
        .filter(f => /\.ya?ml$/.test(f))
        .sort()
        .map(f => path.join(dir, f));
}

function getRecorderDbUrl() {
    if (!fs.existsSync(HA_CONFIG_PATH)) {
        console.log('Home Assistant configuration not found. Using local SQLite fallback.');
        return `sqlite:///${LOCAL_FALLBACK_DB}`;
    }

    try {
        const config = loadHaYaml(HA_CONFIG_PATH);

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
