import { useApp } from "../../context/AppContext";
import { useVirtualSchema } from "../../context/VirtualSchemaContext";
import { compareForeignKeys } from "../../utils/fkComparison";
import "./CanvasControls.css";

export const CanvasControls = ({ isCollapsed }) => {
  const { selectedSchema, showFKComparison, showNotification, openExportPDFModal } = useApp();
  const { originalSchema, workingSchema } = useVirtualSchema();

  const handleCompareClick = () => {
    if (!originalSchema || !workingSchema || !selectedSchema) {
      showNotification?.("Please select a schema first", "warning");
      return;
    }

    // Compare foreign keys between baseline and virtual schemas
    const comparisonResult = compareForeignKeys(originalSchema, workingSchema);
    
    if (!comparisonResult.hasChanges) {
      // Show "No changes" notification
      showNotification?.("No changes are applied.", "info");
      return;
    }

    // Show FK comparison modal
    showFKComparison?.(comparisonResult);
  };

  const handleExportClick = () => {
    if (!selectedSchema) {
      showNotification?.("Please select a schema first", "warning");
      return;
    }
    openExportPDFModal?.();
  };

  return (
    <div className={`canvas-controls ${isCollapsed ? 'collapsed' : ''}`}>
       {/* Compare Changes Button */}
      <button
        className="canvas-control-button compare-button"
        title="Compare foreign key changes"
        onClick={handleCompareClick}
        disabled={!selectedSchema}
      >
        <img 
          src="/compare.png" 
          alt="Compare" 
          width="16" 
          height="16"
          style={{ filter: !selectedSchema ? 'grayscale(100%) opacity(0.5)' : 'none' }}
        />
        <span className="compare-button-text">Compare Changes</span>
      </button>

      {/* Export PDF Button */}
      <button
        className="canvas-control-button export-button"
        title="Export ERD to PDF"
        onClick={handleExportClick}
        disabled={!selectedSchema}
      >
        <svg 
          width="16" 
          height="16" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="2"
          style={{ filter: !selectedSchema ? 'grayscale(100%) opacity(0.5)' : 'none' }}
        >
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
        <span className="export-button-text">Export ERD</span>
      </button>
    </div>
  );
};
