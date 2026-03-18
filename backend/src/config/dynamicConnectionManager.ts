import mysql, { type Pool } from "mysql2/promise";
import crypto from "crypto";
import type { ConnectionConfig, PoolMetadata } from "../types/index.js";

interface CreatePoolResult {
  connectionId: string;
  isNew: boolean;
  isDuplicate: boolean;
  existingConnection?: {
    host: string;
    port: number | undefined;
    database: string;
    user: string;
  };
}

interface ActiveConnection {
  connectionId: string;
  host: string;
  port: number | undefined;
  database: string;
  user: string;
  createdAt: Date;
  lastUsed: Date;
}

class DynamicConnectionManager {
  pools: Map<string, Pool>;
  poolMetadata: Map<string, PoolMetadata>;
  private maxPoolsPerUser: number;
  private poolTimeout: number;
  private cleanupInterval: number;

  constructor() {
    this.pools = new Map();
    this.poolMetadata = new Map();
    this.maxPoolsPerUser = 3;
    this.poolTimeout = 30 * 60 * 1000; // 30 minutes
    this.cleanupInterval = 5 * 60 * 1000; // 5 minutes
    this.startCleanupJob();
  }

  generateConnectionId(config: Pick<ConnectionConfig, "host" | "port" | "database" | "user">): string {
    const str = `${config.host}:${config.port}:${config.database}:${config.user}`;
    return crypto.createHash("sha256").update(str).digest("hex");
  }

  async createPool(config: ConnectionConfig, userId: string): Promise<CreatePoolResult> {
    const connectionId = this.generateConnectionId({
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.user,
    });

    if (this.pools.has(connectionId)) {
      this.updateLastUsed(connectionId);
      const metadata = this.poolMetadata.get(connectionId)!;
      return {
        connectionId,
        isNew: false,
        isDuplicate: true,
        existingConnection: metadata.config,
      };
    }

    const userPools = Array.from(this.poolMetadata.entries()).filter(
      ([, meta]) => meta.userId === userId
    );

    if (userPools.length >= this.maxPoolsPerUser) {
      const oldestPool = userPools.sort(
        (a, b) => a[1].lastUsed - b[1].lastUsed
      )[0];
      await this.closePool(oldestPool[0]);
    }

    try {
      const poolConfig: mysql.PoolOptions = {
        host: config.host,
        port: config.port || 3306,
        user: config.user,
        password: config.password,
        database: config.database,
        waitForConnections: true,
        connectionLimit: 5,
        queueLimit: 10,
        enableKeepAlive: true,
        keepAliveInitialDelay: 0,
        connectTimeout: 10000,
      };

      if (config.ssl) {
        poolConfig.ssl = { rejectUnauthorized: false };
      }

      const pool = mysql.createPool(poolConfig);

      const connection = await pool.getConnection();
      await connection.ping();
      connection.release();

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
        },
      });

      return { connectionId, isNew: true, isDuplicate: false };
    } catch (error) {
      throw new Error(`Connection failed: ${(error as Error).message}`);
    }
  }

  getPool(connectionId: string): Pool {
    if (!this.pools.has(connectionId)) {
      throw new Error("Connection not found or expired");
    }
    this.updateLastUsed(connectionId);
    return this.pools.get(connectionId)!;
  }

  updateLastUsed(connectionId: string): void {
    const metadata = this.poolMetadata.get(connectionId);
    if (metadata) {
      metadata.lastUsed = Date.now();
    }
  }

  async closePool(connectionId: string): Promise<void> {
    const pool = this.pools.get(connectionId);
    if (pool) {
      await pool.end();
      this.pools.delete(connectionId);
      this.poolMetadata.delete(connectionId);
    }
  }

  async closeUserPools(userId: string): Promise<void> {
    const userPools = Array.from(this.poolMetadata.entries())
      .filter(([, meta]) => meta.userId === userId)
      .map(([id]) => id);

    await Promise.all(userPools.map((id) => this.closePool(id)));
  }

  startCleanupJob(): void {
    setInterval(() => {
      const now = Date.now();
      const expiredPools = Array.from(this.poolMetadata.entries())
        .filter(([, meta]) => now - meta.lastUsed > this.poolTimeout)
        .map(([id]) => id);

      expiredPools.forEach((id) => {
        console.log(`Cleaning up expired pool: ${id}`);
        this.closePool(id);
      });
    }, this.cleanupInterval);
  }

  getActiveConnections(): ActiveConnection[] {
    return Array.from(this.poolMetadata.entries()).map(([id, meta]) => ({
      connectionId: id,
      ...meta.config,
      createdAt: new Date(meta.createdAt),
      lastUsed: new Date(meta.lastUsed),
    }));
  }
}

export default new DynamicConnectionManager();
