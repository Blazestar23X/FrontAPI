// FlowCall Database Initialization
const path = require('path');
const fs = require('fs');
const { exec, getDb, closeDb } = require('./connection');

async function initDatabase() {
  console.log('Initializing FlowCall database...');
  
  // Read and execute schema
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await exec(schema);
  console.log('Database schema created successfully.');

  // Optionally seed
  const seedPath = path.join(__dirname, 'seed.sql');
  if (fs.existsSync(seedPath)) {
    const seed = fs.readFileSync(seedPath, 'utf8');
    try {
      // Seed uses INSERT OR IGNORE so it's safe to run multiple times
      const statements = seed.split(';').filter(s => s.trim());
      for (const stmt of statements) {
        if (stmt.trim()) {
          try {
            await exec(stmt.trim() + ';');
          } catch (e) {
            // Ignore errors from seed (records may already exist)
          }
        }
      }
      console.log('Seed data processed.');
    } catch (err) {
      console.log('Seed data note:', err.message);
    }
  }

  await closeDb();
  console.log('Database initialized at:', process.env.DATABASE_PATH || path.resolve(__dirname, '..', 'data', 'flowcall.db'));
}

initDatabase().catch(err => {
  console.error('Database initialization failed:', err);
  process.exit(1);
});