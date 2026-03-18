import { useState, useEffect, useRef } from 'react';
import { MiniMap } from '@xyflow/react';
import { FiChevronUp, FiChevronDown } from 'react-icons/fi';
import { useApp } from '../../context/AppContext';
import './DraggableMiniMap.css';

interface DraggableMiniMapProps {
  nodeColor?: (node: { data?: { isSelected?: boolean; isHighlighted?: boolean } }) => string;
  nodeStrokeColor?: (node: { data?: { isSelected?: boolean; isHighlighted?: boolean } }) => string;
  nodeBorderRadius?: number;
  maskColor?: string;
  style?: React.CSSProperties;
}

export const DraggableMiniMap = ({
  nodeColor,
  nodeStrokeColor,
  nodeBorderRadius,
  maskColor,
  style,
}: DraggableMiniMapProps) => {
  const { isAnyModalOpen } = useApp();

  const [isExpanded, setIsExpanded] = useState(() => {
    const saved = localStorage.getItem('reverseERD_minimapExpanded');
    return saved !== null ? saved === 'true' : true;
  });

  const [minimapKey, setMinimapKey] = useState(0);
  const mountCountRef = useRef(0);

  useEffect(() => {
    localStorage.setItem('reverseERD_minimapExpanded', isExpanded.toString());
  }, [isExpanded]);

  useEffect(() => {
    mountCountRef.current += 1;
    setMinimapKey(mountCountRef.current);
  }, []);

  const toggleExpanded = () => setIsExpanded(!isExpanded);

  if (isAnyModalOpen) return null;

  return (
    <div className={`static-minimap-wrapper ${isExpanded ? 'expanded' : 'collapsed'}`}>
      {isExpanded && (
        <div className="minimap-content-wrapper">
          <MiniMap
            key={`minimap-instance-${minimapKey}`}
            nodeColor={nodeColor as ((node: Parameters<typeof MiniMap>[0]['nodeColor'] extends ((n: infer N) => string) | undefined ? N : never) => string) | undefined}
            nodeStrokeColor={nodeStrokeColor as ((node: Parameters<typeof MiniMap>[0]['nodeStrokeColor'] extends ((n: infer N) => string) | undefined ? N : never) => string) | undefined}
            nodeBorderRadius={nodeBorderRadius}
            maskColor={maskColor}
            style={style}
            pannable
            zoomable
          />
        </div>
      )}
      <button className="minimap-toggle-button" onClick={toggleExpanded}>
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
