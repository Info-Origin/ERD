# Database Setup Guide

This directory contains SQL scripts for setting up the persistence database for the Reverse ERD application.

## 📋 Overview

The persistence database stores:
- Virtual schema modifications (relationships, tables, columns)
- Table positions on the canvas
- Baseline schemas for comparison
- Real database history tracking
- User preferences (future feature)

## 🚀 Initial Setup (First Time)

### Step 1: Create Database and Tables

Run the main schema creation script:

```bash
mysql -u root -p < persistence_schema.sql
```

Or in MySQL Workbench:
1. Open `persistence_schema.sql`
2. Execute the script (⚡ lightning bolt icon)

This creates:
- Database: `reverse_erd_persistence`
- Tables: `virtual_schemas`, `table_positions`, `baseline_schemas`, `real_db_history`, `user_preferences`

### Step 2: Create Database User and Grant Permissions

Run the permissions script:

```bash
mysql -u root -p < fix_permissions.sql
```

Or in MySQL Workbench:
1. Open `fix_permissions.sql`
2. Execute the script

This creates:
- User: `erd_persistence@localhost`
- Password: `PersistencePassword123!`
- Grants: SELECT, INSERT, UPDATE, DELETE on `reverse_erd_persistence.*`

### Step 3: Verify Setup

```sql
-- Check database exists
SHOW DATABASES LIKE 'reverse_erd_persistence';

-- Check tables exist
USE reverse_erd_persistence;
SHOW TABLES;

-- Check user permissions
SHOW GRANTS FOR 'erd_persistence'@'localhost';
```

Expected output:
```
+-------------------------+
| Tables_in_reverse_erd_persistence |
+-------------------------+
| baseline_schemas        |
| real_db_history        |
| table_positions        |
| user_preferences       |
| virtual_schemas        |
+-------------------------+
```

## 🔧 Troubleshooting

### Problem: "Access denied for user 'erd_persistence'"

**Solution:** Run the permissions fix script:
```bash
mysql -u root -p < fix_permissions.sql
```

### Problem: "Unknown database 'reverse_erd_persistence'"

**Solution:** Run the schema creation script:
```bash
mysql -u root -p < persistence_schema.sql
```

### Problem: Backend won't start

**Check:**
1. MySQL is running: `mysql -u root -p`
2. Database exists: `SHOW DATABASES;`
3. User exists: `SELECT User FROM mysql.user WHERE User='erd_persistence';`
4. Credentials in `backend/.env` match the database user

### Problem: Tables are empty

This is normal! Tables populate as users:
- Create virtual relationships
- Move tables on canvas
- Make schema modifications

## 💾 Backup and Restore

### Backup All Data

```bash
# Full backup
mysqldump -u root -p reverse_erd_persistence > backup_$(date +%Y%m%d).sql

# Backup specific table
mysqldump -u root -p reverse_erd_persistence virtual_schemas > virtual_schemas_backup.sql
```

### Restore from Backup

```bash
# Restore full backup
mysql -u root -p reverse_erd_persistence < backup_20240223.sql

# Restore specific table
mysql -u root -p reverse_erd_persistence < virtual_schemas_backup.sql
```

## 🔍 Monitoring

### Check Storage Usage

```sql
USE reverse_erd_persistence;

SELECT 
  table_name,
  ROUND(((data_length + index_length) / 1024 / 1024), 2) AS size_mb,
  table_rows
FROM information_schema.TABLES
WHERE table_schema = 'reverse_erd_persistence'
ORDER BY (data_length + index_length) DESC;
```

### Check Recent Activity

```sql
-- Recent virtual schema updates
SELECT schema_name, updated_at 
FROM virtual_schemas 
ORDER BY updated_at DESC 
LIMIT 10;

-- Count of schemas
SELECT COUNT(*) as total_schemas FROM virtual_schemas;

-- Count of relationships per schema
SELECT 
  schema_name,
  JSON_LENGTH(virtual_schema, '$.relationships') as relationship_count
FROM virtual_schemas;
```

## 🗑️ Cleanup (Use with Caution!)

### Clear All Data (Keep Structure)

```sql
USE reverse_erd_persistence;

TRUNCATE TABLE virtual_schemas;
TRUNCATE TABLE table_positions;
TRUNCATE TABLE baseline_schemas;
TRUNCATE TABLE real_db_history;
TRUNCATE TABLE user_preferences;
```

### Delete Specific Schema Data

```sql
-- Delete all data for a specific schema
DELETE FROM virtual_schemas WHERE schema_name = 'your_schema_name';
DELETE FROM table_positions WHERE schema_name = 'your_schema_name';
DELETE FROM baseline_schemas WHERE schema_name = 'your_schema_name';
DELETE FROM real_db_history WHERE schema_name = 'your_schema_name';
```

### Complete Removal (Nuclear Option)

```sql
-- Drop everything (you'll need to run setup scripts again)
DROP DATABASE IF EXISTS reverse_erd_persistence;
DROP USER IF EXISTS 'erd_persistence'@'localhost';
```

## 📊 Database Schema

### Table: virtual_schemas
Stores virtual schema modifications (relationships, tables, columns)

| Column | Type | Description |
|--------|------|-------------|
| id | INT | Primary key |
| schema_name | VARCHAR(255) | Name of the database schema |
| virtual_schema | JSON | Complete virtual schema data |
| created_at | TIMESTAMP | When first created |
| updated_at | TIMESTAMP | Last modification time |

### Table: table_positions
Stores X,Y coordinates of tables on canvas

| Column | Type | Description |
|--------|------|-------------|
| id | INT | Primary key |
| schema_name | VARCHAR(255) | Name of the database schema |
| positions | JSON | Table positions {tableName: {x, y}} |
| created_at | TIMESTAMP | When first created |
| updated_at | TIMESTAMP | Last modification time |

### Table: baseline_schemas
Stores original database schema for comparison

| Column | Type | Description |
|--------|------|-------------|
| id | INT | Primary key |
| schema_name | VARCHAR(255) | Name of the database schema |
| baseline_schema | JSON | Original schema snapshot |
| created_at | TIMESTAMP | When first created |
| updated_at | TIMESTAMP | Last modification time |

### Table: real_db_history
Tracks changes in real database over time

| Column | Type | Description |
|--------|------|-------------|
| id | INT | Primary key |
| schema_name | VARCHAR(255) | Name of the database schema |
| history | JSON | Array of historical snapshots |
| created_at | TIMESTAMP | When first created |
| updated_at | TIMESTAMP | Last modification time |

### Table: user_preferences
Stores user-specific preferences (future feature)

| Column | Type | Description |
|--------|------|-------------|
| id | INT | Primary key |
| user_id | VARCHAR(255) | User identifier |
| preferences | JSON | User preferences object |
| created_at | TIMESTAMP | When first created |
| updated_at | TIMESTAMP | Last modification time |

## 🔐 Security Notes

### Production Deployment

**Change the default password!**

```sql
-- Update password for production
ALTER USER 'erd_persistence'@'localhost' IDENTIFIED BY 'YourStrongPasswordHere!';
FLUSH PRIVILEGES;
```

**Update backend/.env:**
```env
PERSISTENCE_DB_PASSWORD=YourStrongPasswordHere!
```

### Network Security

For production, restrict access:
```sql
-- Only allow from specific host
CREATE USER 'erd_persistence'@'your-app-server-ip' IDENTIFIED BY 'password';
GRANT SELECT, INSERT, UPDATE, DELETE ON reverse_erd_persistence.* TO 'erd_persistence'@'your-app-server-ip';
```

## 📝 Maintenance Schedule

### Daily
- Monitor storage usage
- Check for errors in application logs

### Weekly
- Backup database
- Review recent activity

### Monthly
- Analyze storage growth
- Clean up old/unused schemas
- Review and rotate passwords

## 🆘 Support

If you encounter issues:

1. Check backend logs for error messages
2. Verify MySQL is running: `systemctl status mysql`
3. Test database connection: `mysql -u erd_persistence -p reverse_erd_persistence`
4. Review this README for troubleshooting steps
5. Check main project documentation

## 📚 Related Documentation

- Main README: `../../README.md`
- Setup Guide: `../../PERSISTENCE_SETUP.md`
- Testing Guide: `../../TEST_PERSISTENCE.md`
- Implementation Summary: `../../PERSISTENCE_IMPLEMENTATION_SUMMARY.md`

---

**Last Updated:** 2024-02-23  
**Database Version:** 1.0  
**Compatible with:** Reverse ERD v1.0+
