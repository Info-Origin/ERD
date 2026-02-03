import React, { useState, useRef, useEffect } from "react";
import { STORAGE_KEYS } from "../../utils/constants";
import styles from "../../styles/layout.module.css";

export const ResizablePanels = ({ left, right }) => {
  const [leftWidth, setLeftWidth] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.PANEL_WIDTH);
    return saved ? Math.max(350, parseInt(saved, 10)) : 350; // Both minimum and default are 350px
  });
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef(null);

  // Force minimum width on mount if current width is too small
  useEffect(() => {
    if (leftWidth < 350) {
      setLeftWidth(350);
    }
  }, []);

  const toggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
  };

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.PANEL_WIDTH, leftWidth.toString());
  }, [leftWidth]);

  const handleMouseDown = () => {
    setIsDragging(true);
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDragging || !containerRef.current) return;

      const containerRect = containerRef.current.getBoundingClientRect();
      const newWidth = e.clientX - containerRect.left;

      // Constrain between 350px and 600px (reduced minimum since we removed extra buttons)
      const clampedWidth = Math.max(350, Math.min(600, newWidth));
      setLeftWidth(clampedWidth);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging]);

  return (
    <div className={styles.resizablePanels} ref={containerRef}>
      <div 
        className={styles.leftPanel} 
        style={{ 
          width: isCollapsed ? 48 : leftWidth,
          minWidth: isCollapsed ? 48 : 350,
          overflow: isCollapsed ? 'visible' : 'visible'
        }}
      >
        {React.cloneElement(left, { onToggleCollapse: toggleCollapse, isCollapsed })}
      </div>
      {!isCollapsed && (
        <div
          className={styles.resizeHandle}
          onMouseDown={handleMouseDown}
          style={{ cursor: isDragging ? "col-resize" : "col-resize" }}
        />
      )}
      <div className={styles.rightPanel}>
        {React.cloneElement(right, { isSchemaCollapsed: isCollapsed })}
      </div>
    </div>
  );
};
