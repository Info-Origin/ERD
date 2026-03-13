import { useState, useRef, useEffect } from 'react';
import { FiChevronDown } from 'react-icons/fi';
import { useApp } from '../../context/AppContext';
import './AppDropdown.css';

export const AppDropdown = () => {
  const { selectedApplication, setSelectedApplication, reloadSchemasForApplication } = useApp();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    // Use setTimeout to avoid immediate closure
    const timeoutId = setTimeout(() => {
      document.addEventListener('click', handleClickOutside);
    }, 0);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('click', handleClickOutside);
    };
  }, [isOpen]);

  const handleItemClick = async (app) => {
    console.log(`Switching to application: ${app.label}`);
    setSelectedApplication(app);
    setIsOpen(false);
    
    // Reload schemas for the selected application
    await reloadSchemasForApplication(app.uuid);
  };

  const dropdownItems = [
    { 
      uuid: 'f487663908ebf11eabb6112c1e641f7d9',
      label: 'Info QA (dev)'
    },
    { 
      uuid: 'zb9952b18945111eabb611c1e641f7d9',
      label: 'Staffing Origin (dev)'
    },
    { 
      uuid: '6dd8278a-963c-453d-84c5-eca06c4ff221',
      label: 'Handson App'
    },
    { 
      uuid: '20d01c24-a07b-11ed-8438-f7be46f306d0',
      label: 'Infoorigin Home'
    },
    { 
      uuid: 'bfb59e2-4927-11ed-be6d-0a68df95ca6d',
      label: 'App Builder'
    }
  ];

  return (
    <div className={`app-dropdown ${isOpen ? 'open' : ''}`} ref={dropdownRef}>
      <button 
        className="app-dropdown-trigger"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <span>{selectedApplication?.label || 'Info QA (dev)'}</span>
        <FiChevronDown className={`dropdown-icon ${isOpen ? 'rotated' : ''}`} />
      </button>
      
      {isOpen && (
        <div className="app-dropdown-menu">
          {dropdownItems
            .filter(item => item.uuid !== selectedApplication?.uuid)
            .map((item, index) => (
              <button
                key={index}
                className="app-dropdown-item"
                onClick={() => handleItemClick(item)}
              >
                {item.label}
              </button>
            ))}
        </div>
      )}
    </div>
  );
};
