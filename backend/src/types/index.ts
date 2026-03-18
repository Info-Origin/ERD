import type { Request } from "express";

// ==================== REQUEST AUGMENTATION ====================

export interface AuthUser {
  id?: string;
  userId?: string;
  connectionId?: string;
  connectionName?: string;
  host?: string;
  port?: number;
  database?: string;
  user?: string;
  ssl?: boolean;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
  connectionId?: string;
}

// ==================== ERD / SCHEMA TYPES ====================

export interface ColumnInfo {
  type: string;
  columnType: string;
  pk: boolean;
  compositeKey: boolean;
  unique: boolean;
  nullable: boolean;
  autoIncrement: boolean;
  ordinalPosition: number;
  fk?: boolean;
  isPkAndFk?: boolean;
}

export interface TableInfo {
  name: string;
  columns: Record<string, ColumnInfo>;
}

export type TablesMap = Record<string, TableInfo>;

export type RelationType =
  | "ONE_TO_MANY"
  | "ONE_TO_ONE"
  | "ONE_TO_ONE_UNIQUE"
  | "MANY_TO_MANY";

export interface Relationship {
  fromTable: string;
  fromColumn: string;
  toTable: string;
  toColumn: string;
  constraintName: string;
  updateRule: string;
  deleteRule: string;
  type: RelationType;
  cardinalityType: string;
  isIdentifying: boolean;
  isUnique: boolean;
  isJunctionTable: boolean;
}

export interface SchemaModel {
  schemaName: string;
  tables: TablesMap;
  relationships: Relationship[];
}

// ==================== CONNECTION TYPES ====================

export interface ConnectionConfig {
  host: string;
  port?: number;
  database: string;
  user: string;
  password?: string;
  ssl?: boolean;
}

export interface PoolMetadata {
  createdAt: number;
  lastUsed: number;
  userId: string;
  config: {
    host: string;
    port: number | undefined;
    database: string;
    user: string;
  };
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

// ==================== PERSISTENCE TYPES ====================

export interface VirtualSchemaRow {
  virtual_schema: string;
  updated_at: Date;
}

export interface TablePositionsRow {
  positions: string;
  updated_at: Date;
}

export interface BaselineSchemaRow {
  baseline_schema: string;
  updated_at: Date;
}

export interface RealDbHistoryRow {
  history: string;
  updated_at: Date;
}

export interface TimestampRow {
  timestamp: number;
}

export interface CountRow {
  count: number;
}

export interface SchemaNameRow {
  schema_name: string;
}

export interface SchemaListRow {
  schema_name: string;
  updated_at: Date;
}

// ==================== LOCK TYPES ====================

export interface SchemaLockRow {
  id: number;
  schema_name: string;
  locked_by: string;
  user_display_name: string;
  locked_at: Date;
}

export interface LockStatus {
  isLocked: boolean;
  lockedBy?: string;
  userDisplayName?: string;
  lockedAt?: Date;
}

// ==================== PDF EXPORT TYPES ====================

export interface ExportOptions {
  pageSize?: string;
  orientation?: string;
  width?: number;
  height?: number;
  quality?: string;
  schemaName?: string;
}

export interface ERDNode {
  position: { x: number; y: number };
  width?: number;
  height?: number;
  data?: {
    tableName?: string;
    columns?: ColumnInfo[] | Record<string, ColumnInfo>;
  };
}

export interface ERDEdge {
  sourceX?: number;
  sourceY?: number;
  targetX?: number;
  targetY?: number;
  data?: {
    isUserCreated?: boolean;
  };
}

export interface ERDData {
  nodes: ERDNode[];
  edges: ERDEdge[];
  viewport?: unknown;
  theme?: string;
}
