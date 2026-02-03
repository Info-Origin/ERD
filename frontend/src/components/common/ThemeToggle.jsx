import { FiSun, FiMoon } from "react-icons/fi";
import { useTheme } from "../../context/ThemeContext";
import { IconButton } from "./IconButton";
import { THEMES } from "../../utils/constants";

export const ThemeToggle = () => {
  const { theme, toggleTheme } = useTheme();

  return (
    <IconButton
      icon={theme === THEMES.LIGHT ? FiMoon : FiSun}
      title={`Switch to ${theme === THEMES.LIGHT ? "dark" : "light"} mode`}
      onClick={toggleTheme}
    />
  );
};
