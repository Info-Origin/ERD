import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { MiniMap } from '@xyflow/react';
import './DraggableMiniMap.css';

export const DraggableMiniMap = ({ nodeColor, nodeStrokeColor, nodeBorderRadius, maskColor, style }) => {
  const [position, setPosition] = useState(() => {
    // Try to load saved position from localStorage
    const saved = localStorage.getItem('minimap-position');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse minimap position:', e);
      }
    }
    // Default position: bottom-right (will be set via CSS initially)
    return null;
  });
  
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef(null);
  const startPosRef = useRef({ x: 0, y: 0 });

  const handleMouseDown = (e) => {
    // Only start drag if clicking on the drag handle
    if (!e.target.closest('.minimap-drag-handle')) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    // Get current position of the container
    const rect = containerRef.current.getBoundingClientRect();
    
    setIsDragging(true);
    startPosRef.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      const newX = e.clientX - startPosRef.current.x;
      const newY = e.clientY - startPosRef.current.y;
      
      // Constrain to viewport bounds
      const maxX = window.innerWidth - 240;
      const maxY = window.innerHeight - 210;
      
      const constrainedX = Math.max(10, Math.min(newX, maxX));
      const constrainedY = Math.max(70, Math.min(newY, maxY));
      
      setPosition({ x: constrainedX, y: constrainedY });
    };

    const handleMouseUp = (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      setIsDragging(false);
      
      // Save position to localStorage
      if (position) {
        localStorage.setItem('minimap-position', JSON.stringify(position));
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, position]);

  // Calculate inline style for positioning
  const positionStyle = position ? {
    position: 'fixed',
    left: `${position.x}px`,
    top: `${position.y}px`,
    right: 'auto',
    bottom: 'auto',
  } : {};

  const minimapContent = (
    <div
      ref={containerRef}
      className={`draggable-minimap-wrapper ${isDragging ? 'dragging' : ''} ${!position ? 'default-position' : ''}`}
      style={positionStyle}
      onMouseDown={handleMouseDown}
    >
      {/* Drag Handle */}
      <div className="minimap-drag-handle" title="Drag to move minimap">
        <svg 
          className="minimap-drag-icon" 
          width="16" 
          height="16" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="2"
          strokeLinecap="round" 
          strokeLinejoin="round"
        >
          <path d="M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3M2 12h20M12 2v20" />
        </svg>
      </div>
      
      {/* MiniMap Content */}
      <div className={`minimap-content-wrapper ${isDragging ? 'no-pointer' : ''}`}>
        <MiniMap
          nodeColor={nodeColor}
          nodeStrokeColor={nodeStrokeColor}
          nodeBorderRadius={nodeBorderRadius}
          maskColor={maskColor}
          style={style}
          pannable
          zoomable
        />
      </div>
    </div>
  );

  // Render using portal to escape ReactFlow's stacking context
  return createPortal(minimapContent, document.body);
};
