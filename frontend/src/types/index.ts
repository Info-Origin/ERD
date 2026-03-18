// ============================================================
// Core ERD Data Types
// ============================================================

export interface ColumnData {
  type: string;
  columnType?: string;
  pk: boolean;
  compositeKey?: boolean;
  fk?: boolean;
  isPkAndFk?: boolean;
  unique: boolean;
  nullable: boolean;
  autoIncrement: boolean;
  ordinalPosition?: number;
  isUserCreated?: boolean;
  isSynced?: boolean;
}

export interface TableData {
  name: string;
  columns: Record<string, ColumnData>;
  isUserCreated?: boolean;
}

export interface Relationship {
  fromTable: string;
  fromColumn: string;
  toTable: string;
  toColumn: string;
  constraintName?: string;
  updateRule?: string;
  deleteRule?: string;
  type: RelationshipType;
  cardinalityType?: string;
  isIdentifying?: boolean;
  isUnique?: boolean;
  isJunctionTable?: boolean;
  isUserCreated?: boolean;
  isSynced?: boolean;
  createdAt?: number;
  isJunctionRelationship?: boolean;
  junctionTable?: string;
}

export type RelationshipType =
  | 'ONE_TO_ONE'
  | 'ONE_TO_ONE_UNIQUE'
  | 'ONE_TO_MANY'
  | 'MANY_TO_MANY';

export interface ERDData {
  schemaName: string;
  tables: Record<string, TableData>;
  relationships: Relationship[];
}

// ============================================================
// Persistence Types
// ============================================================

export interface TablePositions {
  [tableName: string]: { x: number; y: number };
}

export interface SavedSchema {
  schema_name: string;
  updated_at: string;
}

export interface VirtualSchemaTimestamp {
  timestamp: number;
}

// ============================================================
// Connection Types
// ============================================================

export interface ConnectionConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  dbType?: string;
  connectionName?: string;
  ssl?: boolean;
}

export interface ConnectionInfo {
  name: string;
  host: string;
  port: number;
  database: string;
  user: string;
  ssl: boolean;
  connectionId: string;
}

export interface ActiveConnection {
  token: string;
  info: ConnectionInfo;
}

// ============================================================
// Lock Types
// ============================================================

export interface LockStatus {
  isLocked: boolean;
  lockedBy?: string;
  userDisplayName?: string;
  lockedAt?: string;
}

export interface SchemaLocks {
  [schemaName: string]: LockStatus;
}

// ============================================================
// Modal State Types
// ============================================================

export interface EditTableModalState {
  isOpen: boolean;
  tableName: string | null;
  schemaName: string | null;
}

export interface FKComparisonModalState {
  isOpen: boolean;
  comparisonResult: FKComparisonResult | null;
}

export interface DatabaseChangesModalState {
  isOpen: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  changes: any | null;
  isRefreshing: boolean;
  onComplete: (() => void) | null;
  targetSchema: string | null;
}

export interface NewChangesModalState {
  isOpen: boolean;
}

export interface UnsavedChangesModalState {
  isOpen: boolean;
  targetSchema: string | null;
  onConfirm: (() => void) | null;
}

export interface OutOfSyncModalState {
  isOpen: boolean;
}

export interface RelationshipDetailsModalState {
  isOpen: boolean;
  relationships: Relationship[];
}

export interface RelationshipDeleteModalState {
  isOpen: boolean;
  relationships: Relationship[];
}

export interface ExportPDFModalState {
  isOpen: boolean;
}

// ============================================================
// Change Detection Types
// ============================================================

export interface ColumnChange {
  columnName: string;
  oldValue?: unknown;
  newValue?: unknown;
}

export interface TableChanges {
  added: ColumnChange[];
  removed: ColumnChange[];
  modified?: ColumnChange[];
}

export interface DatabaseChanges {
  [tableName: string]: TableChanges;
}

export interface DatabaseChangeResult {
  hasChanges: boolean;
  isFirstLoad: boolean;
  changes: DatabaseChanges;
}

export interface FKComparisonResult {
  hasChanges: boolean;
  affectedTables: string[];
  changes: Record<string, TableChanges>;
}

// ============================================================
// Notification Types
// ============================================================

export type NotificationType = 'success' | 'error' | 'warning' | 'info';

export interface Notification {
  id: number;
  message: string;
  type: NotificationType;
}

// ============================================================
// Application / Dropdown Types
// ============================================================

export interface ApplicationOption {
  uuid: string;
  label: string;
}

// ============================================================
// Relationship Creation Types
// ============================================================

export type RelationshipCreationId =
  | 'one_to_one_identifying'
  | 'one_to_many_identifying'
  | 'many_to_many_identifying'
  | 'one_to_one_non_identifying'
  | 'one_to_many_non_identifying';

export interface RelationshipTypeDefinition {
  id: RelationshipCreationId;
  name: string;
  description: string;
  lineStyle: 'solid' | 'dashed';
  isIdentifying: boolean;
  cardinality: '1:1' | '1:N' | 'N:M';
}

export interface RelationshipCreationData {
  type: RelationshipTypeDefinition;
  parentTable: string;
  childTable: string;
  parentColumn?: string;
  childColumn?: string;
  timestamp: number;
}

// ============================================================
// Hover Highlight Types
// ============================================================

export interface HoverHighlightedRelationship extends Relationship {
  highlightType: 'primary' | 'foreign';
  isTablePrimaryKey: boolean;
  isTableForeignKey: boolean;
}

export interface NMHighlight {
  table1: string;
  table2: string;
  junctionTable: string;
}

// ============================================================
// History / Undo-Redo Types
// ============================================================

export interface RealDbHistoryEntry {
  timestamp: number;
  tables: string[];
  schema: ERDData;
}

// ============================================================
// Canvas / Layout Types
// ============================================================

export interface CanvasControls {
  onZoomIn: (() => void) | null;
  onZoomOut: (() => void) | null;
  onFitView: (() => void) | null;
  onResetLayout: (() => void) | null;
}

export interface LoadingProgress {
  current: number;
  total: number;
}

// ============================================================
// Column Notes Types
// ============================================================

export type ColumnNotes = Record<string, Record<string, string>>;

// ============================================================
// Search / Filter Types
// ============================================================

export interface ColumnIndexEntry {
  tableName: string;
  columnName: string;
  columnNameLower: string;
  columnType: string;
  isPK: boolean;
  isFK: boolean;
  isUnique: boolean;
}

export interface HighlightedColumnInfo {
  tableName: string;
  columnName: string;
}
