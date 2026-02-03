import { useState, useMemo } from "react";
import { FiX } from "react-icons/fi";
import { Button } from "../common/Button";
import { IconButton } from "../common/IconButton";
import { useApp } from "../../context/AppContext";
import "./Modal.css";

const RELATIONSHIP_TYPES = [
  { value: "ONE_TO_ONE", label: "One to One (1:1)" },
  { value: "ONE_TO_MANY", label: "One to Many (1:N)" },
  { value: "MANY_TO_ONE", label: "Many to One (N:1)" },
  { value: "MANY_TO_MANY", label: "Many to Many (N:N)" },
];

export const AddRelationshipModal = ({ isOpen, onClose, onAdd }) => {
  const { erdData } = useApp();

  const [fromTable, setFromTable] = useState("");
  const [fromColumn, setFromColumn] = useState("");
  const [toTable, setToTable] = useState("");
  const [toColumn, setToColumn] = useState("");
  const [relationType, setRelationType] = useState("ONE_TO_MANY");
  const [error, setError] = useState("");

  const tables = useMemo(() => {
    return erdData?.tables ? Object.keys(erdData.tables) : [];
  }, [erdData]);

  const fromColumns = useMemo(() => {
    if (!fromTable || !erdData?.tables[fromTable]) return [];
    return Object.keys(erdData.tables[fromTable].columns);
  }, [fromTable, erdData]);

  const toColumns = useMemo(() => {
    if (!toTable || !erdData?.tables[toTable]) return [];
    return Object.keys(erdData.tables[toTable].columns);
  }, [toTable, erdData]);

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!fromTable || !fromColumn || !toTable || !toColumn) {
      setError("All fields are required");
      return;
    }

    if (fromTable === toTable && fromColumn === toColumn) {
      setError("Cannot create self-referencing relationship on same column");
      return;
    }

    try {
      onAdd(fromTable, fromColumn, toTable, toColumn, relationType);
      resetForm();
      onClose();
    } catch (err) {
      setError(err.message);
    }
  };

  const resetForm = () => {
    setFromTable("");
    setFromColumn("");
    setToTable("");
    setToColumn("");
    setRelationType("ONE_TO_MANY");
    setError("");
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div
        className="modal-content modal-wide"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2>Add Relationship</h2>
          <IconButton icon={FiX} onClick={handleClose} title="Close" />
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="fromTable">From Table</label>
                <select
                  id="fromTable"
                  className="form-select"
                  value={fromTable}
                  onChange={(e) => {
                    setFromTable(e.target.value);
                    setFromColumn("");
                  }}
                >
                  <option value="">Select table...</option>
                  {tables.map((table) => (
                    <option key={table} value={table}>
                      {table}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="fromColumn">From Column</label>
                <select
                  id="fromColumn"
                  className="form-select"
                  value={fromColumn}
                  onChange={(e) => setFromColumn(e.target.value)}
                  disabled={!fromTable}
                >
                  <option value="">Select column...</option>
                  {fromColumns.map((col) => (
                    <option key={col} value={col}>
                      {col}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="toTable">To Table</label>
                <select
                  id="toTable"
                  className="form-select"
                  value={toTable}
                  onChange={(e) => {
                    setToTable(e.target.value);
                    setToColumn("");
                  }}
                >
                  <option value="">Select table...</option>
                  {tables.map((table) => (
                    <option key={table} value={table}>
                      {table}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="toColumn">To Column</label>
                <select
                  id="toColumn"
                  className="form-select"
                  value={toColumn}
                  onChange={(e) => setToColumn(e.target.value)}
                  disabled={!toTable}
                >
                  <option value="">Select column...</option>
                  {toColumns.map((col) => (
                    <option key={col} value={col}>
                      {col}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="form-group">
              <label htmlFor="relationType">Relationship Type</label>
              <select
                id="relationType"
                className="form-select"
                value={relationType}
                onChange={(e) => setRelationType(e.target.value)}
              >
                {RELATIONSHIP_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>
            {error && <span className="form-error">{error}</span>}
          </div>
          <div className="modal-footer">
            <Button variant="ghost" onClick={handleClose}>
              Cancel
            </Button>
            <Button variant="primary" type="submit">
              Add Relationship
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
