-- Table Locks for Multi-User Collaboration
-- Stores locks on tables to prevent concurrent editing
-- Lock stays until user explicitly unlocks (no timeout, no auto-cleanup)

CREATE TABLE IF NOT EXISTS table_locks (
  id INT PRIMARY KEY AUTO_INCREMENT,
  schema_name VARCHAR(255) NOT NULL,
  table_name VARCHAR(255) NOT NULL,
  locked_by VARCHAR(255) NOT NULL,           -- Session ID
  user_display_name VARCHAR(255) NOT NULL,   -- "User A", "User B", etc.
  locked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE KEY unique_lock (schema_name, table_name),
  INDEX idx_locked_by (locked_by)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
