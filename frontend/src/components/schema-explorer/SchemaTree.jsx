import { SchemaNode } from "./SchemaNode";
import { Loader } from "../common/Loader";
import { useApp } from "../../context/AppContext";
import "./SchemaTree.css";

export const SchemaTree = () => {
  const { erdData, erdLoading, erdError } = useApp();

  // REMOVED: Structure editing props and functions
  // - onAddColumn, deleteTable

  if (erdLoading) {
    return (
      <div className="tree-loading">
        <Loader size="md" text="Loading schema..." />
      </div>
    );
  }

  if (erdError) {
    return (
      <div className="tree-error">
        <p>{erdError}</p>
      </div>
    );
  }

  if (!erdData) {
    return (
      <div className="tree-empty">
        <p>Select a schema to view its structure</p>
      </div>
    );
  }

  return (
    <div className="schema-tree">
      <SchemaNode
        schemaName={erdData.schemaName}
        tables={erdData.tables}
      />
    </div>
  );
};
