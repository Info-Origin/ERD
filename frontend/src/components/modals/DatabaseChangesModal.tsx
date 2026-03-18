import { useState } from 'react';
import { FiRefreshCw, FiChevronDown, FiChevronRight, FiAlertTriangle, FiPlus, FiMinus, FiEdit3, FiRepeat } from 'react-icons/fi';
import { Button } from '../common/Button';
import { formatChangesForDisplay } from '../../utils/databaseChangeDetector';
import type { DetectedChanges } from '../../utils/databaseChangeDetector';
import './DatabaseChangesModal.css';

interface DatabaseChangesModalProps {
  isOpen: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  changes: DetectedChanges | any | null;
  onRefresh: () => void;
  isRefreshing?: boolean;
}

export const DatabaseChangesModal = ({ isOpen, changes, onRefresh, isRefreshing = false }: DatabaseChangesModalProps) => {
  const [expandedSections, setExpandedSections] = useState(new Set(['Table Changes', 'Column Changes', 'Foreign Key Changes', 'Constraints']));

  if (!isOpen || !changes) return null;

  const formattedChanges = formatChangesForDisplay(changes);
  if (!formattedChanges || formattedChanges.length === 0) return null;

  const toggleSection = (title: string) => {
    const next = new Set(expandedSections);
    next.has(title) ? next.delete(title) : next.add(title);
    setExpandedSections(next);
  };

  const totalChanges = formattedChanges.reduce((sum: number, s: { count: number }) => sum + s.count, 0);

  const getChangeIcon = (type: string) => {
    switch (type) {
      case 'added': return <FiPlus className="change-icon change-icon-added" />;
      case 'deleted': return <FiMinus className="change-icon change-icon-deleted" />;
      case 'renamed': return <FiRepeat className="change-icon change-icon-renamed" />;
      case 'modified': return <FiEdit3 className="change-icon change-icon-modified" />;
      default: return null;
    }
  };

  return (
    <>
      <div className="db-changes-backdrop" />
      <div className="db-changes-modal">
        <div className="db-changes-header">
          <div className="db-changes-header-content">
            <FiAlertTriangle className="db-changes-alert-icon" />
            <div>
              <h2 className="db-changes-title">Database Changes Detected</h2>
              <p className="db-changes-subtitle">{totalChanges} change{totalChanges !== 1 ? 's' : ''} detected. Refresh to stay in sync.</p>
            </div>
          </div>
        </div>
        <div className="db-changes-body">
          {formattedChanges.map((section: { title: string; count: number; items: { type: string; description: string; details?: string[] }[] }) => (
            <div key={section.title} className="db-changes-section">
              <button className="db-changes-section-header" onClick={() => toggleSection(section.title)}>
                {expandedSections.has(section.title) ? <FiChevronDown className="db-changes-chevron" /> : <FiChevronRight className="db-changes-chevron" />}
                <span className="db-changes-section-title">{section.title}</span>
                <span className="db-changes-section-count">{section.count}</span>
              </button>
              {expandedSections.has(section.title) && (
                <div className="db-changes-items">
                  {section.items.map((item, i) => (
                    <div key={i} className={`db-change-item db-change-${item.type}`}>
                      {getChangeIcon(item.type)}
                      <div className="db-change-text">
                        <span className="db-change-description">{item.description}</span>
                        {item.details && item.details.length > 0 && (
                          <div className="db-change-details">
                            {item.details.map((d, idx) => <span key={idx} className="db-change-detail">{d}</span>)}
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
        <div className="db-changes-footer">
          <Button variant="primary" onClick={onRefresh} disabled={isRefreshing} className="db-changes-refresh-btn">
            <FiRefreshCw className={isRefreshing ? 'spinning' : ''} />
            {isRefreshing ? 'Syncing...' : 'Refresh & Sync'}
          </Button>
        </div>
      </div>
    </>
  );
};
