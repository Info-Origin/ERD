import { useState, useRef, useEffect } from 'react';
import { FiChevronDown } from 'react-icons/fi';
import './AppDropdown.css';

export const AppDropdown = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedApp, setSelectedApp] = useState('Info QA (dev)'); // Default to first app
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleItemClick = (url, label) => {
    console.log(`Navigating to: ${label} - ${url}`);
    setSelectedApp(label); // Update selected app name
    setIsOpen(false); // Close dropdown after selection
    // You can add actual navigation logic here
    // For now, just open in new tab
    window.open(url, '_blank');
  };

  const dropdownItems = [
    { label: 'Info QA (dev)', url: '/info-qa-dev' },
    { label: 'Staffing Origin (dev)', url: '/staffing-origin-dev' },
    { label: 'Handson App', url: '/handson-app' },
    { label: 'Infoorigin Home', url: '/infoorigin-home' },
    { label: 'App Builder', url: '/app-builder' }
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