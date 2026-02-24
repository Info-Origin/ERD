import mysql from 'mysql2/promise';

// Persistence database connection pool (separate from read-only real DB)
const persistencePool = mysql.createPool({
  host: process.env.PERSISTENCE_DB_HOST || 'localhost',
  port: process.env.PERSISTENCE_DB_PORT || 3306,
  user: process.env.PERSISTENCE_DB_USER || 'erd_persistence',
  password: process.env.PERSISTENCE_DB_PASSWORD || 'PersistencePassword123!',
  database: 'reverse_erd_persistence',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
});

// Test connection on startup
persistencePool.getConnection()
  .then(connection => {
    console.log('✅ Persistence database connected successfully');
    connection.release();
  })
  .catch(err => {
    console.error('❌ Persistence database connection failed:', err.message);
    console.error('Make sure to:');
    console.error('1. Run the SQL script: backend/database/persistence_schema.sql');
    console.error('2. Create the database user with proper permissions');
    console.error('3. Update .env with PERSISTENCE_DB_* credentials');
  });

export default persistencePool;
