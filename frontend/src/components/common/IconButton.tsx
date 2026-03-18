import { ComponentType, ButtonHTMLAttributes } from 'react';
import { clsx } from 'clsx';
import './IconButton.css';

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: ComponentType<{ className?: string }>;
  title?: string;
  variant?: string;
  size?: string;
  className?: string;
}

export const IconButton = ({
  icon: Icon,
  title,
  onClick,
  variant = 'ghost',
  size = 'md',
  disabled = false,
  className,
  ...props
}: IconButtonProps) => (
  <button
    className={clsx('icon-btn', `icon-btn-${variant}`, `icon-btn-${size}`, className)}
    onClick={onClick}
    disabled={disabled}
    title={title}
    aria-label={title}
    {...props}
  >
    <Icon />
  </button>
);
