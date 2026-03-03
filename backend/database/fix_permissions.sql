-- Fix Permissions for Persistence User
-- Purpose: Fix database user permissions
-- Run this if you get "Access denied" errors
--
-- This script:
--   - Drops existing user (if any)
--   - Creates fresh user: erd_persistence@localhost
--   - Grants necessary permissions
--   - Verifies the setup
--
-- Usage:
--   mysql -u root -p < fix_permissions.sql

-- Fix Permissions for Persistence User
-- Run this script in MySQL Workbench or MySQL CLI as root user

-- Step 1: Check if user exists
SELECT User, Host FROM mysql.user WHERE User = 'erd_persistence';

-- Step 2: Drop user if exists (to start fresh)
DROP USER IF EXISTS 'erd_persistence'@'localhost';

-- Step 3: Create user with password
CREATE USER 'erd_persistence'@'localhost' IDENTIFIED BY 'PersistencePassword123!';

-- Step 4: Grant permissions on the persistence database
GRANT SELECT, INSERT, UPDATE, DELETE ON reverse_erd_persistence.* TO 'erd_persistence'@'localhost';

-- Step 5: Apply changes
FLUSH PRIVILEGES;

-- Step 6: Verify permissions
SHOW GRANTS FOR 'erd_persistence'@'localhost';

-- Expected output should include:
-- GRANT SELECT, INSERT, UPDATE, DELETE ON `reverse_erd_persistence`.* TO `erd_persistence`@`localhost`

-- Step 7: Test connection (optional - run this in a new connection)
-- USE reverse_erd_persistence;
-- SELECT COUNT(*) FROM virtual_schemas;
