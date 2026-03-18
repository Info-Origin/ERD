import jwt from "jsonwebtoken";
import type { Response, NextFunction } from "express";
import connectionManager from "../config/dynamicConnectionManager.js";
import {
  validateConnectionConfig,
  categorizeConnectionError,
} from "../utils/connectionValidator.js";
import type { AuthenticatedRequest } from "../types/index.js";

export const testConnection = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { host, port, database, user, password, dbType, ssl } = req.body as Record<string, unknown>;

    const validation = validateConnectionConfig({ host, port, database, user, password, dbType });
    if (!validation.valid) {
      res.status(400).json({ success: false, message: validation.error });
      return;
    }

    if (dbType && dbType !== "mysql") {
      res.status(400).json({
        success: false,
        message: "Only MySQL databases are currently supported",
      });
      return;
    }

    const userId = req.user?.id || `temp_${Date.now()}`;

    const connectionId = connectionManager.generateConnectionId({
      host: host as string,
      port: port ? Number(port) : 3306,
      database: database as string,
      user: user as string,
    });

    const existingPool = connectionManager.pools.get(connectionId);
    const existingMetadata = connectionManager.poolMetadata.get(connectionId);

    if (existingPool && existingMetadata) {
      res.json({
        success: true,
        message: "This connection is already active",
        connectionId,
        isDuplicate: true,
        isAlreadyConnected: true,
        existingConnection: {
          host: existingMetadata.config.host,
          port: existingMetadata.config.port,
          database: existingMetadata.config.database,
          user: existingMetadata.config.user,
          connectedAt: new Date(existingMetadata.createdAt).toLocaleString(),
        },
      });
      return;
    }

    const result = await connectionManager.createPool(
      {
        host: host as string,
        port: port ? Number(port) : 3306,
        database: database as string,
        user: user as string,
        password: password as string,
        ssl: Boolean(ssl),
      },
      userId
    );

    if (result.isNew) {
      await connectionManager.closePool(result.connectionId);
    }

    res.json({
      success: true,
      message: "Connection test successful",
      connectionId: result.connectionId,
      isDuplicate: false,
      isAlreadyConnected: false,
    });
  } catch (error) {
    const errorMessage = categorizeConnectionError(error as Error);
    res.status(400).json({
      success: false,
      message: errorMessage,
      details:
        process.env.NODE_ENV === "development"
          ? (error as Error).message
          : undefined,
    });
  }
};

export const createConnection = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { host, port, database, user, password, dbType, connectionName, ssl } =
      req.body as Record<string, unknown>;

    const validation = validateConnectionConfig({ host, port, database, user, password, dbType });
    if (!validation.valid) {
      res.status(400).json({ success: false, message: validation.error });
      return;
    }

    const userId = req.user?.id || `temp_${Date.now()}`;

    const result = await connectionManager.createPool(
      {
        host: host as string,
        port: port ? Number(port) : 3306,
        database: database as string,
        user: user as string,
        password: password as string,
        ssl: Boolean(ssl),
      },
      userId
    );

    const token = jwt.sign(
      {
        connectionId: result.connectionId,
        userId,
        connectionName: connectionName || `${database}@${host}`,
        host,
        port: port || 3306,
        database,
        user,
        ssl: ssl || false,
      },
      process.env.JWT_SECRET as string,
      { expiresIn: "8h" }
    );

    res.json({
      success: true,
      token,
      connectionId: result.connectionId,
      isDuplicate: result.isDuplicate || false,
      connectionInfo: {
        name: connectionName || `${database}@${host}`,
        host,
        port: port || 3306,
        database,
        user,
        ssl: ssl || false,
        connectionId: result.connectionId,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const disconnectConnection = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { connectionId } = req.params;
    const metadata = connectionManager.poolMetadata.get(connectionId);
    const userId = req.user?.id || req.user?.userId || `temp_${Date.now()}`;

    if (!metadata || metadata.userId !== userId) {
      res.status(403).json({ success: false, message: "Unauthorized" });
      return;
    }

    await connectionManager.closePool(connectionId);
    res.json({ success: true, message: "Connection closed successfully" });
  } catch (error) {
    next(error);
  }
};

export const listConnections = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.id || req.user?.userId || `temp_${Date.now()}`;

    const connections = connectionManager
      .getActiveConnections()
      .filter((conn) => {
        const meta = connectionManager.poolMetadata.get(conn.connectionId);
        return meta && meta.userId === userId;
      });

    res.json({ success: true, connections });
  } catch (error) {
    next(error);
  }
};
