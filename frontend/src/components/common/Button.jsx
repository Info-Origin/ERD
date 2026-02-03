import { clsx } from "clsx";
import "./Button.css";

export const Button = ({
  children,
  variant = "primary",
  size = "md",
  disabled = false,
  onClick,
  className,
  ...props
}) => {
  return (
    <button
      className={clsx("btn", `btn-${variant}`, `btn-${size}`, className)}
      disabled={disabled}
      onClick={onClick}
      {...props}
    >
      {children}
    </button>
  );
};
