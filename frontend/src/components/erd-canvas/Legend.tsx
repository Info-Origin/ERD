import { useState, useEffect } from "react";
import { Badge } from "../common/Badge";
import { BADGE_VARIANTS } from "../../utils/constants";
import { useApp } from "../../context/AppContext";
import "./Legend.css";

interface LegendProps {
  isInHeader?: boolean;
  forceExpanded?: boolean;
}

export const Legend = ({ isInHeader = false, forceExpanded = false }: LegendProps) => {
  const { crowsFootMode } = useApp();

  const [isExpanded, setIsExpanded] = useState(() => {
    const saved = localStorage.getItem('reverseERD_legendExpanded');
    return saved !== null ? saved === 'true' : true;
  });

  useEffect(() => {
    localStorage.setItem('reverseERD_legendExpanded', isExpanded.toString());
  }, [isExpanded]);

  useEffect(() => {
    if (forceExpanded) setIsExpanded(true);
  }, [forceExpanded]);

  const toggleExpanded = () => setIsExpanded(!isExpanded);

  return (
    <div className={`erd-legend ${isExpanded ? 'expanded' : 'collapsed'} ${isInHeader ? 'in-header' : ''}`}>
      <div className="legend-header" onClick={toggleExpanded}>
        <div className="legend-title">LEGEND</div>
        <button className="legend-toggle" aria-label={isExpanded ? 'Collapse legend' : 'Expand legend'} type="button">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
            <path d={isExpanded ? "M2 8 L6 4 L10 8" : "M2 4 L6 8 L10 4"} stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      {isExpanded && (
        <div className="legend-items">
          <div className="legend-item"><Badge variant={BADGE_VARIANTS.PK}>PK</Badge><span>Primary Key</span></div>
          <div className="legend-item"><Badge variant={BADGE_VARIANTS.COMPOSITE_KEY}>CK</Badge><span>Composite Key</span></div>
          <div className="legend-item"><Badge variant={BADGE_VARIANTS.FK}>FK</Badge><span>Foreign Key</span></div>
          <div className="legend-item"><Badge variant={BADGE_VARIANTS.UNIQUE}>UQ</Badge><span>Unique</span></div>
          <div className="legend-item"><Badge variant={BADGE_VARIANTS.NOT_NULL}>NN</Badge><span>Not Null</span></div>
          <div className="legend-item"><Badge variant={BADGE_VARIANTS.AUTO_INCREMENT}>AI</Badge><span>Auto Increment</span></div>

          <div className="legend-divider"></div>
          <div className="legend-section-title">Visual Indicator's</div>

          <div className="legend-item">
            <div className="legend-table-sample" style={{ border: '2px solid #ef4444', boxShadow: '0 0 0 2px rgba(239, 68, 68, 0.2)' }}></div>
            <span>Circular Dependency</span>
          </div>
          <div className="legend-item">
            <div className="legend-table-sample" style={{ border: '2px solid #9333ea', boxShadow: '0 0 0 2px rgba(147, 51, 234, 0.15)' }}></div>
            <span>Junction Table (N:M)</span>
          </div>
          <div className="legend-item">
            <div className="legend-table-sample" style={{ border: '2px solid #14b8a6', boxShadow: '0 0 0 2px rgba(20, 184, 166, 0.2)' }}></div>
            <span>Root Parent Table</span>
          </div>
          <div className="legend-item">
            <div className="legend-line-sample">
              <svg width="30" height="12" viewBox="0 0 30 12">
                <line x1="2" y1="6" x2="28" y2="6" stroke="#2c3e50" strokeWidth="2" />
              </svg>
            </div>
            <span>Database FK</span>
          </div>
          <div className="legend-item">
            <div className="legend-line-sample">
              <svg width="30" height="12" viewBox="0 0 30 12">
                <line x1="2" y1="6" x2="28" y2="6" stroke="#3b82f6" strokeWidth="2" />
              </svg>
            </div>
            <span>User Created FK</span>
          </div>

          {crowsFootMode && (
            <>
              <div className="legend-divider"></div>
              <div className="legend-section-title">Identifying Relationships</div>
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
            </>
          )}
        </div>
      )}
    </div>
  );
};
