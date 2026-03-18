import { FiKey, FiLink } from "react-icons/fi";
import { Badge } from "../common/Badge";
import { BADGE_VARIANTS } from "../../utils/constants";
import { formatDataTypeForDisplay, getFullDataType } from "../../utils/dataTypeFormatter";
import { useApp } from "../../context/AppContext";
import type { ColumnData } from "../../types";
import "./ColumnList.css";

interface ColumnListProps {
  tableName: string;
  columns: Record<string, ColumnData>;
}

export const ColumnList = ({ tableName, columns }: ColumnListProps) => {
  const {
    togglePrimaryKey,
    toggleUnique,
    toggleNullable,
  } = useApp();

  if (!columns || Object.keys(columns).length === 0) {
    return <div className="column-empty">No columns</div>;
  }

  const handleTogglePK = (columnName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    togglePrimaryKey(tableName, columnName);
  };

  const handleToggleUnique = (columnName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    toggleUnique(tableName, columnName);
  };

  const handleToggleNullable = (columnName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    toggleNullable(tableName, columnName);
  };

  return (
    <ul className="column-list">
      {Object.entries(columns).map(([columnName, columnData]) => (
        <li key={columnName} className="column-item">
          <div className="column-info">
            {columnData.fk && <FiLink className="column-icon fk-icon" />}
            {columnData.pk && !columnData.fk && <FiKey className="column-icon pk-icon" />}
            <div className="column-constraints-and-name">
              <span className="column-name" title={columnName}>
                {columnName}
              </span>
            </div>
          </div>

          <div className="column-meta">
            <div className="column-badges">
              {columnData.compositeKey ? (
                <Badge
                  variant={BADGE_VARIANTS.COMPOSITE_KEY}
                  className="constraint-badge-readonly"
                  title={columnData.fk ? "Composite Key (also Foreign Key)" : "Composite Key - Part of multi-column primary key"}
                >
                  CK
                </Badge>
              ) : columnData.fk ? (
                <Badge
                  variant={BADGE_VARIANTS.FK}
                  className="constraint-badge-readonly"
                  title={columnData.isPkAndFk ? "Primary Key serving as Foreign Key" : "Foreign Key (managed via relationships)"}
                >
                  FK
                </Badge>
              ) : columnData.pk ? (
                <Badge
                  variant={BADGE_VARIANTS.PK}
                  className="constraint-badge"
                  onClick={(e) => handleTogglePK(columnName, e)}
                  title="Primary Key - Click to remove"
                >
                  PK
                </Badge>
              ) : null}

              {columnData.unique && (
                <Badge
                  variant={BADGE_VARIANTS.UNIQUE}
                  className="constraint-badge"
                  onClick={(e) => handleToggleUnique(columnName, e)}
                  title="Unique - Click to remove"
                >
                  UQ
                </Badge>
              )}

              {columnData.nullable === false && !columnData.pk && !columnData.compositeKey && (
                <Badge
                  variant={BADGE_VARIANTS.NOT_NULL}
                  className="constraint-badge"
                  onClick={(e) => handleToggleNullable(columnName, e)}
                  title="NOT NULL - Click to allow nulls"
                >
                  NN
                </Badge>
              )}

              {columnData.autoIncrement && (
                <Badge
                  variant={BADGE_VARIANTS.AUTO_INCREMENT}
                  className="constraint-badge-readonly"
                  title="Auto Increment (read-only)"
                >
                  AI
                </Badge>
              )}
            </div>
            <span className="column-type-display" title={getFullDataType(columnData.type)}>
              {formatDataTypeForDisplay(columnData.type)}
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
};
