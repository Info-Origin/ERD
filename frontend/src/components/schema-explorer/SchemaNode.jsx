import { useState } from "react";
import { FiChevronRight, FiChevronDown, FiDatabase } from "react-icons/fi";
import { TableNode } from "./TableNode";
import { useApp } from "../../context/AppContext";
import { clsx } from "clsx";
import "./SchemaNode.css";

export const SchemaNode = ({ schemaName, tables }) => {
  const { selectedSchema, selectSchema } = useApp();
  const [isExpanded, setIsExpanded] = useState(selectedSchema === schemaName);
  const isSelected = selectedSchema === schemaName;

  const handleToggle = () => {
    if (!isExpanded) {
      selectSchema(schemaName);
    }
    setIsExpanded(!isExpanded);
  };

  const tableCount = Object.keys(tables || {}).length;

  return (
    <div className="schema-node">
      <div
        className={clsx("schema-header", { "schema-selected": isSelected })}
        onClick={handleToggle}
      >
        <button
          className="schema-toggle"
          aria-label={isExpanded ? "Collapse schema" : "Expand schema"}
        >
          {isExpanded ? <FiChevronDown /> : <FiChevronRight />}
        </button>
        <FiDatabase className="schema-icon" />
        <span className="schema-name">{schemaName}</span>
        <span className="schema-count">{tableCount} tables</span>
      </div>
      {isExpanded && tables && (
        <div className="schema-content">
          {Object.entries(tables).map(([tableName, tableData]) => (
            <TableNode
              key={tableName}
              tableName={tableName}
              tableData={tableData}
            />
          ))}
        </div>
      )}
    </div>
  );
};
