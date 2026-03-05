import { useState, useEffect } from 'react';
import { FiDatabase, FiAlertCircle } from 'react-icons/fi';
import { Loader } from '../common/Loader';
import { useApp } from '../../context/AppContext';
import './LoadSchemasPrompt.css';

export const LoadSchemasPrompt = ({ onLoadSchemas }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [shouldAutoSelect, setShouldAutoSelect] = useState(false);
  const { schemas, selectSchema } = useApp();

  // Auto-select first schema after schemas are loaded
  useEffect(() => {
    if (shouldAutoSelect && schemas && schemas.length > 0) {
      selectSchema(schemas[0]);
      setShouldAutoSelect(false);
    }
  }, [schemas, shouldAutoSelect, selectSchema]);

  const handleLoadClick = async () => {
    setIsLoading(true);
    setError(null);

    try {
      await onLoadSchemas();
      // Trigger auto-select after schemas load
      setShouldAutoSelect(true);
    } catch (err) {
      setError(err.message || 'Failed to load schemas');
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

        <button 
          className="load-schemas-button" 
          onClick={handleLoadClick}
          disabled={isLoading}
        >
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
          <button 
            className="load-schemas-retry" 
            onClick={handleLoadClick}
            disabled={isLoading}
          >
            Try Again
          </button>
        )}
      </div>
    </div>
  );
};
