import { useState, useRef, useEffect } from 'react';
import { FiChevronDown } from 'react-icons/fi';
import { useApp } from '../../context/AppContext';
import type { ApplicationOption } from '../../types';
import './AppDropdown.css';

const dropdownItems: ApplicationOption[] = [
  { uuid: 'f487663908ebf11eabb6112c1e641f7d9', label: 'Info QA (dev)' },
  { uuid: 'zb9952b18945111eabb611c1e641f7d9', label: 'Staffing Origin (dev)' },
];

export const AppDropdown = () => {
  const { selectedApplication, setSelectedApplication, reloadSchemasForApplication } = useApp();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const timeoutId = setTimeout(() => document.addEventListener('click', handleClickOutside), 0);
    return () => { clearTimeout(timeoutId); document.removeEventListener('click', handleClickOutside); };
  }, [isOpen]);

  const handleItemClick = async (app: ApplicationOption) => {
    setSelectedApplication(app);
    setIsOpen(false);
    await reloadSchemasForApplication(app.uuid);
  };

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
              <button key={index} className="app-dropdown-item" onClick={() => handleItemClick(item)}>
                {item.label}
              </button>
            ))}
        </div>
      )}
    </div>
  );
};
