import { FiDatabase } from 'react-icons/fi';
import { ThemeToggle } from '../common/ThemeToggle';
import { AppDropdown } from '../common/AppDropdown';
import './Header.css';

export const Header = () => (
  <header className="header">
    <div className="header-left">
      <FiDatabase className="header-logo" />
      <h1 className="header-title">InfoERD</h1>
      <span className="header-subtitle">MySQL Schema Visualizer</span>
    </div>
    <div className="header-right">
      <AppDropdown />
      <ThemeToggle />
    </div>
  </header>
);
