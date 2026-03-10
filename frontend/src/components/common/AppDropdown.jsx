import { useState, useRef, useEffect } from 'react';
import { FiChevronDown } from 'react-icons/fi';
import './AppDropdown.css';

export const AppDropdown = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedApp, setSelectedApp] = useState('Info QA (dev)');
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

  const handleItemClick = (url, label) => {
    console.log(`Navigating to: ${label} - ${url}`);
    setSelectedApp(label);
    setIsOpen(false);
    window.open(url, '_blank');
  };

  const dropdownItems = [
    { label: 'Info QA (dev)'},
    { label: 'Staffing Origin (dev)'},
    { label: 'Handson App'},
    { label: 'Infoorigin Home'},
    { label: 'App Builder'}
  ];

  return (
    <div className={`app-dropdown ${isOpen ? 'open' : ''}`} ref={dropdownRef}>
      <button 
        className="app-dropdown-trigger"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <span>{selectedApp}</span>
        <FiChevronDown className={`dropdown-icon ${isOpen ? 'rotated' : ''}`} />
      </button>
      
      {isOpen && (
        <div className="app-dropdown-menu">
          {dropdownItems
            .filter(item => item.label !== selectedApp)
            .map((item, index) => (
              <button
                key={index}
                className="app-dropdown-item"
                onClick={() => handleItemClick(item.url, item.label)}
              >
                {item.label}
              </button>
            ))}
        </div>
      )}
    </div>
  );
};
