import React, { useState } from "react";
import styles from "../../styles/layout.module.css";

export const ResizablePanels = ({ left, right }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const leftWidth = 280; // Reduced from 350px to 250px

  const toggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
  };

  return (
    <div className={styles.resizablePanels}>
      <div 
        className={styles.leftPanel} 
        style={{ 
          width: isCollapsed ? 48 : leftWidth,
          minWidth: isCollapsed ? 48 : 250, // Updated min-width
          overflow: isCollapsed ? 'visible' : 'visible'
        }}
      >
        {React.cloneElement(left, { onToggleCollapse: toggleCollapse, isCollapsed })}
      </div>
      <div className={styles.rightPanel}>
        {React.cloneElement(right, { isSchemaCollapsed: isCollapsed })}
      </div>
    </div>
  );
};
