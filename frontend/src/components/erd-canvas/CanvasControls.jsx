import { useApp } from "../../context/AppContext";
import { useVirtualSchema } from "../../context/VirtualSchemaContext";
import { compareForeignKeys } from "../../utils/fkComparison";
import "./CanvasControls.css";

export const CanvasControls = () => {
  const { selectedSchema, showFKComparison, showNotification } = useApp();
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

  return (
    <div className="canvas-controls">
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
    </div>
  );
};
