-- Persistence Database Schema for Reverse ERD

-- Purpose: Initial database setup for persistence layer
-- Run this ONCE when setting up a new environment

-- This script creates:
--   - Database: reverse_erd_persistence
--   - Tables: virtual_schemas, table_positions, baseline_schemas, 
--             real_db_history, user_preferences
--   - Database user: erd_persistence (with permissions)

-- Usage:
--   mysql -u root -p < persistence_schema.sql

-- Persistence Database Schema for Reverse ERD
-- This database stores virtual schema changes, table positions, and history
-- Separate from the read-only real databases

CREATE DATABASE IF NOT EXISTS reverse_erd_persistence 
  CHARACTER SET utf8mb4 
  COLLATE utf8mb4_unicode_ci;

USE reverse_erd_persistence;

-- Table: virtual_schemas
-- Stores the virtual schema modifications for each database schema
CREATE TABLE IF NOT EXISTS virtual_schemas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  schema_name VARCHAR(255) NOT NULL,
  virtual_schema JSON NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_schema (schema_name),
  INDEX idx_schema_name (schema_name),
  INDEX idx_updated_at (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: table_positions
-- Stores canvas positions for tables in each schema
CREATE TABLE IF NOT EXISTS table_positions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  schema_name VARCHAR(255) NOT NULL,
  positions JSON NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_schema_positions (schema_name),
  INDEX idx_schema_name (schema_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: baseline_schemas
-- Stores the original database schema state for comparison
CREATE TABLE IF NOT EXISTS baseline_schemas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  schema_name VARCHAR(255) NOT NULL,
  baseline_schema JSON NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_baseline (schema_name),
  INDEX idx_schema_name (schema_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: real_db_history
-- Tracks changes in the real database over time
CREATE TABLE IF NOT EXISTS real_db_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  schema_name VARCHAR(255) NOT NULL,
  history JSON NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_history (schema_name),
  INDEX idx_schema_name (schema_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: user_preferences (optional - for future use)
-- Stores user-specific preferences like theme, layout mode, etc.
CREATE TABLE IF NOT EXISTS user_preferences (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL DEFAULT 'default',
  preferences JSON NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_user (user_id),
  INDEX idx_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- Table: column_notes
-- Stores user notes/comments for specific columns in each schema
CREATE TABLE IF NOT EXISTS column_notes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  schema_name VARCHAR(255) NOT NULL,
  table_name VARCHAR(255) NOT NULL,
  column_name VARCHAR(255) NOT NULL,
  note TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_column_note (schema_name, table_name, column_name),
  INDEX idx_schema_table (schema_name, table_name),
  INDEX idx_schema_name (schema_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS schema_locks (
  id INT PRIMARY KEY AUTO_INCREMENT,
  schema_name VARCHAR(255) NOT NULL,
  locked_by VARCHAR(255) NOT NULL,           -- Session ID
  user_display_name VARCHAR(255) NOT NULL,   -- "User A", "User B", etc.
  locked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE KEY unique_schema_lock (schema_name),
  INDEX idx_locked_by (locked_by)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create a dedicated user for persistence operations
-- Run these commands manually in MySQL:
-- CREATE USER IF NOT EXISTS 'erd_persistence'@'localhost' IDENTIFIED BY 'PersistencePassword123!';
-- GRANT SELECT, INSERT, UPDATE, DELETE ON reverse_erd_persistence.* TO 'erd_persistence'@'localhost';
-- FLUSH PRIVILEGES;
