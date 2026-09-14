const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

async function initializeDatabase() {
  console.log('Initializing AbsenTray V2 database...');
  
  const dbPath = process.env.DB_PATH || './data/attendance.db';
  const migrationPath = path.join(__dirname, '../migrations/001_initial_schema.sql');
  
  try {
    // Create directory if it doesn't exist
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`Created directory: ${dir}`);
    }
    
    // Read migration SQL
    if (!fs.existsSync(migrationPath)) {
      throw new Error(`Migration file not found: ${migrationPath}`);
    }
    
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Connect to database
    console.log(`Connecting to database: ${dbPath}`);
    const db = new Database(dbPath);
    
    // Enable WAL mode and foreign keys
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    
    // Execute migration
    console.log('Executing database migration...');
    db.exec(migrationSQL);
    
    // Verify tables were created
    const tables = db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' 
      AND name NOT LIKE 'sqlite_%'
    `).all();
    
    console.log('\nTables created successfully:');
    tables.forEach(table => {
      const count = db.prepare(`SELECT COUNT(*) as count FROM ${table.name}`).get().count;
      console.log(`  - ${table.name}: ${count} records`);
    });
    
    // Verify default data
    const templatesCount = db.prepare('SELECT COUNT(*) as count FROM templates').get().count;
    const settingsCount = db.prepare('SELECT COUNT(*) as count FROM settings').get().count;
    
    console.log(`\nDefault data created:`);
    console.log(`  - Templates: ${templatesCount} records`);
    console.log(`  - Settings: ${settingsCount} records`);
    
    // Close connection
    db.close();
    
    console.log('\n✅ Database initialization completed successfully!');
    console.log(`Database location: ${dbPath}`);
    
    return true;
    
  } catch (error) {
    console.error('\n❌ Database initialization failed:');
    console.error(error.message);
    
    if (error.code) {
      console.error(`Error code: ${error.code}`);
    }
    
    if (error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
    
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  initializeDatabase();
}

module.exports = initializeDatabase;
