import React, { useState, useEffect, ReactElement } from 'react';

interface ResizablePanelsProps {
  left: ReactElement;
  right: ReactElement;
  toolbar?: ReactElement;
}

export const ResizablePanels = ({ left, right, toolbar }: ResizablePanelsProps) => {
  const isTablet = () => window.innerWidth <= 1024;
  const [isCollapsed, setIsCollapsed] = useState(isTablet());
  const leftWidth = 280;

  const toggleCollapse = () => setIsCollapsed(prev => !prev);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth <= 1024 && !isCollapsed) return;
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isCollapsed]);

  return (
    <div className="resizable-panels">
      {!isCollapsed && (
        <div className="left-panel" style={{ width: leftWidth, minWidth: 250, overflow: 'visible' }}>
          {React.cloneElement(left, { onToggleCollapse: toggleCollapse, isCollapsed })}
        </div>
      )}
      {toolbar && (
        <div className="toolbar-panel">
          {React.cloneElement(toolbar, { isCollapsed, onToggleCollapse: toggleCollapse })}
        </div>
      )}
      <div className="right-panel">
        {React.cloneElement(right, { isSchemaCollapsed: isCollapsed })}
      </div>
    </div>
  );
};
