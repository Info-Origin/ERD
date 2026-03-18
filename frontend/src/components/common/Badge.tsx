import { ReactNode } from 'react';
import { clsx } from 'clsx';
import './Badge.css';

interface BadgeProps {
  children: ReactNode;
  variant?: string;
  className?: string;
  title?: string;
  onClick?: (e: React.MouseEvent) => void;
}

export const Badge = ({ children, variant = 'default', className, title, onClick }: BadgeProps) => (
  <span className={clsx('badge', `badge-${variant}`, className)} title={title} onClick={onClick}>{children}</span>
);
