import { useState, useEffect, useRef } from 'react';
import { MiniMap } from '@xyflow/react';
import { FiChevronUp, FiChevronDown } from 'react-icons/fi';
import { useApp } from '../../context/AppContext';
import './DraggableMiniMap.css';

export const DraggableMiniMap = ({ nodeColor, nodeStrokeColor, nodeBorderRadius, maskColor, style }) => {
  const { isAnyModalOpen } = useApp();
  
  // Initialize from localStorage, default to OPEN (true) for first-time users
  const [isExpanded, setIsExpanded] = useState(() => {
    const saved = localStorage.getItem('reverseERD_minimapExpanded');
    return saved !== null ? saved === 'true' : true; // Default to true (open)
  });
  
  const [minimapKey, setMinimapKey] = useState(0);
  const mountCountRef = useRef(0);

  // Save to localStorage whenever state changes
  useEffect(() => {
    localStorage.setItem('reverseERD_minimapExpanded', isExpanded.toString());
  }, [isExpanded]);

  // Force minimap to remount when component mounts
  useEffect(() => {
    mountCountRef.current += 1;
    setMinimapKey(mountCountRef.current);
  }, []);

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  // Hide minimap when any modal is open
  if (isAnyModalOpen) {
    return null;
  }

  // Don't use portal - render directly in ReactFlow to maintain connection
  return (
    <div className={`static-minimap-wrapper ${isExpanded ? 'expanded' : 'collapsed'}`}>
      {/* MiniMap Content */}
      {isExpanded && (
        <div className="minimap-content-wrapper">
          <MiniMap
            key={`minimap-instance-${minimapKey}`}
            nodeColor={nodeColor}
            nodeStrokeColor={nodeStrokeColor}
            nodeBorderRadius={nodeBorderRadius}
            maskColor={maskColor}
            style={style}
            pannable
            zoomable
          />
        </div>
      )}
      
      {/* Toggle Button */}
      <button 
        className="minimap-toggle-button" 
        onClick={toggleExpanded}
      >
        {isExpanded ? (
          <>
            <FiChevronDown size={14} />
            <span className="minimap-toggle-text">Collapse Minimap</span>
          </>
        ) : (
          <>
            <FiChevronUp size={14} />
            <span className="minimap-toggle-text">Expand Minimap</span>
          </>
        )}
      </button>
    </div>
  );
};
