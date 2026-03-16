-- Migration: Remove table-level locks, replaced by schema-level locks
-- Run this once against your persistence DB

DROP TABLE IF EXISTS table_locks;
