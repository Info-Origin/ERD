import { useState } from 'react';
import { FiDatabase, FiAlertCircle } from 'react-icons/fi';
import { Loader } from '../common/Loader';
import './LoadSchemasPrompt.css';

interface LoadSchemasPromptProps {
  onLoadSchemas: () => Promise<void>;
}

export const LoadSchemasPrompt = ({ onLoadSchemas }: LoadSchemasPromptProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLoadClick = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await onLoadSchemas();
    } catch (err) {
      setError((err as Error).message || 'Failed to load schemas');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="load-schemas-prompt">
      <div className="load-schemas-card">
        <FiDatabase className="load-schemas-icon" />
        <h2 className="load-schemas-title">Load Database Schemas</h2>
        <p className="load-schemas-description">
          Click the button below to fetch all schemas from your database and start visualizing your ERD.
        </p>

        {error && (
          <div className="load-schemas-error">
            <FiAlertCircle />
            <span>{error}</span>
          </div>
        )}

        <button className="load-schemas-button" onClick={handleLoadClick} disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader size="small" />
              <span>Loading Schemas...</span>
            </>
          ) : (
            <>
              <FiDatabase />
              <span>Load Schemas</span>
            </>
          )}
        </button>

        {error && (
          <button className="load-schemas-retry" onClick={handleLoadClick} disabled={isLoading}>
            Try Again
          </button>
        )}
      </div>
    </div>
  );
};
