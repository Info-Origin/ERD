import { memo, useState } from 'react';
import { FiLink } from 'react-icons/fi';
import './RelationshipToolbar.css';

interface CrowsFootProps {
  side?: 'single' | 'both';
}

const CrowsFoot = ({ side = 'single' }: CrowsFootProps) => {
  if (side === 'both') {
    return (
      <svg width="40" height="16" viewBox="0 0 40 16" style={{ marginTop: '2px' }}>
        <line x1="2" y1="8" x2="10" y2="2" stroke="currentColor" strokeWidth="2" />
        <line x1="2" y1="8" x2="10" y2="14" stroke="currentColor" strokeWidth="2" />
        <line x1="2" y1="8" x2="10" y2="8" stroke="currentColor" strokeWidth="2" />
        <line x1="38" y1="8" x2="30" y2="2" stroke="currentColor" strokeWidth="2" />
        <line x1="38" y1="8" x2="30" y2="14" stroke="currentColor" strokeWidth="2" />
        <line x1="38" y1="8" x2="30" y2="8" stroke="currentColor" strokeWidth="2" />
      </svg>
    );
  }
  return (
    <svg width="20" height="16" viewBox="0 0 20 16" style={{ marginTop: '2px' }}>
      <line x1="10" y1="2" x2="4" y2="10" stroke="currentColor" strokeWidth="2" />
      <line x1="10" y1="2" x2="16" y2="10" stroke="currentColor" strokeWidth="2" />
      <line x1="10" y1="2" x2="10" y2="10" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
};

interface RelationshipMode {
  id: string;
  name: string;
  description: string;
  details: string;
  lineStyle: string;
  cardinality: string;
  crowsFoot: boolean | 'both';
  identifying: boolean | 'auto';
}

export const RelationshipToolbar = memo(() => {
  const [activeMode, setActiveMode] = useState<string | null>(null);

  const relationshipModes: RelationshipMode[] = [
    { id: "1-1-non-identifying", name: "1:1 Non-Identifying", description: "Place a new 1:1 non-identifying relationship", details: "Dashed line, No crow's foot, FK not part of PK, FK is UNIQUE", lineStyle: "dashed", cardinality: "1:1", crowsFoot: false, identifying: false },
    { id: "1-n-non-identifying", name: "1:N Non-Identifying", description: "Place a new 1:N non-identifying relationship", details: "Dashed line, Crow's foot on child side, FK not part of PK", lineStyle: "dashed", cardinality: "1:n", crowsFoot: true, identifying: false },
    { id: "1-1-identifying", name: "1:1 Identifying", description: "Place a new 1:1 identifying relationship", details: "Solid line, No crow's foot, FK is part of PK", lineStyle: "solid", cardinality: "1:1", crowsFoot: false, identifying: true },
    { id: "1-n-identifying", name: "1:N Identifying", description: "Place a new 1:N identifying relationship", details: "Solid line, Crow's foot on child side, FK is part of PK", lineStyle: "solid", cardinality: "1:n", crowsFoot: true, identifying: true },
    { id: "n-m-identifying", name: "N:M Identifying", description: "Place a new N:M identifying relationship", details: "Create junction table automatically, Composite primary key made of both FKs, Two solid 1:N identifying relationships", lineStyle: "solid", cardinality: "n:m", crowsFoot: "both", identifying: true },
    { id: "existing-column", name: "Use Existing Column", description: "Place a relationship using existing column", details: "Detect FK existence, PK membership, UNIQUE constraint, Infer cardinality and identifying vs non-identifying, Render appropriate line style and symbols automatically", lineStyle: "auto", cardinality: "1:n", crowsFoot: true, identifying: "auto" },
  ];

  const handleModeSelect = (mode: RelationshipMode) => {
    setActiveMode(activeMode === mode.id ? null : mode.id);
  };

  return (
    <div className="relationship-toolbar">
      <div className="relationship-toolbar-header">
        <h3>MySQL Workbench Relationships</h3>
        <p className="toolbar-subtitle">Crow's Foot Notation</p>
      </div>
      <div className="relationship-icons">
        {relationshipModes.map((mode) => (
          <div
            key={mode.id}
            className={`relationship-icon ${activeMode === mode.id ? 'active' : ''} ${mode.lineStyle === 'auto' ? 'special' : ''}`}
            onClick={() => handleModeSelect(mode)}
            title={mode.details}
          >
            <div className="icon-visual">
              <div className={`line ${mode.lineStyle}`}></div>
              <div className="cardinality">{mode.cardinality}</div>
              {mode.crowsFoot === true && <CrowsFoot side="single" />}
              {mode.crowsFoot === "both" && <CrowsFoot side="both" />}
              {mode.id === "existing-column" && <FiLink className="existing-column-icon" />}
            </div>
            <span className="icon-label">{mode.name}</span>
          </div>
        ))}
      </div>
      {activeMode && (
        <div className="relationship-mode-details">
          <h4>Active Mode</h4>
          <p className="mode-description">{relationshipModes.find((m) => m.id === activeMode)?.description}</p>
          <small className="mode-details">{relationshipModes.find((m) => m.id === activeMode)?.details}</small>
        </div>
      )}
      <div className="relationship-toolbar-footer">
        <small>Click to select relationship creation mode</small>
        <small className="note">Visual notation matches MySQL Workbench exactly</small>
      </div>
    </div>
  );
});

RelationshipToolbar.displayName = 'RelationshipToolbar';
