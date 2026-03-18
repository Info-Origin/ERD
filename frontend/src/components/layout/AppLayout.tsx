import { ReactNode } from 'react';
import { Header } from './Header';

interface AppLayoutProps { children: ReactNode; }

export const AppLayout = ({ children }: AppLayoutProps) => (
  <div className="app-layout">
    <Header />
    <main className="main-content">{children}</main>
  </div>
);
