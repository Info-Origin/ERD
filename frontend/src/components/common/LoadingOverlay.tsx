import './LoadingOverlay.css';

interface LoadingOverlayProps {
  current?: number;
  total?: number;
}

export const LoadingOverlay = ({ current = 0, total = 0 }: LoadingOverlayProps) => {
  const percent = total > 0 ? Math.round((current / total) * 100) : 0;
  return (
    <div className="loading-overlay">
      <div className="loading-overlay-card">
        <div className="loading-overlay-spinner" />
        <h3 className="loading-overlay-title">Loading Schemas</h3>
        <p className="loading-overlay-subtitle">Fetching data from database, please wait...</p>
        {total > 0 && (
          <>
            <div className="loading-overlay-progress-bar">
              <div className="loading-overlay-progress-fill" style={{ width: `${percent}%` }} />
            </div>
            <p className="loading-overlay-count">{current} / {total} schemas loaded ({percent}%)</p>
          </>
        )}
      </div>
    </div>
  );
};
