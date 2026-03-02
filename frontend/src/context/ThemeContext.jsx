import { createContext, useContext, useState, useEffect } from "react";
import { THEMES } from "../utils/constants";

const ThemeContext = createContext();

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
};

// Cookie helper functions
const getCookie = (name) => {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
  return null;
};

const setCookie = (name, value, days) => {
  const maxAge = days * 24 * 60 * 60; // Convert days to seconds
  document.cookie = `${name}=${value}; max-age=${maxAge}; path=/; SameSite=Lax`;
};

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(() => {
    // Check cookie first
    const saved = getCookie('theme');
    if (saved) return saved;

    // Check system preference
    if (
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches
    ) {
      return THEMES.DARK;
    }

    return THEMES.LIGHT;
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    // Save to cookie with 400-day expiry
    setCookie('theme', theme, 400);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === THEMES.LIGHT ? THEMES.DARK : THEMES.LIGHT));
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};
