import { FiZoomIn, FiZoomOut, FiMaximize2, FiTarget, FiGitBranch } from "react-icons/fi";
import { IconButton } from "../common/IconButton";
import { useApp } from "../../context/AppContext";
import { useVirtualSchema } from "../../context/VirtualSchemaContext";
import { compareForeignKeys } from "../../utils/fkComparison";
import "./CanvasControls.css";

export const CanvasControls = ({ onZoomIn, onZoomOut, onFitView, onRecalculatePorts }) => {
  const { crowsFootMode, toggleCrowsFootMode, selectedSchema, showFKComparison, showNotification } = useApp();
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
      <IconButton
        icon={FiZoomIn}
        title="Zoom In"
        onClick={onZoomIn}
        size="md"
      />
      <IconButton
        icon={FiZoomOut}
        title="Zoom Out"
        onClick={onZoomOut}
        size="md"
      />
      <IconButton
        icon={FiMaximize2}
        title="Center ERD (Fit All Tables to View)"
        onClick={onFitView}
        size="md"
      />      
      {/* Crow's Foot Notation Toggle */}
      <IconButton
        icon={FiGitBranch}
        title={crowsFootMode ? "Switch to Simple Lines" : "Switch to Crow's Foot Notation"}
        onClick={toggleCrowsFootMode}
        size="md"
        style={{
          background: crowsFootMode ? '#10b981' : 'var(--bg-secondary)',
          color: crowsFootMode ? 'white' : 'var(--text-primary)',
          border: crowsFootMode ? '1px solid #059669' : '1px solid var(--border-color)'
        }}
      />

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
      
      {/* Temporarily hidden - Recalculate Connection Points button */}
      {false && onRecalculatePorts && (
        <IconButton
          icon={FiTarget}
          title="Recalculate Connection Points"
          onClick={onRecalculatePorts}
          size="md"
          style={{ background: '#3b82f6', color: 'white' }}
        />
      )}
    </div>
  );
};
