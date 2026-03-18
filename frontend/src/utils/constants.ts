export const NODE_TYPES = { TABLE: 'tableCard' } as const;
export const EDGE_TYPES = { RELATIONSHIP: 'relationship' } as const;
export const CONSTRAINT_TYPES = { PRIMARY_KEY: 'PK', FOREIGN_KEY: 'FK', UNIQUE: 'UNIQUE' } as const;

export const BADGE_VARIANTS = {
  PK: 'pk',
  FK: 'fk',
  UNIQUE: 'unique',
  NOT_NULL: 'not-null',
  AUTO_INCREMENT: 'auto-increment',
  COMPOSITE_KEY: 'composite-key',
  DEFAULT: 'default',
} as const;

export type BadgeVariant = (typeof BADGE_VARIANTS)[keyof typeof BADGE_VARIANTS];

export const LAYOUT_CONFIG = {
  NODE_WIDTH: 350,
  NODE_MIN_HEIGHT: 150,
  ROW_HEIGHT: 28,
  HEADER_HEIGHT: 48,
  PADDING: 16,
  RANK_DIR: 'TB',
  RANK_SEP: 200,
  NODE_SEP: 180,
} as const;

export const RELATIONSHIP_TYPES = {
  ONE_TO_ONE: '1:1',
  ONE_TO_MANY: '1:N',
  MANY_TO_ONE: 'N:1',
  MANY_TO_MANY: 'N:N',
} as const;

export const THEMES = { LIGHT: 'light', DARK: 'dark' } as const;

export const STORAGE_KEYS = {
  THEME: 'reverseERD_theme',
  PANEL_WIDTH: 'reverseERD_panelWidth',
} as const;

export const EDGE_MARKERS = {
  ARROW: { type: 'arrowclosed', color: 'var(--fk-color)', width: 20, height: 20 },
} as const;

export const LAYOUT_DIRECTION = { TOP_BOTTOM: 'TB', LEFT_RIGHT: 'LR' } as const;
