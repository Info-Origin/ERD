import { useState } from 'react';
import { FiRefreshCw, FiChevronDown, FiChevronRight, FiAlertTriangle, FiPlus, FiMinus, FiEdit3, FiRepeat } from 'react-icons/fi';
import { Button } from '../common/Button';
import { formatChangesForDisplay } from '../../utils/databaseChangeDetector';
import './DatabaseChangesModal.css';

export const DatabaseChangesModal = ({ 
  isOpen, 
  changes, 
  onRefresh,
  isRefreshing = false
}) => {
  const [expandedSections, setExpandedSections] = useState(new Set(['Table Changes', 'Column Changes', 'Foreign Key Changes', 'Constraints']));

  if (!isOpen || !changes) return null;

  const formattedChanges = formatChangesForDisplay(changes);
  
  if (!formattedChanges || formattedChanges.length === 0) {
    return null;
  }

  const toggleSection = (sectionTitle) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(sectionTitle)) {
      newExpanded.delete(sectionTitle);
    } else {
      newExpanded.add(sectionTitle);
    }
    setExpandedSections(newExpanded);
  };

  const totalChanges = formattedChanges.reduce((sum, section) => sum + section.count, 0);

  const getChangeIcon = (type) => {
    switch(type) {
      case 'added': return <FiPlus className="change-icon change-icon-added" />;
      case 'deleted': return <FiMinus className="change-icon change-icon-deleted" />;
      case 'renamed': return <FiRepeat className="change-icon change-icon-renamed" />;
      case 'modified': return <FiEdit3 className="change-icon change-icon-modified" />;
      default: return null;
    }
  };

  return (
    <>
      {/* Backdrop - blocks all interactions */}
      <div className="db-changes-backdrop" />
      
      {/* Modal */}
      <div className="db-changes-modal">
        {/* Header */}
        <div className="db-changes-header">
          <div className="db-changes-header-content">
            <FiAlertTriangle className="db-changes-alert-icon" />
            <div>
              <h2 className="db-changes-title">Database Changes Detected</h2>
              <p className="db-changes-subtitle">
                {totalChanges} change{totalChanges !== 1 ? 's' : ''} detected in the database schema. Refresh to stay in sync.
              </p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="db-changes-body">
          {formattedChanges.map((section) => (
            <div key={section.title} className="db-changes-section">
              <button 
                className="db-changes-section-header"
                onClick={() => toggleSection(section.title)}
              >
                {expandedSections.has(section.title) ? (
                  <FiChevronDown className="db-changes-chevron" />
                ) : (
                  <FiChevronRight className="db-changes-chevron" />
                )}
                <span className="db-changes-section-title">{section.title}</span>
                <span className="db-changes-section-count">{section.count}</span>
              </button>

              {expandedSections.has(section.title) && (
                <div className="db-changes-items">
                  {section.items.map((item, index) => (
                    <div key={index} className={`db-change-item db-change-${item.type}`}>
                      {getChangeIcon(item.type)}
                      <div className="db-change-text">
                        <span className="db-change-description">{item.description}</span>
                        {item.details && item.details.length > 0 && (
                          <div className="db-change-details">
                            {item.details.map((detail, idx) => (
                              <span key={idx} className="db-change-detail">{detail}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="db-changes-footer">
          <Button
            variant="primary"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="db-changes-refresh-btn"
          >
            {isRefreshing ? (
              <>
                <FiRefreshCw className="spinning" />
                Syncing...
              </>
            ) : (
              <>
                <FiRefreshCw />
                Refresh & Sync
              </>
            )}
          </Button>
        </div>
      </div>
    </>
  );
};
