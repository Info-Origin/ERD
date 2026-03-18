import { ReactNode, ButtonHTMLAttributes } from 'react';
import { clsx } from 'clsx';
import './Button.css';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: string;
  size?: string;
  className?: string;
}

export const Button = ({
  children,
  variant = 'primary',
  size = 'md',
  disabled = false,
  onClick,
  className,
  ...props
}: ButtonProps) => (
  <button
    className={clsx('btn', `btn-${variant}`, `btn-${size}`, className)}
    disabled={disabled}
    onClick={onClick}
    {...props}
  >
    {children}
  </button>
);
