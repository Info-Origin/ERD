import jwt from "jsonwebtoken";
import connectionManager from "../config/dynamicConnectionManager.js";
import { validateConnectionConfig, categorizeConnectionError } from "../utils/connectionValidator.js";

export const testConnection = async (req, res, next) => {
  try {
    const { host, port, database, user, password, dbType, ssl } = req.body;

    // Validate input
    const validation = validateConnectionConfig({ host, port, database, user, password, dbType });
    if (!validation.valid) {
      return res.status(400).json({ 
        success: false, 
        message: validation.error 
      });
    }

    // Only support MySQL for now
    if (dbType && dbType !== 'mysql') {
      return res.status(400).json({ 
        success: false, 
        message: 'Only MySQL databases are currently supported' 
      });
    }

    // Generate temporary user ID (or use authenticated user)
    const userId = req.user?.id || `temp_${Date.now()}`;

    // Check if this exact connection already exists
    const connectionId = connectionManager.generateConnectionId({
      host, 
      port: port || 3306, 
      database, 
      user
    });

    const existingPool = connectionManager.pools.get(connectionId);
    const existingMetadata = connectionManager.poolMetadata.get(connectionId);

    if (existingPool && existingMetadata) {
      // Connection already exists - return success with duplicate info
      return res.json({
        success: true,
        message: 'This connection is already active',
        connectionId: connectionId,
        isDuplicate: true,
        isAlreadyConnected: true,
        existingConnection: {
          host: existingMetadata.config.host,
          port: existingMetadata.config.port,
          database: existingMetadata.config.database,
          user: existingMetadata.config.user,
          connectedAt: new Date(existingMetadata.createdAt).toLocaleString()
        }
      });
    }

    // Attempt new connection test
    const result = await connectionManager.createPool(
      { host, port: port || 3306, database, user, password, ssl: ssl || false },
      userId
    );

    // Clean up the test connection immediately (we don't want to keep it)
    if (result.isNew) {
      await connectionManager.closePool(result.connectionId);
    }

    res.json({
      success: true,
      message: 'Connection test successful',
      connectionId: result.connectionId,
      isDuplicate: false,
      isAlreadyConnected: false
    });
  } catch (error) {
    // Categorize errors
    const errorMessage = categorizeConnectionError(error);
    res.status(400).json({ 
      success: false, 
      message: errorMessage,
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

export const createConnection = async (req, res, next) => {
  try {
    const { host, port, database, user, password, dbType, connectionName, ssl } = req.body;

    // Validate input
    const validation = validateConnectionConfig({ host, port, database, user, password, dbType });
    if (!validation.valid) {
      return res.status(400).json({ 
        success: false, 
        message: validation.error 
      });
    }

    const userId = req.user?.id || `temp_${Date.now()}`;

    // Create connection pool
    const result = await connectionManager.createPool(
      { host, port: port || 3306, database, user, password, ssl: ssl || false },
      userId
    );

    // Create JWT token with connection info (always create token, even for duplicates)
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
        // Never include password in token
      },
      process.env.JWT_SECRET,
      { expiresIn: '8h' } // Token expires in 8 hours
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
      }
    });
  } catch (error) {
    next(error);
  }
};

export const disconnectConnection = async (req, res, next) => {
  try {
    const { connectionId } = req.params;
    
    // Verify user owns this connection
    const metadata = connectionManager.poolMetadata.get(connectionId);
    const userId = req.user?.id || req.user?.userId || `temp_${Date.now()}`;
    
    if (!metadata || metadata.userId !== userId) {
      return res.status(403).json({ 
        success: false, 
        message: 'Unauthorized' 
      });
    }

    await connectionManager.closePool(connectionId);
    
    res.json({ 
      success: true, 
      message: 'Connection closed successfully' 
    });
  } catch (error) {
    next(error);
  }
};

export const listConnections = async (req, res, next) => {
  try {
    const userId = req.user?.id || req.user?.userId || `temp_${Date.now()}`;
    
    const connections = connectionManager.getActiveConnections()
      .filter(conn => {
        const meta = connectionManager.poolMetadata.get(conn.connectionId);
        return meta && meta.userId === userId;
      });
    
    res.json({ 
      success: true, 
      connections 
    });
  } catch (error) {
    next(error);
  }
};
