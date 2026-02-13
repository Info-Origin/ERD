import jwt from "jsonwebtoken";
import connectionManager from "../config/dynamicConnectionManager.js";

export const requireConnection = (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    return res.status(401).json({ 
      success: false, 
      message: 'No connection token provided' 
    });
  }

  const token = authHeader.split(" ")[1];
  
  if (!token) {
    return res.status(401).json({ 
      success: false, 
      message: 'Invalid token format' 
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Verify connection still exists
    if (!connectionManager.pools.has(decoded.connectionId)) {
      return res.status(401).json({ 
        success: false, 
        message: 'Connection expired or not found. Please reconnect.' 
      });
    }
    
    req.connectionId = decoded.connectionId;
    req.user = decoded;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        success: false, 
        message: 'Connection token expired. Please reconnect.' 
      });
    }
    return res.status(401).json({ 
      success: false, 
      message: 'Invalid connection token' 
    });
  }
};
