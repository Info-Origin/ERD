import React, { useState, useEffect } from "react";
import styles from "../../styles/layout.module.css";

export const ResizablePanels = ({ left, right, toolbar }) => {
  // Check if screen is tablet size (≤1024px) on initial load
  const isTablet = () => window.innerWidth <= 1024;
  const [isCollapsed, setIsCollapsed] = useState(isTablet());
  const leftWidth = 280;

  const toggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
  };

  // Listen for window resize to update collapsed state on tablet
  useEffect(() => {
    const handleResize = () => {
      // Only auto-collapse on tablet, don't auto-expand on desktop
      // This respects user's manual toggle on desktop
      if (window.innerWidth <= 1024 && !isCollapsed) {
        // Don't auto-collapse if user manually expanded on tablet
        return;
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isCollapsed]);

  return (
    <div className={styles.resizablePanels}>
      {!isCollapsed && (
        <div 
          className={styles.leftPanel} 
          style={{ 
            width: leftWidth,
            minWidth: 250,
            overflow: 'visible'
          }}
        >
          {React.cloneElement(left, { onToggleCollapse: toggleCollapse, isCollapsed })}
        </div>
      )}
      {toolbar && (
        <div className={styles.toolbarPanel}>
          {React.cloneElement(toolbar, { isCollapsed, onToggleCollapse: toggleCollapse })}
        </div>
      )}
      <div className={styles.rightPanel}>
        {React.cloneElement(right, { isSchemaCollapsed: isCollapsed })}
      </div>
    </div>
  );
};
