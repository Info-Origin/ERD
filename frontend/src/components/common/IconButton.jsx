import { clsx } from "clsx";
import "./IconButton.css";

export const IconButton = ({
  icon: Icon,
  title,
  onClick,
  variant = "ghost",
  size = "md",
  disabled = false,
  className,
  ...props
}) => {
  return (
    <button
      className={clsx(
        "icon-btn",
        `icon-btn-${variant}`,
        `icon-btn-${size}`,
        className,
      )}
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      {...props}
    >
      <Icon />
    </button>
  );
};
