import React, { useState } from "react";
import styles from "../../styles/layout.module.css";

export const ResizablePanels = ({ left, right, toolbar }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const leftWidth = 280;

  const toggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
  };

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
