import persistencePool from "../config/persistenceDb.js";
import type { RowDataPacket, ResultSetHeader } from "mysql2";
import type { SchemaLockRow, LockStatus } from "../types/index.js";

class LockService {
  async acquireLock(
    schemaName: string,
    sessionId: string
  ): Promise<
    | { success: true; lock: { id: number; schemaName: string; lockedBy: string; userDisplayName: string; lockedAt: Date } }
    | { success: false; reason: string; message: string; lockedBy?: string; lockedAt?: Date }
  > {
    const [existingLocks] = await persistencePool.execute<
      (SchemaLockRow & RowDataPacket)[]
    >("SELECT * FROM schema_locks WHERE schema_name = ?", [schemaName]);

    if (existingLocks.length > 0) {
      const existingLock = existingLocks[0];

      if (existingLock.locked_by === sessionId) {
        return {
          success: false,
          reason: "already_locked_by_you",
          message: "You already have this schema locked",
        };
      }

      return {
        success: false,
        reason: "locked",
        lockedBy: existingLock.user_display_name,
        lockedAt: existingLock.locked_at,
        message: `Schema is locked by ${existingLock.user_display_name}`,
      };
    }

    const userDisplayName = await this.generateUserDisplayName(sessionId);

    const [result] = await persistencePool.execute<ResultSetHeader>(
      "INSERT INTO schema_locks (schema_name, locked_by, user_display_name) VALUES (?, ?, ?)",
      [schemaName, sessionId, userDisplayName]
    );

    return {
      success: true,
      lock: {
        id: result.insertId,
        schemaName,
        lockedBy: sessionId,
        userDisplayName,
        lockedAt: new Date(),
      },
    };
  }

  async releaseLock(
    schemaName: string,
    sessionId: string
  ): Promise<{ success: boolean; reason?: string; message: string }> {
    const [locks] = await persistencePool.execute<
      (SchemaLockRow & RowDataPacket)[]
    >(
      "SELECT * FROM schema_locks WHERE schema_name = ? AND locked_by = ?",
      [schemaName, sessionId]
    );

    if (locks.length === 0) {
      return { success: false, reason: "not_owner", message: "You do not own this lock" };
    }

    await persistencePool.execute(
      "DELETE FROM schema_locks WHERE schema_name = ? AND locked_by = ?",
      [schemaName, sessionId]
    );

    return { success: true, message: "Lock released" };
  }

  async getLockStatus(schemaName: string): Promise<LockStatus> {
    const [locks] = await persistencePool.execute<
      (SchemaLockRow & RowDataPacket)[]
    >("SELECT * FROM schema_locks WHERE schema_name = ?", [schemaName]);

    if (locks.length === 0) return { isLocked: false };

    const lock = locks[0];
    return {
      isLocked: true,
      lockedBy: lock.locked_by,
      userDisplayName: lock.user_display_name,
      lockedAt: lock.locked_at,
    };
  }

  async getBulkLockStatus(
    schemaNames: string[]
  ): Promise<Record<string, LockStatus>> {
    if (!schemaNames || schemaNames.length === 0) return {};

    const placeholders = schemaNames.map(() => "?").join(",");
    const [locks] = await persistencePool.execute<
      (SchemaLockRow & RowDataPacket)[]
    >(
      `SELECT * FROM schema_locks WHERE schema_name IN (${placeholders})`,
      schemaNames
    );

    const result: Record<string, LockStatus> = {};
    locks.forEach((lock) => {
      result[lock.schema_name] = {
        isLocked: true,
        lockedBy: lock.locked_by,
        userDisplayName: lock.user_display_name,
        lockedAt: lock.locked_at,
      };
    });

    return result;
  }

  async generateUserDisplayName(sessionId: string): Promise<string> {
    interface DisplayNameRow extends RowDataPacket {
      user_display_name: string;
    }

    const [existing] = await persistencePool.execute<DisplayNameRow[]>(
      "SELECT user_display_name FROM schema_locks WHERE locked_by = ? LIMIT 1",
      [sessionId]
    );

    if (existing.length > 0) return existing[0].user_display_name;

    const [allNames] = await persistencePool.execute<DisplayNameRow[]>(
      "SELECT DISTINCT user_display_name FROM schema_locks ORDER BY user_display_name"
    );

    const usedNames = allNames.map((row) => row.user_display_name);
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    for (const letter of alphabet) {
      const name = `User ${letter}`;
      if (!usedNames.includes(name)) return name;
    }

    return `User ${Date.now()}`;
  }
}

export default new LockService();
