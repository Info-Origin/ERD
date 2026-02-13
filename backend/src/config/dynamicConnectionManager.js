import mysql from "mysql2/promise";
import crypto from "crypto";

class DynamicConnectionManager {
  constructor() {
    this.pools = new Map(); // connectionId -> pool
    this.poolMetadata = new Map(); // connectionId -> { createdAt, lastUsed, userId }
    this.maxPoolsPerUser = 3;
    this.poolTimeout = 30 * 60 * 1000; // 30 minutes
    this.cleanupInterval = 5 * 60 * 1000; // 5 minutes
    
    // Start cleanup job
    this.startCleanupJob();
  }

  generateConnectionId(config) {
    const str = `${config.host}:${config.port}:${config.database}:${config.user}`;
    return crypto.createHash('sha256').update(str).digest('hex');
  }

  async createPool(config, userId) {
    const connectionId = this.generateConnectionId(config);
    
    // Check if pool already exists
    if (this.pools.has(connectionId)) {
      this.updateLastUsed(connectionId);
      const metadata = this.poolMetadata.get(connectionId);
      return { 
        connectionId, 
        isNew: false,
        isDuplicate: true,
        existingConnection: metadata.config
      };
    }

    // Check user pool limit
    const userPools = Array.from(this.poolMetadata.entries())
      .filter(([_, meta]) => meta.userId === userId);
    
    if (userPools.length >= this.maxPoolsPerUser) {
      // Remove oldest pool
      const oldestPool = userPools.sort((a, b) => 
        a[1].lastUsed - b[1].lastUsed
      )[0];
      await this.closePool(oldestPool[0]);
    }

    try {
      // Create new pool with strict limits
      const poolConfig = {
        host: config.host,
        port: config.port || 3306,
        user: config.user,
        password: config.password,
        database: config.database,
        waitForConnections: true,
        connectionLimit: 5, // Lower limit for dynamic connections
        queueLimit: 10,
        enableKeepAlive: true,
        keepAliveInitialDelay: 0,
        connectTimeout: 10000, // 10 seconds
      };

      // Add SSL support for cloud databases
      if (config.ssl) {
        poolConfig.ssl = {
          rejectUnauthorized: false // Allow self-signed certificates
        };
      }

      const pool = mysql.createPool(poolConfig);

      // Test connection
      const connection = await pool.getConnection();
      await connection.ping();
      connection.release();

      // Store pool
      this.pools.set(connectionId, pool);
      this.poolMetadata.set(connectionId, {
        createdAt: Date.now(),
        lastUsed: Date.now(),
        userId,
        config: {
          host: config.host,
          port: config.port,
          database: config.database,
          user: config.user,
        }
      });

      return { connectionId, isNew: true, isDuplicate: false };
    } catch (error) {
      throw new Error(`Connection failed: ${error.message}`);
    }
  }

  getPool(connectionId) {
    if (!this.pools.has(connectionId)) {
      throw new Error('Connection not found or expired');
    }
    this.updateLastUsed(connectionId);
    return this.pools.get(connectionId);
  }

  updateLastUsed(connectionId) {
    const metadata = this.poolMetadata.get(connectionId);
    if (metadata) {
      metadata.lastUsed = Date.now();
    }
  }

  async closePool(connectionId) {
    const pool = this.pools.get(connectionId);
    if (pool) {
      await pool.end();
      this.pools.delete(connectionId);
      this.poolMetadata.delete(connectionId);
    }
  }

  async closeUserPools(userId) {
    const userPools = Array.from(this.poolMetadata.entries())
      .filter(([_, meta]) => meta.userId === userId)
      .map(([id]) => id);
    
    await Promise.all(userPools.map(id => this.closePool(id)));
  }

  startCleanupJob() {
    setInterval(() => {
      const now = Date.now();
      const expiredPools = Array.from(this.poolMetadata.entries())
        .filter(([_, meta]) => now - meta.lastUsed > this.poolTimeout)
        .map(([id]) => id);
      
      expiredPools.forEach(id => {
        console.log(`Cleaning up expired pool: ${id}`);
        this.closePool(id);
      });
    }, this.cleanupInterval);
  }

  getActiveConnections() {
    return Array.from(this.poolMetadata.entries()).map(([id, meta]) => ({
      connectionId: id,
      ...meta.config,
      createdAt: new Date(meta.createdAt),
      lastUsed: new Date(meta.lastUsed),
    }));
  }
}

export default new DynamicConnectionManager();
