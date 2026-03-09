import { useState } from 'react';
import { useApp } from '../../context/AppContext';
import './Modal.css';
import './ExportPDFModal.css';

export const ExportPDFModal = ({ isOpen, onClose, onExport, schemaName }) => {
  const { showNotification, erdData } = useApp();
  const [exportOptions, setExportOptions] = useState({
    quality: 'high',
    format: 'pdf'
  });

  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportStep, setExportStep] = useState('');

  // Calculate table count for warning
  const tableCount = erdData?.tables ? Object.keys(erdData.tables).length : 0;
  const showLargeDiagramWarning = tableCount >= 100;

  if (!isOpen) return null;

  const handleExport = async () => {
    setIsExporting(true);
    setExportProgress(0);
    setExportStep('Preparing diagram...');

    try {
      await onExport(exportOptions, (progress, step) => {
        setExportProgress(progress);
        setExportStep(step);
      });
      
      // Success - show notification and close modal
      showNotification('ERD exported successfully!', 'success');
      
      setTimeout(() => {
        setIsExporting(false);
        setExportProgress(0);
        setExportStep('');
        onClose();
      }, 500);
    } catch (error) {
      console.error('Export failed:', error);
      
      // Show detailed error message
      let errorMessage = 'Export failed. ';
      if (error.message.includes('Failed to fetch')) {
        errorMessage += 'Cannot connect to server. Please ensure the backend is running on port 4000.';
      } else if (error.message.includes('React Flow instance')) {
        errorMessage += 'Diagram not ready. Please try again.';
      } else {
        errorMessage += error.message;
      }
      
      showNotification(errorMessage, 'error');
      
      setIsExporting(false);
      setExportProgress(0);
      setExportStep('');
    }
  };

  const handleCancel = () => {
    if (!isExporting) {
      onClose();
    }
  };

  return (
    <div className="modal-overlay" onClick={handleCancel}>
      <div className="modal-content export-pdf-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Export ERD Diagram</h2>
          {!isExporting && (
            <button className="modal-close" onClick={handleCancel} disabled={isExporting}>
              ×
            </button>
          )}
        </div>

        <div className="modal-body">
          {!isExporting ? (
            <>
              {/* Quality */}
              <div className="export-option-group">
                <label className="export-label">Image Quality</label>
                <select
                  id="export-quality"
                  name="export-quality"
                  className="export-select"
                  value={exportOptions.quality}
                  onChange={(e) => setExportOptions({ ...exportOptions, quality: e.target.value })}
                >
                  <option value="low">Low - Fast export, smaller file</option>
                  <option value="medium">Medium - Balanced quality</option>
                  <option value="high">High - Best quality (Recommended)</option>
                  <option value="ultra">Ultra - Maximum quality, slower</option>
                </select>
              </div>

              {/* Info */}
              <div className="export-info">
                <p>
                  <strong>Schema:</strong> {schemaName || 'Unknown'}
                </p>
                <p>
                  <strong>Tables:</strong> {tableCount}
                </p>
              </div>

              {/* Warning for large diagrams */}
              {showLargeDiagramWarning && (
                <div className="export-warning">
                  <div className="export-warning-icon">⚠️</div>
                  <div className="export-warning-content">
                    <strong>Large Diagram Detected ({tableCount} tables)</strong>
                    <p>
                      Export may take 30-60 seconds. If browser alert shows, please click Wait button to allow the export to complete.
                    </p>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="export-progress">
              <div className="export-progress-bar">
                <div 
                  className="export-progress-fill" 
                  style={{ width: `${exportProgress}%` }}
                />
              </div>
              <p className="export-progress-text">{exportStep}</p>
              <p className="export-progress-percent">{exportProgress}%</p>
            </div>
          )}
        </div>

        {!isExporting && (
          <div className="modal-footer">
            <button 
              className="modal-button modal-button-secondary" 
              onClick={handleCancel}
              disabled={isExporting}
            >
              Cancel
            </button>
            <button 
              className="modal-button modal-button-primary" 
              onClick={handleExport}
              disabled={isExporting}
            >
              Export
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
