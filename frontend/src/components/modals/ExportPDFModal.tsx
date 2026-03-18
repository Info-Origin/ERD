import { useState } from 'react';
import { useApp } from '../../context/AppContext';
import './Modal.css';
import './ExportPDFModal.css';

interface ExportOptions { quality: string; format: string; }
interface ExportPDFModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExport: (options: ExportOptions, onProgress: (progress: number, step: string) => void) => Promise<void>;
  schemaName?: string;
}

export const ExportPDFModal = ({ isOpen, onClose, onExport, schemaName }: ExportPDFModalProps) => {
  const { showNotification, erdData } = useApp();
  const [exportOptions, setExportOptions] = useState<ExportOptions>({ quality: 'high', format: 'pdf' });
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportStep, setExportStep] = useState('');

  const tableCount = erdData?.tables ? Object.keys(erdData.tables).length : 0;

  if (!isOpen) return null;

  const handleExport = async () => {
    setIsExporting(true); setExportProgress(0); setExportStep('Preparing diagram...');
    try {
      await onExport(exportOptions, (progress, step) => { setExportProgress(progress); setExportStep(step); });
      showNotification('ERD exported successfully!', 'success');
      setTimeout(() => { setIsExporting(false); setExportProgress(0); setExportStep(''); onClose(); }, 500);
    } catch (error) {
      const msg = (error as Error).message;
      let errorMessage = 'Export failed. ';
      if (msg.includes('Failed to fetch')) errorMessage += 'Cannot connect to server.';
      else if (msg.includes('React Flow instance')) errorMessage += 'Diagram not ready. Please try again.';
      else errorMessage += msg;
      showNotification(errorMessage, 'error');
      setIsExporting(false); setExportProgress(0); setExportStep('');
    }
  };

  return (
    <div className="modal-overlay" onClick={!isExporting ? onClose : undefined}>
      <div className="modal-content export-pdf-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Export ERD Diagram</h2>
          {!isExporting && <button className="modal-close" onClick={onClose}>×</button>}
        </div>
        <div className="modal-body">
          {!isExporting ? (
            <>
              <div className="export-option-group">
                <label className="export-label">Image Quality</label>
                <select className="export-select" value={exportOptions.quality} onChange={e => setExportOptions({ ...exportOptions, quality: e.target.value })}>
                  <option value="low">Low - Fast export, smaller file</option>
                  <option value="medium">Medium - Balanced quality</option>
                  <option value="high">High - Best quality (Recommended)</option>
                  <option value="ultra">Ultra - Maximum quality, slower</option>
                </select>
              </div>
              <div className="export-info">
                <p><strong>Schema:</strong> {schemaName || 'Unknown'}</p>
                <p><strong>Tables:</strong> {tableCount}</p>
              </div>
              {tableCount >= 100 && (
                <div className="export-warning">
                  <div className="export-warning-icon">⚠️</div>
                  <div className="export-warning-content">
                    <strong>Large Diagram Detected ({tableCount} tables)</strong>
                    <p>Export may take 30-60 seconds.</p>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="export-progress">
              <div className="export-progress-bar"><div className="export-progress-fill" style={{ width: `${exportProgress}%` }} /></div>
              <p className="export-progress-text">{exportStep}</p>
              <p className="export-progress-percent">{exportProgress}%</p>
            </div>
          )}
        </div>
        {!isExporting && (
          <div className="modal-footer">
            <button className="modal-button modal-button-secondary" onClick={onClose}>Cancel</button>
            <button className="modal-button modal-button-primary" onClick={handleExport}>Export</button>
          </div>
        )}
      </div>
    </div>
  );
};
