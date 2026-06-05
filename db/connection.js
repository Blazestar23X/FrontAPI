// FlowCall Database Connection & Helpers
// Uses sql.js (pure JS/WASM SQLite) for compatibility

const path = require('path');
const fs = require('fs');
const initSqlJs = require('sql.js');

const DB_PATH = process.env.DATABASE_PATH || path.resolve(__dirname, '..', 'data', 'flowcall.db');

let db = null;
let SQL = null;

async function initSqlJsModule() {
  if (!SQL) {
    SQL = await initSqlJs();
  }
  return SQL;
}

async function getDb() {
  if (db) return db;
  
  const sqlModule = await initSqlJsModule();
  
  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    db = new sqlModule.Database(buffer);
  } else {
    db = new sqlModule.Database();
  }
  
  db.run('PRAGMA foreign_keys = ON');
  
  return db;
}

function saveDb() {
  if (!db) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  fs.writeFileSync(DB_PATH, buffer);
}

async function closeDb() {
  if (db) {
    saveDb();
    db.close();
    db = null;
  }
}

// === Convenience helpers (like better-sqlite3 style) ===

// Execute a query that returns rows
async function queryAll(sql, params = []) {
  const database = await getDb();
  try {
    const stmt = database.prepare(sql);
    if (params.length > 0) {
      stmt.bind(params);
    }
    const rows = [];
    while (stmt.step()) {
      rows.push(stmt.getAsObject());
    }
    stmt.free();
    return rows;
  } catch (err) {
    console.error('DB queryAll error:', err.message, '\nSQL:', sql);
    throw err;
  }
}

// Get a single row
async function queryOne(sql, params = []) {
  const rows = await queryAll(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

// Execute a write (INSERT/UPDATE/DELETE) and save
async function execute(sql, params = []) {
  const database = await getDb();
  try {
    const stmt = database.prepare(sql);
    if (params.length > 0) {
      stmt.bind(params);
    }
    stmt.step();
    stmt.free();
    saveDb();
  } catch (err) {
    console.error('DB execute error:', err.message, '\nSQL:', sql, '\nParams:', params);
    throw err;
  }
}

// Execute raw SQL without params (for schema/init)
async function exec(sql) {
  const database = await getDb();
  try {
    database.run(sql);
    saveDb();
  } catch (err) {
    console.error('DB exec error:', err.message, '\nSQL:', sql);
    throw err;
  }
}

module.exports = { getDb, saveDb, closeDb, queryAll, queryOne, execute, exec };