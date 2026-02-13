export const validateConnectionConfig = (config) => {
  const { host, port, database, user, password, dbType } = config;

  // Host validation
  if (!host || typeof host !== 'string') {
    return { valid: false, error: 'Host is required' };
  }

  // Allow cloud database endpoints (AWS RDS, Railway, etc.) which can have complex formats
  // Examples: mydb.abc123.us-east-1.rds.amazonaws.com, myapp.railway.app
  const validHostPattern = /^[a-zA-Z0-9]([a-zA-Z0-9-_.]*[a-zA-Z0-9])?$/;
  if (!validHostPattern.test(host)) {
    return { valid: false, error: 'Invalid host format' };
  }

  // Prevent localhost/internal IP connections in production
  if (process.env.NODE_ENV === 'production') {
    const internalPatterns = [
      /^localhost$/i,
      /^127\./,
      /^10\./,
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
      /^192\.168\./,
      /^::1$/,
      /^fe80:/i,
    ];
    
    if (internalPatterns.some(pattern => pattern.test(host))) {
      return { valid: false, error: 'Cannot connect to internal/localhost addresses in production' };
    }
  }

  // SQL injection prevention in host
  if (/[;'"\\]/.test(host)) {
    return { valid: false, error: 'Invalid characters in host' };
  }

  // Port validation
  if (port) {
    const portNum = parseInt(port, 10);
    if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
      return { valid: false, error: 'Invalid port number (must be 1-65535)' };
    }
  }

  // Database name validation
  if (!database || typeof database !== 'string') {
    return { valid: false, error: 'Database name is required' };
  }
  if (!/^[a-zA-Z0-9_]+$/.test(database)) {
    return { valid: false, error: 'Database name can only contain letters, numbers, and underscores' };
  }

  // User validation
  if (!user || typeof user !== 'string') {
    return { valid: false, error: 'Username is required' };
  }
  if (user.length > 32) {
    return { valid: false, error: 'Username too long (max 32 characters)' };
  }

  // Password validation
  if (!password || typeof password !== 'string') {
    return { valid: false, error: 'Password is required' };
  }
  if (password.length < 1) {
    return { valid: false, error: 'Password cannot be empty' };
  }

  // Database type validation
  if (dbType && !['mysql', 'postgresql', 'mariadb'].includes(dbType.toLowerCase())) {
    return { valid: false, error: 'Unsupported database type' };
  }

  return { valid: true };
};

export const categorizeConnectionError = (error) => {
  const message = error.message.toLowerCase();
  
  if (message.includes('econnrefused')) {
    return 'Connection refused. Check if the database server is running and accessible. For cloud databases, verify firewall rules and security groups.';
  }
  if (message.includes('etimedout') || message.includes('timeout')) {
    return 'Connection timeout. The database server is not responding. Check your network connection and firewall settings.';
  }
  if (message.includes('access denied') || message.includes('er_access_denied')) {
    return 'Access denied. Invalid username or password.';
  }
  if (message.includes('unknown database')) {
    return 'Database not found. Check the database name.';
  }
  if (message.includes('enotfound') || message.includes('getaddrinfo')) {
    return 'Host not found. Check the hostname or IP address. For cloud databases, verify the endpoint URL.';
  }
  if (message.includes('er_dbaccess_denied')) {
    return 'User does not have permission to access this database.';
  }
  if (message.includes('ssl') || message.includes('tls')) {
    return 'SSL/TLS connection error. Try enabling or disabling SSL in connection settings.';
  }
  if (message.includes('handshake')) {
    return 'SSL handshake failed. Verify SSL settings and certificate configuration.';
  }
  if (message.includes('self signed certificate')) {
    return 'Self-signed certificate detected. SSL is configured to accept this.';
  }
  
  return 'Connection failed. Please check your credentials and network settings.';
};
