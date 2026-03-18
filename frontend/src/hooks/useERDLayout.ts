import { useCallback, useState, useEffect, useRef } from 'react';
import { applyNodeChanges, applyEdgeChanges } from '@xyflow/react';
import type { Node, Edge, NodeChange, EdgeChange } from '@xyflow/react';
import { useApp } from '../context/AppContext';
import { useVirtualSchema } from '../context/VirtualSchemaContext';
import { useDebounce } from './useDebounce';
import { distributeRelationshipPorts } from '../utils/smartPortDistribution';
import { generateHandleId } from '../utils/smartPortDistribution';
import { calculateHybridLayout } from '../utils/hybridLayoutEngine';
import { bundleRelationships } from '../utils/relationshipBundler';
import type { ERDData, Relationship, HighlightedColumnInfo } from '../types';

interface VirtualNMRelationship extends Omit<Relationship, 'fromColumn' | 'toColumn'> {
  fromColumn: string | null;
  toColumn: string | null;
  isVirtualNM: boolean;
  junctionTable: string;
}

export const useERDLayout = (
  erdData: ERDData | null,
  selectedTable: string | null,
  filteredTables: string[] | null = null,
  highlightedTable: string | null = null,
  highlightedColumn: HighlightedColumnInfo | null = null,
  layoutResetKey = 0
) => {
  const { tablePositions, updateTablePosition } = useVirtualSchema();

  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [layoutError, setLayoutError] = useState<string | null>(null);
  const isCalculatingRef = useRef(false);
  const [pendingPositionUpdates, setPendingPositionUpdates] = useState<Record<string, { x: number; y: number }>>({});
  const debouncedPositionUpdates = useDebounce(pendingPositionUpdates, 300);

  useEffect(() => {
    if (Object.keys(debouncedPositionUpdates).length > 0) {
      Object.entries(debouncedPositionUpdates).forEach(([nodeId, position]) => {
        updateTablePosition(nodeId, position);
      });
      setPendingPositionUpdates({});
    }
  }, [debouncedPositionUpdates, updateTablePosition]);

  const buildEdgesFromRelationships = useCallback(
    (
      allRelationshipsForDistribution: (Relationship | VirtualNMRelationship)[],
      currentNodes: Node[]
    ): Edge[] => {
      const distributedRelationships = distributeRelationshipPorts(
        allRelationshipsForDistribution as Relationship[],
        currentNodes
      );

      const distributedRegularRels = distributedRelationships.filter((rel) => !(rel as unknown as { isVirtualNM?: boolean }).isVirtualNM);
      const distributedNMRels = distributedRelationships.filter((rel) => (rel as unknown as { isVirtualNM?: boolean }).isVirtualNM);

      const uniqueEdges: Edge[] = [];
      const seenIds = new Set<string>();

      distributedRegularRels.forEach((rel) => {
        const visualSource = rel.toTable;
        const visualTarget = rel.fromTable;
        const sourceHandle = generateHandleId(visualSource, rel.targetSide, rel.targetPortIndex, 'source');
        const targetHandle = generateHandleId(visualTarget, rel.sourceSide, rel.sourcePortIndex, 'target');
        const edgeId = rel.isBundled
          ? `db-rel-bundle-${rel.fromTable}-${rel.toTable}-${rel.cardinalityType}-${rel.isIdentifying}`
          : `db-rel-${rel.fromTable}.${rel.fromColumn}->${rel.toTable}.${rel.toColumn}`;

        if (!seenIds.has(edgeId)) {
          seenIds.add(edgeId);
          uniqueEdges.push({
            id: edgeId, source: visualSource, target: visualTarget,
            sourceHandle, targetHandle, type: 'relationship',
            data: {
              fromTable: rel.fromTable, fromColumn: rel.fromColumn,
              toTable: rel.toTable, toColumn: rel.toColumn,
              relationType: rel.type || 'ONE_TO_MANY', type: rel.type || 'ONE_TO_MANY',
              cardinalityType: rel.cardinalityType || '1:N',
              constraintName: rel.constraintName,
              isUserCreated: rel.isUserCreated || false,
              isIdentifying: rel.isIdentifying, isUnique: rel.isUnique,
              isJunctionTable: rel.isJunctionTable,
              sourceSide: rel.sourceSide, targetSide: rel.targetSide,
              sourcePortIndex: rel.sourcePortIndex, targetPortIndex: rel.targetPortIndex,
              isBundled: rel.isBundled || false,
              bundledRelationships: rel.bundledRelationships || [rel],
              bundleCount: rel.bundleCount || 1,
            },
          });
        }
      });

      distributedNMRels.forEach((rel) => {
        const [table1, table2] = [rel.fromTable, rel.toTable].sort();
        const nmEdgeId = `virtual-nm-${table1}-${table2}-via-${(rel as unknown as { junctionTable: string }).junctionTable}`;
        const sourceHandle = generateHandleId(rel.fromTable, rel.sourceSide, rel.sourcePortIndex, 'source');
        const targetHandle = generateHandleId(rel.toTable, rel.targetSide, rel.targetPortIndex, 'target');

        if (!seenIds.has(nmEdgeId)) {
          seenIds.add(nmEdgeId);
          uniqueEdges.push({
            id: nmEdgeId, source: rel.fromTable, target: rel.toTable,
            sourceHandle, targetHandle, type: 'relationship',
            data: {
              fromTable: rel.fromTable, fromColumn: null,
              toTable: rel.toTable, toColumn: null,
              relationType: 'MANY_TO_MANY', type: 'MANY_TO_MANY', cardinalityType: 'N:M',
              isUserCreated: rel.isUserCreated || false, isIdentifying: false,
              isVirtualNM: true, junctionTable: (rel as unknown as { junctionTable: string }).junctionTable,
              sourceSide: rel.sourceSide, targetSide: rel.targetSide,
              sourcePortIndex: rel.sourcePortIndex, targetPortIndex: rel.targetPortIndex,
            },
          });
        }
      });

      return uniqueEdges;
    },
    []
  );

  const detectJunctionTables = useCallback(
    (schemaFilteredRelationships: Relationship[], visibleTableNames: Set<string>): VirtualNMRelationship[] => {
      const junctionTables = new Map<string, [string, string]>();

      Object.entries(erdData?.tables || {}).forEach(([tableName, tableData]) => {
        const columns = Object.values(tableData.columns || {});
        const pkColumns = columns.filter((col) => col.pk);
        const fkColumns = columns.filter((col) => col.fk);
        if (fkColumns.length === 2 && pkColumns.length === 2 && fkColumns[0].pk && fkColumns[1].pk) {
          const rels = schemaFilteredRelationships.filter((rel) => rel.fromTable === tableName);
          if (rels.length === 2) junctionTables.set(tableName, [rels[0].toTable, rels[1].toTable]);
        }
      });

      const virtualNMRelationships: VirtualNMRelationship[] = [];
      junctionTables.forEach(([table1, table2], junctionTable) => {
        if (visibleTableNames.has(table1) && visibleTableNames.has(table2)) {
          const junctionFKs = schemaFilteredRelationships.filter((rel) => rel.fromTable === junctionTable);
          const isUserCreatedJunction = junctionFKs.some((fk) => fk.isUserCreated);
          virtualNMRelationships.push({
            fromTable: table1, toTable: table2, fromColumn: null, toColumn: null,
            type: 'MANY_TO_MANY', cardinalityType: 'N:M',
            isVirtualNM: true, junctionTable, isUserCreated: isUserCreatedJunction,
          });
        }
      });

      return virtualNMRelationships;
    },
    [erdData]
  );

  const forceLayout = useCallback(() => {
    if (!erdData?.tables || Object.keys(erdData.tables).length === 0) return;

    try {
      setNodes((currentNodes) => {
        const currentTableNames = new Set(Object.keys(erdData.tables));
        const visibleTableNames = filteredTables ? new Set(filteredTables) : currentTableNames;

        const schemaFilteredRelationships = (erdData.relationships || []).filter((rel) => {
          if (!currentTableNames.has(rel.fromTable) || !currentTableNames.has(rel.toTable)) {
            console.warn(`❌ Missing nodes for relationship: ${rel.fromTable} → ${rel.toTable}`);
            return false;
          }
          return visibleTableNames.has(rel.fromTable) && visibleTableNames.has(rel.toTable);
        });

        const bundledRelationships = bundleRelationships(schemaFilteredRelationships);
        const virtualNMRelationships = detectJunctionTables(schemaFilteredRelationships, visibleTableNames);
        const allRelationshipsForDistribution = [...bundledRelationships, ...virtualNMRelationships] as Relationship[];
        const uniqueEdges = buildEdgesFromRelationships(allRelationshipsForDistribution, currentNodes);
        setEdges(uniqueEdges);
        return currentNodes;
      });
    } catch (error) {
      console.error('❌ Force layout failed:', error);
    }
  }, [erdData, filteredTables, detectJunctionTables, buildEdgesFromRelationships]);

  const calculateLayout = useCallback(() => {
    if (isCalculatingRef.current) return;
    if (!erdData?.tables || Object.keys(erdData.tables).length === 0) {
      setNodes([]); setEdges([]); return;
    }

    isCalculatingRef.current = true;
    setLayoutError(null);

    try {
      let tablesToShow = Object.entries(erdData.tables);
      if (filteredTables && Array.isArray(filteredTables)) {
        tablesToShow = tablesToShow.filter(([tableName]) => filteredTables.includes(tableName));
      }

      const allParents = new Set<string>();
      const allChildren = new Set<string>();
      (erdData.relationships || []).forEach((rel) => { allParents.add(rel.toTable); allChildren.add(rel.fromTable); });
      const parentTables = new Set([...allParents].filter((table) => !allChildren.has(table)));

      const filteredSchemaData: ERDData = {
        ...erdData,
        tables: Object.fromEntries(tablesToShow),
        relationships: erdData.relationships || [],
      };

      const { nodes: hybridNodes } = calculateHybridLayout(filteredSchemaData, tablePositions);
      const simpleNodes = hybridNodes.map((node) => ({
        ...node,
        data: {
          ...node.data,
          isSelected: node.id === selectedTable,
          isHighlighted: node.id === highlightedTable,
          isParent: parentTables.has(node.id),
          highlightedColumn: highlightedColumn?.tableName === node.id ? highlightedColumn.columnName : null,
        },
      }));

      const currentTableNames = new Set(Object.keys(erdData.tables));
      const visibleTableNames = filteredTables ? new Set(filteredTables) : currentTableNames;

      const schemaFilteredRelationships = (erdData.relationships || []).filter((rel) => {
        if (!currentTableNames.has(rel.fromTable) || !currentTableNames.has(rel.toTable)) {
          console.warn(`❌ Missing nodes for relationship: ${rel.fromTable} → ${rel.toTable}`);
          return false;
        }
        return visibleTableNames.has(rel.fromTable) && visibleTableNames.has(rel.toTable);
      });

      const bundledRelationships = bundleRelationships(schemaFilteredRelationships);
      const virtualNMRelationships = detectJunctionTables(schemaFilteredRelationships, visibleTableNames);
      const allRelationshipsForDistribution = [...bundledRelationships, ...virtualNMRelationships] as Relationship[];
      const uniqueEdges = buildEdgesFromRelationships(allRelationshipsForDistribution, simpleNodes);

      setNodes(simpleNodes);
      setEdges(uniqueEdges);
    } catch (error) {
      console.error('❌ Layout failed:', error);
      setLayoutError((error as Error).message);
    } finally {
      isCalculatingRef.current = false;
    }
  }, [erdData, selectedTable, filteredTables, highlightedTable, highlightedColumn, tablePositions, layoutResetKey, detectJunctionTables, buildEdgesFromRelationships]);

  const applyInitialPositions = useCallback(
    (nodes: Node[]) => {
      return nodes.map((node) => {
        const savedPosition = tablePositions[node.id];
        if (savedPosition) {
          const distance = Math.sqrt(savedPosition.x ** 2 + savedPosition.y ** 2);
          if (distance <= 2000) return { ...node, position: savedPosition };
        }
        return node;
      });
    },
    [tablePositions]
  );

  useEffect(() => {
    if (erdData && Object.keys(erdData.tables || {}).length > 0) calculateLayout();
    else { setNodes([]); setEdges([]); }
  }, [erdData, calculateLayout]);

  useEffect(() => {
    if (nodes.length > 0 && Object.keys(tablePositions).length > 0) {
      const nodesWithSavedPositions = applyInitialPositions(nodes);
      const hasChanges = nodesWithSavedPositions.some(
        (node, index) => node.position.x !== nodes[index].position.x || node.position.y !== nodes[index].position.y
      );
      if (hasChanges) setNodes(nodesWithSavedPositions);
    }
  }, [erdData?.schemaName]);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      setNodes((nds) => {
        const updatedNodes = applyNodeChanges(changes, nds);
        const dragStoppedChanges = changes.filter(
          (change): change is NodeChange & { type: 'position'; position: { x: number; y: number }; dragging: false } =>
            change.type === 'position' && (change as { dragging?: boolean }).dragging === false && !!(change as { position?: unknown }).position
        );

        if (dragStoppedChanges.length > 0) {
          const newUpdates: Record<string, { x: number; y: number }> = {};
          dragStoppedChanges.forEach((change) => {
            const node = updatedNodes.find((n) => n.id === (change as { id: string }).id);
            if (node) newUpdates[node.id] = (change as { position: { x: number; y: number } }).position;
          });
          setPendingPositionUpdates((prev) => ({ ...prev, ...newUpdates }));
          setTimeout(() => forceLayout(), 300);
        }

        return updatedNodes;
      });
    },
    [forceLayout]
  );

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    const allowedChanges = changes.filter((change) => change.type === 'select' || (change as { type: string }).type === 'position');
    setEdges((eds) => applyEdgeChanges(allowedChanges, eds));
  }, []);

  const getInitialViewport = useCallback(() => {
    if (nodes.length === 0) return { x: 0, y: 0, zoom: 1 };

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    nodes.forEach((node) => {
      minX = Math.min(minX, node.position.x); minY = Math.min(minY, node.position.y);
      maxX = Math.max(maxX, node.position.x + 320); maxY = Math.max(maxY, node.position.y + 200);
    });

    const centerX = (minX + maxX) / 2, centerY = (minY + maxY) / 2;
    const contentWidth = maxX - minX, contentHeight = maxY - minY;
    const zoomX = 1200 / (contentWidth + 200), zoomY = 800 / (contentHeight + 200);
    const zoom = Math.min(Math.max(Math.min(zoomX, zoomY), 0.3), 1.5);

    return { x: 600 - centerX * zoom, y: 400 - centerY * zoom, zoom };
  }, [nodes]);

  return { nodes, edges, onNodesChange, onEdgesChange, getInitialViewport, forceLayout, layoutError };
};

export default useERDLayout;
