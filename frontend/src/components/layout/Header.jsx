import { FiDatabase } from "react-icons/fi";
import { ThemeToggle } from "../common/ThemeToggle";
import "./Header.css";

export const Header = () => {
  return (
    <header className="header">
      <div className="header-left">
        <FiDatabase className="header-logo" />
        <h1 className="header-title">ReverseERD</h1>
        <span className="header-subtitle">MySQL Schema Visualizer</span>
      </div>
      <div className="header-right">
        <ThemeToggle />
      </div>
    </header>
  );
};
