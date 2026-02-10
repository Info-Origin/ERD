import { useState } from "react";
import { Badge } from "../common/Badge";
import { BADGE_VARIANTS } from "../../utils/constants";
import { useApp } from "../../context/AppContext";
import "./Legend.css";

export const Legend = ({ isInHeader = false }) => {
  const { crowsFootMode } = useApp();
  const [isExpanded, setIsExpanded] = useState(false);

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
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
            <path d={isExpanded ? "M2 4 L6 8 L10 4" : "M4 2 L8 6 L4 10"} stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
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
              <div className="legend-section-title">Identifying Relationships</div>
              
              {/* One-to-One (1:1) */}
              <div className="legend-item">
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
              <div className="legend-item">
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
              <div className="legend-item">
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
              <div className="legend-item">
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
              <div className="legend-item">
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
              
              {/* Many-to-Many (N:M) Non-identifying */}
              <div className="legend-item">
                <div className="legend-line-sample">
                  <svg width="30" height="12" viewBox="0 0 30 12">
                    <line x1="2" y1="6" x2="28" y2="6" stroke="var(--erd-line-color)" strokeWidth="1.5" strokeDasharray="3,2" />
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
            </>
          )}
        </div>
      )}
    </div>
  );
};
