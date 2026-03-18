import { FiSearch, FiX } from "react-icons/fi";
import "./SearchBar.css";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export const SearchBar = ({
  value,
  onChange,
  placeholder = "Search schemas and tables...",
}: SearchBarProps) => {
  const handleClear = () => {
    onChange("");
  };

  return (
    <div className="search-bar">
      <FiSearch className="search-icon" />
      <input
        id="schema-search"
        name="schema-search"
        type="text"
        className="search-input"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {value && (
        <button
          className="search-clear"
          onClick={handleClear}
          aria-label="Clear search"
        >
          <FiX />
        </button>
      )}
    </div>
  );
};
