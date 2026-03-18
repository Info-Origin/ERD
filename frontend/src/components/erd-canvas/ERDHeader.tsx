import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { Legend } from "./Legend";
import { useVirtualSchema } from "../../context/VirtualSchemaContext";
import { useApp } from "../../context/AppContext";
import type { ColumnIndexEntry, HighlightedColumnInfo } from "../../types";
import "./ERDHeader.css";
import "./SearchBadge.css";

interface ChildInfo {
  childTable: string;
  fromColumn: string;
  toColumn: string;
}

interface HierarchyNode {
  table: string;
  depth: number;
  parentTable: string;
  fromColumn: string;
  toColumn: string;
  children: HierarchyNode[];
  allDescendants: string[];
}

interface HierarchyGroup {
  parentTable: string;
  children: HierarchyNode[];
  allDescendants: string[];
}

interface ERDHeaderProps {
  onTableFilter: (tableNames: string[] | null, lastSelectedTable: string | null, highlightedColumnInfo?: HighlightedColumnInfo | null) => void;
  isSchemaCollapsed?: boolean;
}

export const ERDHeader = ({ onTableFilter, isSchemaCollapsed }: ERDHeaderProps) => {
  const { workingSchema } = useVirtualSchema();
  const { crowsFootMode } = useApp();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTables, setSelectedTables] = useState<Set<string>>(new Set());
  const [lastSelectedTable, setLastSelectedTable] = useState<string | null>(null);
  const [highlightedColumn, setHighlightedColumn] = useState<HighlightedColumnInfo | null>(null);
  const [selectedColumns, setSelectedColumns] = useState<Record<string, string | null>>({});
  const [selectedChildren, setSelectedChildren] = useState<Set<string>>(new Set());
  const [isAddDropdownOpen, setIsAddDropdownOpen] = useState(false);
  const [isManageDropdownOpen, setIsManageDropdownOpen] = useState(false);
  const [childrenExpanded, setChildrenExpanded] = useState(true);
  const [showDirectChildrenOnly, setShowDirectChildrenOnly] = useState(false);
  const [hideNestedChildren, setHideNestedChildren] = useState(false);
  const [hideDirectChildren, setHideDirectChildren] = useState(false);
  const [showAllChips, setShowAllChips] = useState(false);
  const [legendForceExpanded, setLegendForceExpanded] = useState(false);
  const carouselRef = useRef<HTMLDivElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const manageDropdownRef = useRef<HTMLDivElement>(null);
  const childrenDropdownRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  useEffect(() => {
    if (crowsFootMode) {
      setLegendForceExpanded(true);
      const timer = setTimeout(() => setLegendForceExpanded(false), 100);
      return () => clearTimeout(timer);
    }
  }, [crowsFootMode]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setIsAddDropdownOpen(false);
      }
      const dropdownButton = document.querySelector('.modern-dropdown-button');
      if (manageDropdownRef.current && !manageDropdownRef.current.contains(event.target as Node) && dropdownButton && !dropdownButton.contains(event.target as Node)) {
        setIsManageDropdownOpen(false);
      }
      if (childrenDropdownRef.current && !childrenDropdownRef.current.contains(event.target as Node)) {
        setChildrenExpanded(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside, true);
    return () => document.removeEventListener('mousedown', handleClickOutside, true);
  }, []);

  const tableNames = useMemo(() => {
    if (!workingSchema?.tables) return [];
    return Object.keys(workingSchema.tables).sort();
  }, [workingSchema]);

  const columnIndex = useMemo((): ColumnIndexEntry[] => {
    if (!workingSchema?.tables) return [];
    const index: ColumnIndexEntry[] = [];
    Object.entries(workingSchema.tables).forEach(([tableName, tableData]) => {
      Object.entries(tableData.columns || {}).forEach(([columnName, columnData]) => {
        index.push({
          tableName, columnName,
          columnNameLower: columnName.toLowerCase(),
          columnType: columnData.type,
          isPK: columnData.pk,
          isFK: columnData.fk ?? false,
          isUnique: columnData.unique,
        });
      });
    });
    return index;
  }, [workingSchema]);

  const filteredTableNames = useMemo(() => {
    if (!searchQuery) return tableNames;
    return tableNames.filter((name) => name.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [tableNames, searchQuery]);

  const filteredColumns = useMemo(() => {
    if (!searchQuery) return [];
    const queryLower = searchQuery.toLowerCase();
    return columnIndex.filter((col) => col.columnNameLower.includes(queryLower));
  }, [columnIndex, searchQuery]);

  const analyzeChildHierarchy = useCallback((tableNames: Set<string>): HierarchyGroup[] => {
    if (!workingSchema?.relationships || !tableNames || tableNames.size === 0) return [];
    const parentToChildren = new Map<string, ChildInfo[]>();
    workingSchema.relationships.forEach((rel) => {
      if (!parentToChildren.has(rel.toTable)) parentToChildren.set(rel.toTable, []);
      parentToChildren.get(rel.toTable)!.push({ childTable: rel.fromTable, fromColumn: rel.fromColumn, toColumn: rel.toColumn });
    });

    const buildHierarchy = (tableName: string, depth = 0, visited = new Set<string>()): HierarchyNode[] => {
      if (visited.has(tableName) || depth > 10) return [];
      visited.add(tableName);
      const children = parentToChildren.get(tableName) || [];
      return children.map((child) => {
        const childHierarchy = buildHierarchy(child.childTable, depth + 1, new Set(visited));
        return {
          table: child.childTable, depth, parentTable: tableName,
          fromColumn: child.fromColumn, toColumn: child.toColumn,
          children: childHierarchy,
          allDescendants: [child.childTable, ...childHierarchy.flatMap((ch) => ch.allDescendants)],
        };
      });
    };

    const hierarchies: HierarchyGroup[] = [];
    tableNames.forEach((tableName) => {
      const hierarchy = buildHierarchy(tableName);
      if (hierarchy.length > 0) {
        hierarchies.push({ parentTable: tableName, children: hierarchy, allDescendants: hierarchy.flatMap((ch) => ch.allDescendants) });
      }
    });
    return hierarchies;
  }, [workingSchema]);

  const checkCarouselScroll = useCallback(() => {
    if (!carouselRef.current) return;
    const container = carouselRef.current;
    const hasOverflow = container.scrollWidth > container.clientWidth;
    const currentScroll = container.scrollLeft;
    const maxScroll = container.scrollWidth - container.clientWidth;
    setCanScrollLeft(hasOverflow && currentScroll > 0);
    setCanScrollRight(hasOverflow && currentScroll < maxScroll);
  }, []);

  useEffect(() => {
    checkCarouselScroll();
    const container = carouselRef.current;
    if (container) {
      container.addEventListener('scroll', checkCarouselScroll);
      return () => container.removeEventListener('scroll', checkCarouselScroll);
    }
  }, [selectedTables, checkCarouselScroll]);

  useEffect(() => {
    const handleResize = () => setTimeout(checkCarouselScroll, 100);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [checkCarouselScroll]);

  const hierarchyData = useMemo(() => {
    if (selectedTables.size === 0) return [];
    const tablesToAnalyze = lastSelectedTable && selectedTables.has(lastSelectedTable) ? new Set([lastSelectedTable]) : selectedTables;
    return analyzeChildHierarchy(tablesToAnalyze);
  }, [selectedTables, lastSelectedTable, analyzeChildHierarchy]);

  const hasNestedChildren = useMemo(() => hierarchyData.some((h) => h.children.some((child) => child.children.length > 0)), [hierarchyData]);

  const displayHierarchyData = useMemo(() => {
    if (!showDirectChildrenOnly) return hierarchyData;
    return hierarchyData.map((hierarchy) => ({
      ...hierarchy,
      children: hierarchy.children.map((child) => ({ ...child, children: [], allDescendants: [child.table] })),
      allDescendants: hierarchy.children.map((child) => child.table),
    }));
  }, [hierarchyData, showDirectChildrenOnly]);

  const handleTableSelectFromDropdown = useCallback((tableName: string) => {
    if (selectedTables.has(tableName)) { setIsAddDropdownOpen(false); setSearchQuery(""); return; }
    const newSelectedTables = new Set(selectedTables);
    newSelectedTables.add(tableName);
    setSelectedTables(newSelectedTables);
    setLastSelectedTable(tableName);
    setSelectedColumns((prev) => ({ ...prev, [tableName]: null }));
    const hierarchy = analyzeChildHierarchy(newSelectedTables);
    const allDescendants = new Set<string>();
    hierarchy.forEach((h) => h.allDescendants.forEach((d) => allDescendants.add(d)));
    setSelectedChildren(allDescendants);
    onTableFilter([...new Set([...newSelectedTables, ...allDescendants])], tableName);
    setIsAddDropdownOpen(false);
    setSearchQuery("");
  }, [selectedTables, analyzeChildHierarchy, onTableFilter]);

  const handleClearAll = useCallback(() => {
    setSelectedTables(new Set()); setSelectedChildren(new Set());
    setSelectedColumns({}); setLastSelectedTable(null);
    setIsManageDropdownOpen(false); onTableFilter(null, null);
  }, [onTableFilter]);

  const handleTableSelect = useCallback((tableName: string) => {
    if (selectedTables.has(tableName)) return;
    const newSelectedTables = new Set(selectedTables);
    newSelectedTables.add(tableName);
    setSelectedTables(newSelectedTables);
    setLastSelectedTable(tableName);
    const hierarchy = analyzeChildHierarchy(newSelectedTables);
    const allDescendants = new Set<string>();
    hierarchy.forEach((h) => h.allDescendants.forEach((d) => allDescendants.add(d)));
    setSelectedChildren(allDescendants);
    onTableFilter([...new Set([...newSelectedTables, ...allDescendants])], tableName);
  }, [selectedTables, analyzeChildHierarchy, onTableFilter]);

  const handleColumnSelect = useCallback((columnInfo: ColumnIndexEntry) => {
    if (selectedTables.has(columnInfo.tableName)) {
      setSelectedColumns((prev) => ({ ...prev, [columnInfo.tableName]: columnInfo.columnName }));
      setHighlightedColumn({ tableName: columnInfo.tableName, columnName: columnInfo.columnName });
      const visibleTables = Array.from(selectedTables);
      selectedChildren.forEach((child) => visibleTables.push(child));
      onTableFilter([...new Set(visibleTables)], columnInfo.tableName, { tableName: columnInfo.tableName, columnName: columnInfo.columnName });
    } else {
      const newSelectedTables = new Set(selectedTables);
      newSelectedTables.add(columnInfo.tableName);
      setSelectedTables(newSelectedTables);
      setLastSelectedTable(columnInfo.tableName);
      setSelectedColumns((prev) => ({ ...prev, [columnInfo.tableName]: columnInfo.columnName }));
      setHighlightedColumn({ tableName: columnInfo.tableName, columnName: columnInfo.columnName });
      const hierarchy = analyzeChildHierarchy(newSelectedTables);
      const allDescendants = new Set<string>();
      hierarchy.forEach((h) => h.allDescendants.forEach((d) => allDescendants.add(d)));
      setSelectedChildren(allDescendants);
      onTableFilter([...new Set([...newSelectedTables, ...allDescendants])], columnInfo.tableName, { tableName: columnInfo.tableName, columnName: columnInfo.columnName });
    }
    setIsAddDropdownOpen(false);
    setSearchQuery("");
  }, [selectedTables, selectedChildren, analyzeChildHierarchy, onTableFilter]);

  const handleChipClick = useCallback((tableName: string) => {
    setLastSelectedTable(tableName);
    const colName = selectedColumns[tableName];
    if (colName) setHighlightedColumn({ tableName, columnName: colName });
    else setHighlightedColumn(null);
    const visibleTables = Array.from(selectedTables);
    selectedChildren.forEach((child) => visibleTables.push(child));
    const columnInfo = colName ? { tableName, columnName: colName } : null;
    onTableFilter([...new Set(visibleTables)], tableName, columnInfo);
  }, [selectedTables, selectedChildren, selectedColumns, onTableFilter]);

  const handleTableRemove = useCallback((tableName: string) => {
    const newSelectedTables = new Set(selectedTables);
    newSelectedTables.delete(tableName);
    setSelectedTables(newSelectedTables);
    setSelectedColumns((prev) => { const updated = { ...prev }; delete updated[tableName]; return updated; });
    if (lastSelectedTable === tableName) {
      const remaining = Array.from(newSelectedTables);
      setLastSelectedTable(remaining.length > 0 ? remaining[remaining.length - 1] : null);
    }
    const hierarchyForRemaining = analyzeChildHierarchy(newSelectedTables);
    const validChildren = new Set<string>();
    hierarchyForRemaining.forEach((h) => h.allDescendants.forEach((d) => validChildren.add(d)));
    setSelectedChildren(validChildren);
    const visibleTables = [...newSelectedTables, ...validChildren];
    const newLastSelected = lastSelectedTable === tableName ? (Array.from(newSelectedTables)[0] || null) : lastSelectedTable;
    onTableFilter(visibleTables.length > 0 ? [...new Set(visibleTables)] : null, newLastSelected);
  }, [selectedTables, lastSelectedTable, analyzeChildHierarchy, onTableFilter]);

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);
    setIsAddDropdownOpen(value.length > 0);
  }, []);

  const handleHideDirectChildren = useCallback((shouldHide: boolean) => {
    setHideDirectChildren(shouldHide);
    if (shouldHide) {
      setSelectedChildren(new Set());
      onTableFilter([...new Set(Array.from(selectedTables))], lastSelectedTable);
    } else {
      const newSelectedChildren = new Set<string>();
      if (hideNestedChildren) {
        hierarchyData.forEach((h) => h.children.forEach((child) => newSelectedChildren.add(child.table)));
      } else {
        hierarchyData.forEach((h) => h.allDescendants.forEach((d) => newSelectedChildren.add(d)));
      }
      setSelectedChildren(newSelectedChildren);
      const visibleTables = Array.from(selectedTables);
      newSelectedChildren.forEach((child) => visibleTables.push(child));
      onTableFilter([...new Set(visibleTables)], lastSelectedTable);
    }
  }, [hierarchyData, selectedTables, onTableFilter, lastSelectedTable, hideNestedChildren]);

  const handleHideNestedChildren = useCallback((shouldHide: boolean) => {
    setHideNestedChildren(shouldHide);
    if (shouldHide) {
      const newSelectedChildren = new Set<string>();
      hierarchyData.forEach((h) => h.children.forEach((child) => newSelectedChildren.add(child.table)));
      setSelectedChildren(newSelectedChildren);
      const visibleTables = Array.from(selectedTables);
      newSelectedChildren.forEach((child) => visibleTables.push(child));
      onTableFilter([...new Set(visibleTables)], lastSelectedTable);
    } else {
      const newSelectedChildren = new Set<string>();
      hierarchyData.forEach((h) => h.allDescendants.forEach((d) => newSelectedChildren.add(d)));
      setSelectedChildren(newSelectedChildren);
      const visibleTables = Array.from(selectedTables);
      newSelectedChildren.forEach((child) => visibleTables.push(child));
      onTableFilter([...new Set(visibleTables)], lastSelectedTable);
    }
  }, [hierarchyData, selectedTables, onTableFilter, lastSelectedTable]);

  const handleChildToggle = useCallback((childTable: string) => {
    const newSelectedChildren = new Set(selectedChildren);
    if (newSelectedChildren.has(childTable)) {
      newSelectedChildren.delete(childTable);
      const visited = new Set<string>();
      const removeAllDescendants = (tableName: string) => {
        if (visited.has(tableName)) return;
        visited.add(tableName);
        hierarchyData.forEach((hierarchy) => {
          const findAndRemove = (children: HierarchyNode[]) => {
            children.forEach((child) => {
              if (child.table === tableName) {
                child.children.forEach((gc) => { newSelectedChildren.delete(gc.table); removeAllDescendants(gc.table); });
              } else if (child.children.length > 0) findAndRemove(child.children);
            });
          };
          findAndRemove(hierarchy.children);
        });
      };
      removeAllDescendants(childTable);
    } else {
      newSelectedChildren.add(childTable);
    }
    setSelectedChildren(newSelectedChildren);
    if (newSelectedChildren.size === 0 && !hideDirectChildren) setHideDirectChildren(true);
    if (newSelectedChildren.size > 0 && hideDirectChildren) setHideDirectChildren(false);
    const visibleTables = Array.from(selectedTables);
    newSelectedChildren.forEach((child) => visibleTables.push(child));
    onTableFilter([...new Set(visibleTables)], lastSelectedTable);
  }, [selectedChildren, selectedTables, hierarchyData, onTableFilter, lastSelectedTable, hideDirectChildren]);

  const renderChildHierarchy = useCallback((children: HierarchyNode[], depth: number, parentTable = ''): React.ReactNode => {
    return children.map((child, index) => {
      const checkboxId = `hierarchy-${parentTable}-${child.table}-${child.fromColumn}-${child.toColumn}-${index}`;
      return (
        <div key={`${parentTable}-${child.table}-${child.fromColumn}-${child.toColumn}-${index}`} className={`hierarchy-item hierarchy-depth-${Math.min(depth, 3)}`}>
          <label className="filter-table-item">
            <input type="checkbox" id={checkboxId} name={checkboxId} checked={selectedChildren.has(child.table)} onChange={() => handleChildToggle(child.table)} />
            <div className="filter-table-info">
              <span className="filter-table-name" title={child.table}>{child.table}</span>
              <span className="filter-table-context" title={`${child.fromColumn} → ${child.toColumn}`}>{child.fromColumn} → {child.toColumn}</span>
            </div>
          </label>
          {child.children.length > 0 && renderChildHierarchy(child.children, depth + 1, child.table)}
        </div>
      );
    });
  }, [selectedChildren, handleChildToggle]);

  useEffect(() => {
    if (selectedTables.size > 0) {
      const hierarchy = analyzeChildHierarchy(selectedTables);
      const hasNested = hierarchy.some((h) => h.children.some((child) => child.children.length > 0));
      if (!hasNested && hideNestedChildren) setHideNestedChildren(false);
      if (hideDirectChildren) {
        setSelectedChildren(new Set());
      } else if (hideNestedChildren && hasNested) {
        const directChildrenOnly = new Set<string>();
        hierarchy.forEach((h) => h.children.forEach((child) => directChildrenOnly.add(child.table)));
        setSelectedChildren(directChildrenOnly);
      }
    } else {
      setSelectedChildren(new Set());
      setHideNestedChildren(false);
      setHideDirectChildren(false);
      onTableFilter(null, null);
    }
  }, [selectedTables, analyzeChildHierarchy, onTableFilter, hideNestedChildren, hideDirectChildren]);

  return (
    <div className={`erd-header ${isSchemaCollapsed ? 'schema-collapsed' : ''}`}>
      <div className="erd-header-content">
        <div className="erd-search-section" ref={searchContainerRef}>
          <div className="modern-search-container">
            <img src="/search.png" alt="Search" className="search-icon-img" />
            <input
              type="text" id="table-column-search" name="table-column-search"
              placeholder="Search Here For Tables And Columns...."
              value={searchQuery} onChange={handleSearchChange}
              onFocus={() => searchQuery.length > 0 && setIsAddDropdownOpen(true)}
              className="modern-search-input" autoComplete="off"
            />
            <button className="modern-dropdown-button" onClick={() => setIsManageDropdownOpen(!isManageDropdownOpen)}
              disabled={selectedTables.size === 0} aria-label="Manage selected tables" title="Manage selected tables">
              ▼
            </button>
          </div>

          {selectedTables.size > 0 && (
            <div className="chips-overlay">
              <div className={`chips-container ${showAllChips ? 'show-all' : ''}`} ref={carouselRef}>
                {Array.from(selectedTables).slice(0, showAllChips ? selectedTables.size : 3).map((tableName) => (
                  <div key={tableName} className={`chip-item ${tableName === lastSelectedTable ? 'active' : ''}`}
                    onClick={() => handleChipClick(tableName)}
                    title={selectedColumns[tableName] ? `${tableName}.${selectedColumns[tableName]}` : tableName}>
                    <span className="chip-text">{selectedColumns[tableName] ? `${tableName}.${selectedColumns[tableName]}` : tableName}</span>
                    <button className="chip-remove" onClick={(e) => { e.stopPropagation(); handleTableRemove(tableName); }} aria-label={`Remove ${tableName}`} title={`Remove ${tableName}`}>×</button>
                  </div>
                ))}
                {selectedTables.size > 3 && !showAllChips && (
                  <button className="chip-more-button" onClick={() => setShowAllChips(true)} title={`Show ${selectedTables.size - 3} more chip(s)`}>
                    +{selectedTables.size - 3} more
                  </button>
                )}
              </div>
            </div>
          )}

          {isAddDropdownOpen && (
            <div className="carousel-add-dropdown">
              <div className="carousel-search-results">
                {filteredTableNames.filter((t) => !selectedTables.has(t)).length > 0 && (
                  <>
                    <div className="search-results-header">
                      <img src="/table.png" alt="Tables" style={{ width: '16px', height: '16px', marginRight: '4px' }} />
                      Tables ({filteredTableNames.filter((t) => !selectedTables.has(t)).length})
                    </div>
                    {filteredTableNames.filter((t) => !selectedTables.has(t)).map((tableName) => (
                      <div key={tableName} className="carousel-search-item table-result" onClick={() => handleTableSelectFromDropdown(tableName)}>{tableName}</div>
                    ))}
                  </>
                )}
                {filteredColumns.length > 0 && (
                  <>
                    <div className="search-results-header">
                      <img src="/column.png" alt="Columns" style={{ width: '16px', height: '16px', marginRight: '4px' }} />
                      Columns ({filteredColumns.length})
                    </div>
                    {filteredColumns.map((col, index) => (
                      <div key={`${col.tableName}-${col.columnName}-${index}`} className="carousel-search-item column-result" onClick={() => handleColumnSelect(col)}>
                        <span className="column-table-name">{col.tableName}</span>
                        <span className="column-separator">.</span>
                        <span className="column-name">{col.columnName}</span>
                        <span className="column-type">({col.columnType})</span>
                        {col.isPK && <span className="search-badge-pk">PK</span>}
                        {col.isFK && <span className="search-badge-fk">FK</span>}
                        {col.isUnique && <span className="search-badge-unique">UQ</span>}
                      </div>
                    ))}
                  </>
                )}
                {filteredTableNames.filter((t) => !selectedTables.has(t)).length === 0 && filteredColumns.length === 0 && searchQuery && (
                  <div className="no-results">No tables or columns found</div>
                )}
              </div>
            </div>
          )}

          {isManageDropdownOpen && selectedTables.size > 0 && (
            <div className="carousel-manage-dropdown" ref={manageDropdownRef}>
              <div className="carousel-manage-header">Selected Tables ({selectedTables.size})</div>
              <div className="carousel-manage-list">
                {Array.from(selectedTables).map((tableName) => (
                  <div key={tableName} className="carousel-manage-item">
                    <span className={`carousel-manage-name ${tableName === lastSelectedTable ? 'active' : ''}`}
                      onClick={() => handleChipClick(tableName)} style={{ cursor: 'pointer' }}
                      title={selectedColumns[tableName] ? `Click to highlight ${tableName}.${selectedColumns[tableName]} in ERD` : `Click to highlight ${tableName} in ERD`}>
                      {selectedColumns[tableName] ? `${tableName}.${selectedColumns[tableName]}` : tableName}
                    </span>
                    <button className="carousel-manage-remove" onClick={() => handleTableRemove(tableName)} aria-label={`Remove ${tableName}`}>×</button>
                  </div>
                ))}
                <button className="carousel-clear-all" onClick={handleClearAll}>Clear All</button>
              </div>
            </div>
          )}
        </div>

        <div className="erd-filter-section">
          {selectedTables.size > 0 && displayHierarchyData.length > 0 && (
            <div className="filter-dropdown" ref={childrenDropdownRef}>
              <div className="filter-dropdown-header" onClick={() => setChildrenExpanded(!childrenExpanded)}>
                <span className="filter-dropdown-title">
                  Children ({showDirectChildrenOnly
                    ? displayHierarchyData.reduce((total, h) => total + h.children.length, 0)
                    : displayHierarchyData.reduce((total, h) => total + h.allDescendants.length, 0)})
                </span>
                <button className="filter-dropdown-toggle" aria-label={childrenExpanded ? 'Collapse children' : 'Expand children'}>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                    <path d={childrenExpanded ? "M2 4 L6 8 L10 4" : "M4 2 L8 6 L4 10"} stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>
              {childrenExpanded && (
                <div className="filter-dropdown-content">
                  <div className="hierarchy-toggle-container">
                    <div className="toggle-group">
                      <input type="checkbox" id="hide-nested-children-toggle" name="hide-nested-children-toggle" className="hide-nested-checkbox"
                        checked={!hideNestedChildren} disabled={!hasNestedChildren || hideDirectChildren}
                        onChange={(e) => handleHideNestedChildren(!e.target.checked)}
                        title={hasNestedChildren ? "Show/hide nested children" : "No nested children to show"} />
                      <button className={`hierarchy-toggle-btn ${!showDirectChildrenOnly ? 'active' : ''}`} onClick={() => setShowDirectChildrenOnly(false)}>Full Hierarchy</button>
                    </div>
                    <div className="toggle-group">
                      <input type="checkbox" id="hide-direct-children-toggle" name="hide-direct-children-toggle" className="hide-direct-checkbox"
                        checked={!hideDirectChildren} onChange={(e) => handleHideDirectChildren(!e.target.checked)}
                        title="Show/hide all direct children" />
                      <button className={`hierarchy-toggle-btn ${showDirectChildrenOnly ? 'active' : ''}`} onClick={() => setShowDirectChildrenOnly(true)}>Direct Children</button>
                    </div>
                  </div>
                  <div className="filter-table-list">
                    {displayHierarchyData.map((hierarchy) => (
                      <div key={hierarchy.parentTable} className="hierarchy-group">
                        <div className="hierarchy-parent-label">Children of {hierarchy.parentTable}:</div>
                        {renderChildHierarchy(hierarchy.children, 0, hierarchy.parentTable)}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="erd-legend-section">
          <Legend isInHeader={true} forceExpanded={legendForceExpanded} />
        </div>
      </div>
    </div>
  );
};
