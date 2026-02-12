import { useState, useEffect } from "react";
import { Badge } from "../common/Badge";
import { BADGE_VARIANTS } from "../../utils/constants";
import { useApp } from "../../context/AppContext";
import { useRelationshipCreation } from "../../context/RelationshipCreationContext";
import "./Legend.css";

export const Legend = ({ isInHeader = false }) => {
  const { crowsFootMode } = useApp();
  const { 
    startRelationshipCreation, 
    cancelRelationshipCreation, 
    relationshipType,
    RELATIONSHIP_TYPES 
  } = useRelationshipCreation();
  const [isExpanded, setIsExpanded] = useState(true);
  const [showHelpNotification, setShowHelpNotification] = useState(false);

  const toggleExpanded = () => {
    const newExpandedState = !isExpanded;
    setIsExpanded(newExpandedState);
    
    // If collapsing the legend, cancel any active relationship creation
    if (!newExpandedState && relationshipType) {
      cancelRelationshipCreation();
      setShowHelpNotification(false);
    }
  };

  const handleRelationshipClick = (relType) => {
    if (relationshipType?.id === relType.id) {
      // Clicking same icon again - cancel
      cancelRelationshipCreation();
      setShowHelpNotification(false);
    } else {
      // Start new relationship creation
      startRelationshipCreation(relType);
      
      // Check if user wants to see the help notification
      const dontShowAgain = localStorage.getItem('hideRelationshipHelp');
      if (!dontShowAgain) {
        setShowHelpNotification(true);
      }
    }
  };

  const handleDontShowAgain = () => {
    localStorage.setItem('hideRelationshipHelp', 'true');
    setShowHelpNotification(false);
  };

  const handleCloseNotification = () => {
    setShowHelpNotification(false);
  };

  const isRelationshipSelected = (relType) => {
    return relationshipType?.id === relType.id;
  };

  return (
    <div className={`erd-legend ${isExpanded ? 'expanded' : 'collapsed'} ${isInHeader ? 'in-header' : ''}`}>
      {/* Header - ALWAYS VISIBLE */}
      <div className="legend-header" onClick={toggleExpanded}>
        <div className="legend-title">LEGEND</div>
        <button 
          className="legend-toggle" 
          aria-label={isExpanded ? 'Collapse legend' : 'Expand legend'}
          type="button"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
            <path d={isExpanded ? "M2 8 L6 4 L10 8" : "M2 4 L6 8 L10 4"} stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>
      
      {/* Items - ONLY WHEN EXPANDED */}
      {isExpanded && (
        <div className="legend-items">
          <div className="legend-item">
            <Badge variant={BADGE_VARIANTS.PK}>PK</Badge>
            <span>Primary Key</span>
          </div>
          <div className="legend-item">
            <Badge variant={BADGE_VARIANTS.COMPOSITE_KEY}>CK</Badge>
            <span>Composite Key</span>
          </div>
          <div className="legend-item">
            <Badge variant={BADGE_VARIANTS.FK}>FK</Badge>
            <span>Foreign Key</span>
          </div>
          <div className="legend-item">
            <Badge variant={BADGE_VARIANTS.UNIQUE}>UQ</Badge>
            <span>Unique</span>
          </div>
          <div className="legend-item">
            <Badge variant={BADGE_VARIANTS.NOT_NULL}>NN</Badge>
            <span>Not Null</span>
          </div>
          <div className="legend-item">
            <Badge variant={BADGE_VARIANTS.AUTO_INCREMENT}>AI</Badge>
            <span>Auto Increment</span>
          </div>
          
          {/* Crow's foot notation legend */}
          {crowsFootMode && (
            <>
              <div className="legend-divider"></div>
              
              {/* Show instruction when in relationship creation mode */}
              {relationshipType && (
                <div className="legend-instruction">
                  <span style={{ fontSize: '10px', color: '#9333ea', fontWeight: '600' }}>
                    Click two tables to create relationship
                  </span>
                </div>
              )}
              
              <div className="legend-section-title">Identifying Relationships</div>
              
              {/* One-to-One (1:1) */}
              <div 
                className={`legend-item legend-item-clickable ${isRelationshipSelected(RELATIONSHIP_TYPES.ONE_TO_ONE_IDENTIFYING) ? 'legend-item-selected' : ''}`}
                onClick={() => handleRelationshipClick(RELATIONSHIP_TYPES.ONE_TO_ONE_IDENTIFYING)}
                title="Click to create One-to-One Identifying relationship"
              >
                <div className="legend-line-sample">
                  <svg width="30" height="12" viewBox="0 0 30 12">
                    <line x1="2" y1="6" x2="28" y2="6" stroke="var(--erd-line-color)" strokeWidth="1.5" />
                    <circle cx="4" cy="6" r="2.5" fill="var(--bg-primary)" stroke="var(--erd-line-color)" strokeWidth="1.5" />
                    <circle cx="26" cy="6" r="2.5" fill="var(--bg-primary)" stroke="var(--erd-line-color)" strokeWidth="1.5" />
                  </svg>
                </div>
                <span>One-to-One (1:1)</span>
              </div>
              
              {/* One-to-Many (1:N) */}
              <div 
                className={`legend-item legend-item-clickable ${isRelationshipSelected(RELATIONSHIP_TYPES.ONE_TO_MANY_IDENTIFYING) ? 'legend-item-selected' : ''}`}
                onClick={() => handleRelationshipClick(RELATIONSHIP_TYPES.ONE_TO_MANY_IDENTIFYING)}
                title="Click to create One-to-Many Identifying relationship"
              >
                <div className="legend-line-sample">
                  <svg width="30" height="12" viewBox="0 0 30 12">
                    <line x1="2" y1="6" x2="28" y2="6" stroke="var(--erd-line-color)" strokeWidth="1.5" />
                    <circle cx="4" cy="6" r="2.5" fill="var(--bg-primary)" stroke="var(--erd-line-color)" strokeWidth="1.5" />
                    <g>
                      <line x1="26" y1="6" x2="21" y2="6" stroke="var(--erd-line-color)" strokeWidth="1.5" />
                      <line x1="26" y1="2.5" x2="21" y2="6" stroke="var(--erd-line-color)" strokeWidth="1.5" />
                      <line x1="26" y1="9.5" x2="21" y2="6" stroke="var(--erd-line-color)" strokeWidth="1.5" />
                    </g>
                  </svg>
                </div>
                <span>One-to-Many (1:N)</span>
              </div>
              
              {/* Many-to-Many (N:M) */}
              <div 
                className={`legend-item legend-item-clickable ${isRelationshipSelected(RELATIONSHIP_TYPES.MANY_TO_MANY_IDENTIFYING) ? 'legend-item-selected' : ''}`}
                onClick={() => handleRelationshipClick(RELATIONSHIP_TYPES.MANY_TO_MANY_IDENTIFYING)}
                title="Click to create Many-to-Many Identifying relationship"
              >
                <div className="legend-line-sample">
                  <svg width="30" height="12" viewBox="0 0 30 12">
                    <line x1="2" y1="6" x2="28" y2="6" stroke="var(--erd-line-color)" strokeWidth="1.5" />
                    <g>
                      <line x1="4" y1="6" x2="9" y2="6" stroke="var(--erd-line-color)" strokeWidth="1.5" />
                      <line x1="4" y1="2.5" x2="9" y2="6" stroke="var(--erd-line-color)" strokeWidth="1.5" />
                      <line x1="4" y1="9.5" x2="9" y2="6" stroke="var(--erd-line-color)" strokeWidth="1.5" />
                    </g>
                    <g>
                      <line x1="26" y1="6" x2="21" y2="6" stroke="var(--erd-line-color)" strokeWidth="1.5" />
                      <line x1="26" y1="2.5" x2="21" y2="6" stroke="var(--erd-line-color)" strokeWidth="1.5" />
                      <line x1="26" y1="9.5" x2="21" y2="6" stroke="var(--erd-line-color)" strokeWidth="1.5" />
                    </g>
                  </svg>
                </div>
                <span>Many-to-Many (N:M)</span>
              </div>
              
              <div className="legend-divider"></div>
              <div className="legend-section-title">Non-identifying Relationships</div>
              
              {/* One-to-One (1:1) Non-identifying */}
              <div 
                className={`legend-item legend-item-clickable ${isRelationshipSelected(RELATIONSHIP_TYPES.ONE_TO_ONE_NON_IDENTIFYING) ? 'legend-item-selected' : ''}`}
                onClick={() => handleRelationshipClick(RELATIONSHIP_TYPES.ONE_TO_ONE_NON_IDENTIFYING)}
                title="Click to create One-to-One Non-Identifying relationship"
              >
                <div className="legend-line-sample">
                  <svg width="30" height="12" viewBox="0 0 30 12">
                    <line x1="2" y1="6" x2="28" y2="6" stroke="var(--erd-line-color)" strokeWidth="1.5" strokeDasharray="3,2" />
                    <circle cx="4" cy="6" r="2.5" fill="var(--bg-primary)" stroke="var(--erd-line-color)" strokeWidth="1.5" />
                    <circle cx="26" cy="6" r="2.5" fill="var(--bg-primary)" stroke="var(--erd-line-color)" strokeWidth="1.5" />
                  </svg>
                </div>
                <span>One-to-One (1:1)</span>
              </div>
              
              {/* One-to-Many (1:N) Non-identifying */}
              <div 
                className={`legend-item legend-item-clickable ${isRelationshipSelected(RELATIONSHIP_TYPES.ONE_TO_MANY_NON_IDENTIFYING) ? 'legend-item-selected' : ''}`}
                onClick={() => handleRelationshipClick(RELATIONSHIP_TYPES.ONE_TO_MANY_NON_IDENTIFYING)}
                title="Click to create One-to-Many Non-Identifying relationship"
              >
                <div className="legend-line-sample">
                  <svg width="30" height="12" viewBox="0 0 30 12">
                    <line x1="2" y1="6" x2="28" y2="6" stroke="var(--erd-line-color)" strokeWidth="1.5" strokeDasharray="3,2" />
                    <circle cx="4" cy="6" r="2.5" fill="var(--bg-primary)" stroke="var(--erd-line-color)" strokeWidth="1.5" />
                    <g>
                      <line x1="26" y1="6" x2="21" y2="6" stroke="var(--erd-line-color)" strokeWidth="1.5" />
                      <line x1="26" y1="2.5" x2="21" y2="6" stroke="var(--erd-line-color)" strokeWidth="1.5" />
                      <line x1="26" y1="9.5" x2="21" y2="6" stroke="var(--erd-line-color)" strokeWidth="1.5" />
                    </g>
                  </svg>
                </div>
                <span>One-to-Many (1:N)</span>
              </div>
            </>
          )}
        </div>
      )}
      
      {/* Help Notification */}
      {showHelpNotification && (
        <div className="relationship-help-notification">
          <div className="help-notification-content">
            {relationshipType?.cardinality === 'N:M' ? (
              <p className="help-notification-text">
                <strong>Many-to-Many Relationship:</strong><br/>
                Click two tables to connect them.<br/>
                A junction table will be created automatically.
              </p>
            ) : (
              <p className="help-notification-text">
                <strong>1st click:</strong> Child table (will receive FK)<br/>
                <strong>2nd click:</strong> Parent table (will provide PK)
              </p>
            )}
            <div className="help-notification-actions">
              <button 
                className="help-notification-btn help-notification-btn-secondary"
                onClick={handleDontShowAgain}
              >
                Don't show again
              </button>
              <button 
                className="help-notification-btn help-notification-btn-primary"
                onClick={handleCloseNotification}
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
