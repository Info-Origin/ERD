-- Migration: Add column_notes table
-- Purpose: Store user notes for columns (moving from localStorage to database)
-- Run this to add the column_notes table to existing persistence database

USE reverse_erd_persistence;

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

-- Grant permissions to erd_persistence user
-- GRANT SELECT, INSERT, UPDATE, DELETE ON reverse_erd_persistence.column_notes TO 'erd_persistence'@'localhost';
-- FLUSH PRIVILEGES;
