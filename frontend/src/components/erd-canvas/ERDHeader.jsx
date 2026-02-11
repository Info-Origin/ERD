import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { Legend } from "./Legend";
import { useVirtualSchema } from "../../context/VirtualSchemaContext";
import "./ERDHeader.css";

export const ERDHeader = ({ onTableFilter, isSchemaCollapsed }) => {
  const { workingSchema } = useVirtualSchema();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTables, setSelectedTables] = useState(new Set()); // Changed to Set for multiple tables
  const [lastSelectedTable, setLastSelectedTable] = useState(null); // Track most recently selected table
  const [highlightedColumn, setHighlightedColumn] = useState(null); // NEW: Track highlighted column {tableName, columnName}
  const [selectedColumns, setSelectedColumns] = useState({}); // NEW: Track which column was used to select each table
  const [selectedChildren, setSelectedChildren] = useState(new Set());
  const [isAddDropdownOpen, setIsAddDropdownOpen] = useState(false);
  const [isManageDropdownOpen, setIsManageDropdownOpen] = useState(false);
  const [childrenExpanded, setChildrenExpanded] = useState(true);
  const [showDirectChildrenOnly, setShowDirectChildrenOnly] = useState(false); // Toggle between direct and full hierarchy
  const [hideNestedChildren, setHideNestedChildren] = useState(false); // Checkbox to hide all nested children (depth > 0)
  const [hideDirectChildren, setHideDirectChildren] = useState(false); // Checkbox to hide all direct children
  const carouselRef = useRef(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // Get all table names for autocomplete
  const tableNames = useMemo(() => {
    if (!workingSchema?.tables) return [];
    return Object.keys(workingSchema.tables).sort();
  }, [workingSchema]);

  // BUILD COLUMN INDEX ONCE (Performance optimization)
  const columnIndex = useMemo(() => {
    if (!workingSchema?.tables) return [];
    
    const index = [];
    
    Object.entries(workingSchema.tables).forEach(([tableName, tableData]) => {
      Object.entries(tableData.columns || {}).forEach(([columnName, columnData]) => {
        index.push({
          tableName: tableName,
          columnName: columnName,
          columnNameLower: columnName.toLowerCase(), // Pre-compute for faster search
          columnType: columnData.type,
          isPK: columnData.pk,
          isFK: columnData.fk,
          isUnique: columnData.unique
        });
      });
    });
    
    return index;
  }, [workingSchema]); // Only rebuild when schema changes

  // Filter tables based on search query (UNCHANGED - existing logic)
  const filteredTableNames = useMemo(() => {
    if (!searchQuery) return tableNames;
    return tableNames.filter(name => 
      name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [tableNames, searchQuery]);

  // NEW: Filter columns based on search query (fast index-based search)
  const filteredColumns = useMemo(() => {
    if (!searchQuery) return [];
    
    const queryLower = searchQuery.toLowerCase();
    
    // Fast: Just filter the pre-built index (no nested loops)
    return columnIndex.filter(col => 
      col.columnNameLower.includes(queryLower)
    );
  }, [columnIndex, searchQuery]);

  // Analyze child hierarchy for multiple tables with full depth
  const analyzeChildHierarchy = useCallback((tableNames) => {
    if (!workingSchema?.relationships || !tableNames || tableNames.size === 0) {
      return [];
    }

    // Build a map of parent -> children relationships
    const parentToChildren = new Map();
    workingSchema.relationships.forEach(rel => {
      if (!parentToChildren.has(rel.toTable)) {
        parentToChildren.set(rel.toTable, []);
      }
      parentToChildren.get(rel.toTable).push({
        childTable: rel.fromTable,
        fromColumn: rel.fromColumn,
        toColumn: rel.toColumn
      });
    });

    // Recursive function to build hierarchy
    const buildHierarchy = (tableName, depth = 0, visited = new Set()) => {
      // Prevent infinite loops in circular references
      if (visited.has(tableName) || depth > 10) {
        return [];
      }

      visited.add(tableName);
      const children = parentToChildren.get(tableName) || [];
      
      return children.map(child => {
        const childHierarchy = buildHierarchy(child.childTable, depth + 1, new Set(visited));
        return {
          table: child.childTable,
          depth: depth,
          parentTable: tableName,
          fromColumn: child.fromColumn,
          toColumn: child.toColumn,
          children: childHierarchy,
          // Flatten all descendant tables for easy access
          allDescendants: [
            child.childTable,
            ...childHierarchy.flatMap(ch => ch.allDescendants)
          ]
        };
      });
    };

    // Build hierarchy for all selected tables
    const hierarchies = [];
    tableNames.forEach(tableName => {
      const hierarchy = buildHierarchy(tableName);
      if (hierarchy.length > 0) {
        hierarchies.push({
          parentTable: tableName,
          children: hierarchy,
          allDescendants: hierarchy.flatMap(ch => ch.allDescendants)
        });
      }
    });

    return hierarchies;
  }, [workingSchema]);

  // Carousel scroll function
  const scrollCarousel = useCallback((direction) => {
    if (!carouselRef.current) return;
    
    const container = carouselRef.current;
    const chipWidth = 100; // Approximate width of one chip including gap
    const scrollAmount = chipWidth * 2; // Scroll 2 chips at a time
    
    const currentScroll = container.scrollLeft;
    const maxScroll = container.scrollWidth - container.clientWidth;
    
    let newScroll;
    if (direction === 'left') {
      newScroll = Math.max(0, currentScroll - scrollAmount);
    } else {
      newScroll = Math.min(maxScroll, currentScroll + scrollAmount);
    }
    
    container.scrollTo({
      left: newScroll,
      behavior: 'smooth'
    });
  }, []);

  // Check if carousel can scroll (has overflow)
  const checkCarouselScroll = useCallback(() => {
    if (!carouselRef.current) return;
    
    const container = carouselRef.current;
    const hasOverflow = container.scrollWidth > container.clientWidth;
    const currentScroll = container.scrollLeft;
    const maxScroll = container.scrollWidth - container.clientWidth;
    
    setCanScrollLeft(hasOverflow && currentScroll > 0);
    setCanScrollRight(hasOverflow && currentScroll < maxScroll);
  }, []);

  // Update scroll states when selectedTables changes or on scroll
  useEffect(() => {
    checkCarouselScroll();
    
    const container = carouselRef.current;
    if (container) {
      container.addEventListener('scroll', checkCarouselScroll);
      return () => container.removeEventListener('scroll', checkCarouselScroll);
    }
  }, [selectedTables, checkCarouselScroll]);

  // Also check on window resize
  useEffect(() => {
    const handleResize = () => {
      setTimeout(checkCarouselScroll, 100); // Small delay to ensure layout is updated
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [checkCarouselScroll]);

  // Get current child hierarchy data for the active table
  const hierarchyData = useMemo(() => {
    if (selectedTables.size === 0) return [];
    
    // If there's a last selected table, show hierarchy for that table only
    // Otherwise show hierarchy for all selected tables
    const tablesToAnalyze = lastSelectedTable && selectedTables.has(lastSelectedTable) 
      ? new Set([lastSelectedTable])
      : selectedTables;
    
    return analyzeChildHierarchy(tablesToAnalyze);
  }, [selectedTables, lastSelectedTable, analyzeChildHierarchy]);

  // Check if there are any nested children (grandchildren and deeper) to enable/disable checkbox
  const hasNestedChildren = useMemo(() => {
    return hierarchyData.some(hierarchy => 
      hierarchy.children.some(child => child.children.length > 0)
    );
  }, [hierarchyData]);
  const displayHierarchyData = useMemo(() => {
    if (!showDirectChildrenOnly) {
      return hierarchyData; // Show full hierarchy
    }
    
    // Show only direct children (depth 0)
    return hierarchyData.map(hierarchy => ({
      ...hierarchy,
      children: hierarchy.children.map(child => ({
        ...child,
        children: [], // Remove nested children for direct-only view
        allDescendants: [child.table] // Only include the direct child itself
      })),
      allDescendants: hierarchy.children.map(child => child.table) // Only direct children
    }));
  }, [hierarchyData, showDirectChildrenOnly]);

  // Handle table selection from add dropdown
  const handleTableSelectFromDropdown = useCallback((tableName) => {
    // Simple table selection without relationship analysis to avoid circular dependency
    if (selectedTables.has(tableName)) {
      // Table already selected, don't add again
      setIsAddDropdownOpen(false);
      setSearchQuery("");
      return;
    }

    const newSelectedTables = new Set(selectedTables);
    newSelectedTables.add(tableName);
    setSelectedTables(newSelectedTables);
    setLastSelectedTable(tableName); // Track the most recently selected table
    
    // Mark this table as selected directly (no column)
    setSelectedColumns(prev => ({ ...prev, [tableName]: null }));
    
    // IMMEDIATE HIERARCHY ANALYSIS AND FILTER UPDATE
    const hierarchy = analyzeChildHierarchy(newSelectedTables);
    const allDescendants = new Set();
    hierarchy.forEach(h => {
      h.allDescendants.forEach(descendant => {
        allDescendants.add(descendant);
      });
    });
    
    // Update children immediately
    setSelectedChildren(allDescendants);
    
    // IMMEDIATE FILTER UPDATE: Update ERD immediately
    const visibleTables = [...newSelectedTables, ...allDescendants];
    onTableFilter([...new Set(visibleTables)], tableName);
    
    setIsAddDropdownOpen(false);
    setSearchQuery("");
  }, [selectedTables, analyzeChildHierarchy, onTableFilter]);

  // Handle clear all tables
  const handleClearAll = useCallback(() => {
    setSelectedTables(new Set());
    setSelectedChildren(new Set());
    setSelectedColumns({}); // Clear column info
    setLastSelectedTable(null); // Clear last selected table
    setIsManageDropdownOpen(false);
    onTableFilter(null, null);
  }, [onTableFilter]);

  // Handle table selection (add to carousel)
  const handleTableSelect = useCallback((tableName) => {
    if (selectedTables.has(tableName)) {
      // Table already selected, don't add again
      return;
    }

    const newSelectedTables = new Set(selectedTables);
    newSelectedTables.add(tableName);
    setSelectedTables(newSelectedTables);
    setLastSelectedTable(tableName); // Track the most recently selected table
    
    // IMMEDIATE HIERARCHY ANALYSIS AND FILTER UPDATE
    const hierarchy = analyzeChildHierarchy(newSelectedTables);
    const allDescendants = new Set();
    hierarchy.forEach(h => {
      h.allDescendants.forEach(descendant => {
        allDescendants.add(descendant);
      });
    });
    
    // Update children immediately
    setSelectedChildren(allDescendants);
    
    // IMMEDIATE FILTER UPDATE: Update ERD immediately
    const visibleTables = [...newSelectedTables, ...allDescendants];
    onTableFilter([...new Set(visibleTables)], tableName);
  }, [selectedTables, analyzeChildHierarchy, onTableFilter]);

  // NEW: Handle column selection (adds table and highlights column)
  const handleColumnSelect = useCallback((columnInfo) => {
    // Check if table is already selected
    if (selectedTables.has(columnInfo.tableName)) {
      // Table already selected, just update the column info and highlight
      setSelectedColumns(prev => ({ 
        ...prev, 
        [columnInfo.tableName]: columnInfo.columnName 
      }));
      
      setHighlightedColumn({
        tableName: columnInfo.tableName,
        columnName: columnInfo.columnName
      });
      
      // Update filter to highlight this table
      const visibleTables = Array.from(selectedTables);
      selectedChildren.forEach(child => visibleTables.push(child));
      onTableFilter([...new Set(visibleTables)], columnInfo.tableName, {
        tableName: columnInfo.tableName,
        columnName: columnInfo.columnName
      });
    } else {
      // Add the table and highlight the column
      const newSelectedTables = new Set(selectedTables);
      newSelectedTables.add(columnInfo.tableName);
      setSelectedTables(newSelectedTables);
      setLastSelectedTable(columnInfo.tableName);
      
      // Store which column was used to select this table
      setSelectedColumns(prev => ({ 
        ...prev, 
        [columnInfo.tableName]: columnInfo.columnName 
      }));
      
      // Set highlighted column
      setHighlightedColumn({
        tableName: columnInfo.tableName,
        columnName: columnInfo.columnName
      });
      
      // Analyze hierarchy
      const hierarchy = analyzeChildHierarchy(newSelectedTables);
      const allDescendants = new Set();
      hierarchy.forEach(h => {
        h.allDescendants.forEach(descendant => {
          allDescendants.add(descendant);
        });
      });
      
      setSelectedChildren(allDescendants);
      
      // Update filter with highlighted column
      const visibleTables = [...newSelectedTables, ...allDescendants];
      onTableFilter([...new Set(visibleTables)], columnInfo.tableName, {
        tableName: columnInfo.tableName,
        columnName: columnInfo.columnName
      });
    }
    
    // Close dropdown
    setIsAddDropdownOpen(false);
    setSearchQuery("");
  }, [selectedTables, selectedChildren, analyzeChildHierarchy, onTableFilter]);

  // Handle chip click to switch active table
  const handleChipClick = useCallback((tableName) => {
    setLastSelectedTable(tableName);
    
    // Restore the highlighted column for this table (if any)
    if (selectedColumns[tableName]) {
      setHighlightedColumn({
        tableName: tableName,
        columnName: selectedColumns[tableName]
      });
    } else {
      setHighlightedColumn(null); // Clear if no column for this table
    }
    
    // Update visible tables with new highlight
    const visibleTables = Array.from(selectedTables);
    selectedChildren.forEach(child => visibleTables.push(child));
    
    // Pass column info if exists
    const columnInfo = selectedColumns[tableName] ? {
      tableName: tableName,
      columnName: selectedColumns[tableName]
    } : null;
    
    onTableFilter([...new Set(visibleTables)], tableName, columnInfo);
  }, [selectedTables, selectedChildren, selectedColumns, onTableFilter]);

  // Handle table removal (remove chip)
  const handleTableRemove = useCallback((tableName) => {
    const newSelectedTables = new Set(selectedTables);
    newSelectedTables.delete(tableName);
    setSelectedTables(newSelectedTables);
    
    // Remove column info for this table
    setSelectedColumns(prev => {
      const updated = { ...prev };
      delete updated[tableName];
      return updated;
    });
    
    // Update last selected table logic
    if (lastSelectedTable === tableName) {
      // If we're removing the last selected table, set the previous one as last selected
      const remainingTables = Array.from(newSelectedTables);
      setLastSelectedTable(remainingTables.length > 0 ? remainingTables[remainingTables.length - 1] : null);
    }
    
    // IMMEDIATE CLEANUP: Remove children of the deleted table
    const hierarchyForRemaining = analyzeChildHierarchy(newSelectedTables);
    const validChildren = new Set();
    hierarchyForRemaining.forEach(h => {
      h.allDescendants.forEach(descendant => {
        validChildren.add(descendant);
      });
    });
    
    // Update children to only include valid ones
    setSelectedChildren(validChildren);
    
    // IMMEDIATE FILTER UPDATE: Update ERD immediately
    const visibleTables = [...newSelectedTables, ...validChildren];
    const newLastSelected = lastSelectedTable === tableName 
      ? (Array.from(newSelectedTables)[0] || null)
      : lastSelectedTable;
    
    onTableFilter(visibleTables.length > 0 ? [...new Set(visibleTables)] : null, newLastSelected);
  }, [selectedTables, lastSelectedTable, analyzeChildHierarchy, onTableFilter]);

  // Handle search input change
  const handleSearchChange = useCallback((e) => {
    const value = e.target.value;
    setSearchQuery(value);
    setIsAddDropdownOpen(value.length > 0);
  }, []);

  // Handle bulk hide/show of all direct children
  const handleHideDirectChildren = useCallback((shouldHide) => {
    setHideDirectChildren(shouldHide);
    
    if (shouldHide) {
      // Remove ALL direct children and their hierarchies
      setSelectedChildren(new Set()); // Clear all children
      
      // Update visible tables immediately - only show selected parent tables
      const visibleTables = Array.from(selectedTables);
      onTableFilter([...new Set(visibleTables)], lastSelectedTable);
    } else {
      // Restore all children based on current hierarchy state
      const newSelectedChildren = new Set();
      
      if (hideNestedChildren) {
        // Only restore direct children
        hierarchyData.forEach(hierarchy => {
          hierarchy.children.forEach(child => {
            newSelectedChildren.add(child.table);
          });
        });
      } else {
        // Restore all descendants
        hierarchyData.forEach(hierarchy => {
          hierarchy.allDescendants.forEach(descendant => {
            newSelectedChildren.add(descendant);
          });
        });
      }
      
      setSelectedChildren(newSelectedChildren);
      
      // Update visible tables immediately
      const visibleTables = Array.from(selectedTables);
      newSelectedChildren.forEach(child => visibleTables.push(child));
      onTableFilter([...new Set(visibleTables)], lastSelectedTable);
    }
  }, [hierarchyData, selectedTables, onTableFilter, lastSelectedTable, hideNestedChildren]);

  // Handle bulk hide/show of nested children (grandchildren and deeper)
  const handleHideNestedChildren = useCallback((shouldHide) => {
    setHideNestedChildren(shouldHide);
    
    if (shouldHide) {
      // Remove all nested children (depth > 0) from selectedChildren
      const newSelectedChildren = new Set();
      
      // Keep only direct children (depth 0)
      hierarchyData.forEach(hierarchy => {
        hierarchy.children.forEach(child => {
          // Only keep direct children (depth 0)
          newSelectedChildren.add(child.table);
        });
      });
      
      setSelectedChildren(newSelectedChildren);
      
      // Update visible tables immediately
      const visibleTables = Array.from(selectedTables);
      newSelectedChildren.forEach(child => visibleTables.push(child));
      onTableFilter([...new Set(visibleTables)], lastSelectedTable);
    } else {
      // Restore all hierarchy children
      const newSelectedChildren = new Set();
      
      // Add all descendants back
      hierarchyData.forEach(hierarchy => {
        hierarchy.allDescendants.forEach(descendant => {
          newSelectedChildren.add(descendant);
        });
      });
      
      setSelectedChildren(newSelectedChildren);
      
      // Update visible tables immediately
      const visibleTables = Array.from(selectedTables);
      newSelectedChildren.forEach(child => visibleTables.push(child));
      onTableFilter([...new Set(visibleTables)], lastSelectedTable);
    }
  }, [hierarchyData, selectedTables, onTableFilter, lastSelectedTable]);
  const handleChildToggle = useCallback((childTable) => {
    const newSelectedChildren = new Set(selectedChildren);
    
    if (newSelectedChildren.has(childTable)) {
      // Unchecking - remove this child and ALL its descendants
      newSelectedChildren.delete(childTable);
      
      // Find and remove all descendants of this child recursively
      const removeAllDescendants = (tableName) => {
        hierarchyData.forEach(hierarchy => {
          const findAndRemoveRecursively = (children) => {
            children.forEach(child => {
              if (child.table === tableName) {
                // Found the table, remove all its children
                if (child.children.length > 0) {
                  child.children.forEach(grandchild => {
                    newSelectedChildren.delete(grandchild.table);
                    removeAllDescendants(grandchild.table); // Recursively remove deeper levels
                  });
                }
              } else if (child.children.length > 0) {
                // Continue searching in nested children
                findAndRemoveRecursively(child.children);
              }
            });
          };
          findAndRemoveRecursively(hierarchy.children);
        });
      };
      
      // Remove all descendants of the unchecked child
      removeAllDescendants(childTable);
      
    } else {
      // Checking - add this child (but don't auto-add its descendants)
      newSelectedChildren.add(childTable);
    }
    
    setSelectedChildren(newSelectedChildren);
    
    // Update visible tables
    const visibleTables = Array.from(selectedTables);
    newSelectedChildren.forEach(child => visibleTables.push(child));
    onTableFilter([...new Set(visibleTables)], lastSelectedTable);
  }, [selectedChildren, selectedTables, hierarchyData, onTableFilter, lastSelectedTable]);

  // Render child hierarchy with indentation
  const renderChildHierarchy = useCallback((children, depth, parentTable = '') => {
    return children.map((child, index) => (
      <div key={`${parentTable}-${child.table}-${child.fromColumn}-${child.toColumn}-${index}`} className={`hierarchy-item hierarchy-depth-${Math.min(depth, 3)}`}>
        <label className="filter-table-item">
          <input
            type="checkbox"
            checked={selectedChildren.has(child.table)}
            onChange={() => handleChildToggle(child.table)}
          />
          <div className="filter-table-info">
            <span 
              className="filter-table-name"
              title={child.table} // Tooltip with full table name
            >
              {child.table}
            </span>
            <span 
              className="filter-table-context"
              title={`${child.fromColumn} → ${child.toColumn}`} // Tooltip with full relationship
            >
              {child.fromColumn} → {child.toColumn}
            </span>
          </div>
        </label>
        {child.children.length > 0 && renderChildHierarchy(child.children, depth + 1, child.table)}
      </div>
    ));
  }, [selectedChildren, handleChildToggle]);

  // Simplified effect - only handle hierarchy analysis for display purposes
  useEffect(() => {
    if (selectedTables.size > 0) {
      // Analyze child hierarchy for display in dropdown
      const hierarchy = analyzeChildHierarchy(selectedTables);
      
      // Check if there are nested children, if not, reset the checkbox
      const hasNested = hierarchy.some(h => 
        h.children.some(child => child.children.length > 0)
      );
      
      if (!hasNested && hideNestedChildren) {
        setHideNestedChildren(false); // Reset nested checkbox if no nested children
      }
      
      // Handle direct children hiding
      if (hideDirectChildren) {
        setSelectedChildren(new Set()); // Keep all children hidden
      } else if (hideNestedChildren && hasNested) {
        // If hideNestedChildren is enabled, automatically filter out nested children
        const directChildrenOnly = new Set();
        hierarchy.forEach(h => {
          h.children.forEach(child => {
            // Only keep direct children (depth 0)
            directChildrenOnly.add(child.table);
          });
        });
        setSelectedChildren(directChildrenOnly);
      }
    } else {
      // No tables selected, reset everything
      setSelectedChildren(new Set());
      setHideNestedChildren(false); // Reset nested checkbox when no tables selected
      setHideDirectChildren(false); // Reset direct checkbox when no tables selected
      onTableFilter(null, null);
    }
  }, [selectedTables, analyzeChildHierarchy, onTableFilter, hideNestedChildren, hideDirectChildren]);

  return (
    <div className={`erd-header ${isSchemaCollapsed ? 'schema-collapsed' : ''}`}>
      <div className="erd-header-content">
        {/* Search Section - Carousel Style */}
        <div className="erd-search-section">
          <div className="table-carousel-container">
            {/* Left Arrow */}
            <button 
              className="carousel-arrow carousel-arrow-left"
              onClick={() => scrollCarousel('left')}
              disabled={!canScrollLeft}
              aria-label="Scroll left"
              title="Scroll table chips left"
            >
              ‹
            </button>

            {/* Selected Tables Carousel */}
            <div className="table-carousel">
              <div className="table-carousel-track" ref={carouselRef}>
                {Array.from(selectedTables).map(tableName => (
                  <div 
                    key={tableName} 
                    className={`carousel-table-chip ${tableName === lastSelectedTable ? 'active' : ''}`}
                    onClick={() => handleChipClick(tableName)}
                    title={selectedColumns[tableName] ? `${tableName}.${selectedColumns[tableName]}` : tableName}
                  >
                    <span className="carousel-chip-text">
                      {selectedColumns[tableName] ? `${tableName}.${selectedColumns[tableName]}` : tableName}
                    </span>
                    <button
                      className="carousel-chip-remove"
                      onClick={(e) => {
                        e.stopPropagation(); // Prevent chip click when removing
                        handleTableRemove(tableName);
                      }}
                      aria-label={`Remove ${tableName}`}
                      title={`Remove ${tableName}`} // Add tooltip to remove button
                    >
                      ×
                    </button>
                  </div>
                ))}
                {selectedTables.size === 0 && (
                  <div className="carousel-placeholder">
                    Search Here For Tables And Columns....
                  </div>
                )}
              </div>
            </div>

            {/* Right Arrow */}
            <button 
              className="carousel-arrow carousel-arrow-right"
              onClick={() => scrollCarousel('right')}
              disabled={!canScrollRight}
              aria-label="Scroll right"
              title="Scroll table chips right"
            >
              ›
            </button>

            {/* Add Button */}
            <button 
              className="carousel-add-button"
              onClick={() => setIsAddDropdownOpen(!isAddDropdownOpen)}
              aria-label="Search tables"
              title="Search and add tables to ERD"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" style={{width: '16px', height: '16px'}}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
              </svg>
            </button>

            {/* Dropdown Button */}
            <button 
              className="carousel-dropdown-button"
              onClick={() => setIsManageDropdownOpen(!isManageDropdownOpen)}
              disabled={selectedTables.size === 0}
              aria-label="Manage selected tables"
              title="Manage selected tables"
            >
              ▼
            </button>
          </div>

          {/* Add Table Dropdown */}
          {isAddDropdownOpen && (
            <div className="carousel-add-dropdown">
              <input
                type="text"
                placeholder="Search tables or columns..."
                value={searchQuery}
                onChange={handleSearchChange}
                className="carousel-search-input"
                autoFocus
              />
              <div className="carousel-search-results">
                {/* Tables Section */}
                {filteredTableNames.filter(tableName => !selectedTables.has(tableName)).length > 0 && (
                  <>
                    <div className="search-results-header">
                      <img 
                        src="/table.png" 
                        alt="Tables" 
                        style={{ 
                          width: '16px', 
                          height: '16px',
                          marginRight: '4px'
                        }}
                      />
                      Tables ({filteredTableNames.filter(tableName => !selectedTables.has(tableName)).length})
                    </div>
                    {filteredTableNames
                      .filter(tableName => !selectedTables.has(tableName))
                      .map(tableName => (
                        <div
                          key={tableName}
                          className="carousel-search-item table-result"
                          onClick={() => handleTableSelectFromDropdown(tableName)}
                        >
                          {tableName}
                        </div>
                      ))}
                  </>
                )}
                
                {/* Columns Section */}
                {filteredColumns.length > 0 && (
                  <>
                    <div className="search-results-header">
                      <img 
                        src="/column.png" 
                        alt="Columns" 
                        style={{ 
                          width: '16px', 
                          height: '16px',
                          marginRight: '4px'
                        }}
                      />
                      Columns ({filteredColumns.length})
                    </div>
                    {filteredColumns.map((col, index) => (
                      <div
                        key={`${col.tableName}-${col.columnName}-${index}`}
                        className="carousel-search-item column-result"
                        onClick={() => handleColumnSelect(col)}
                      >
                        <span className="column-table-name">{col.tableName}</span>
                        <span className="column-separator">.</span>
                        <span className="column-name">{col.columnName}</span>
                        <span className="column-type">({col.columnType})</span>
                        {col.isPK && <span className="badge-pk">PK</span>}
                        {col.isFK && <span className="badge-fk">FK</span>}
                        {col.isUnique && <span className="badge-unique">UQ</span>}
                      </div>
                    ))}
                  </>
                )}
                
                {/* No Results */}
                {filteredTableNames.filter(tableName => !selectedTables.has(tableName)).length === 0 && 
                 filteredColumns.length === 0 && 
                 searchQuery && (
                  <div className="no-results">No tables or columns found</div>
                )}
              </div>
            </div>
          )}

          {/* Manage Tables Dropdown */}
          {isManageDropdownOpen && selectedTables.size > 0 && (
            <div className="carousel-manage-dropdown">
              <div className="carousel-manage-header">Selected Tables ({selectedTables.size})</div>
              <div className="carousel-manage-list">
                {Array.from(selectedTables).map(tableName => (
                  <div key={tableName} className="carousel-manage-item">
                    <span 
                      className={`carousel-manage-name ${tableName === lastSelectedTable ? 'active' : ''}`}
                      onClick={() => handleChipClick(tableName)}
                      style={{ cursor: 'pointer' }}
                      title={selectedColumns[tableName] ? `Click to highlight ${tableName}.${selectedColumns[tableName]} in ERD` : `Click to highlight ${tableName} in ERD`}
                    >
                      {selectedColumns[tableName] ? `${tableName}.${selectedColumns[tableName]}` : tableName}
                    </span>
                    <button
                      className="carousel-manage-remove"
                      onClick={() => handleTableRemove(tableName)}
                      aria-label={`Remove ${tableName}`}
                    >
                      ×
                    </button>
                  </div>
                ))}
                <button 
                  className="carousel-clear-all"
                  onClick={handleClearAll}
                >
                  Clear All
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Filter Section */}
        <div className="erd-filter-section">
          {selectedTables.size > 0 && displayHierarchyData.length > 0 && (
            <>
              {/* Child Tables with Hierarchy */}
              <div className="filter-dropdown">
                <div className="filter-dropdown-header" onClick={() => setChildrenExpanded(!childrenExpanded)}>
                  <span className="filter-dropdown-title">
                    Children ({showDirectChildrenOnly 
                      ? displayHierarchyData.reduce((total, h) => total + h.children.length, 0)
                      : displayHierarchyData.reduce((total, h) => total + h.allDescendants.length, 0)
                    })
                  </span>
                  <button className="filter-dropdown-toggle" aria-label={childrenExpanded ? 'Collapse children' : 'Expand children'}>
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                      <path d={childrenExpanded ? "M2 4 L6 8 L10 4" : "M4 2 L8 6 L4 10"} stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                </div>
                {childrenExpanded && (
                  <div className="filter-dropdown-content">
                    {/* Toggle Buttons with Associated Checkboxes */}
                    <div className="hierarchy-toggle-container">
                      <div className="toggle-group">
                        <input
                          type="checkbox"
                          className="hide-nested-checkbox"
                          checked={!hideNestedChildren}
                          disabled={!hasNestedChildren || hideDirectChildren}
                          onChange={(e) => handleHideNestedChildren(!e.target.checked)}
                          title={hasNestedChildren ? "Show/hide nested children (grandchildren and deeper)" : "No nested children to show"}
                        />
                        <button 
                          className={`hierarchy-toggle-btn ${!showDirectChildrenOnly ? 'active' : ''}`}
                          onClick={() => setShowDirectChildrenOnly(false)}
                        >
                          Full Hierarchy
                        </button>
                      </div>
                      <div className="toggle-group">
                        <input
                          type="checkbox"
                          className="hide-direct-checkbox"
                          checked={!hideDirectChildren}
                          onChange={(e) => handleHideDirectChildren(!e.target.checked)}
                          title="Show/hide all direct children"
                        />
                        <button 
                          className={`hierarchy-toggle-btn ${showDirectChildrenOnly ? 'active' : ''}`}
                          onClick={() => setShowDirectChildrenOnly(true)}
                        >
                          Direct Children
                        </button>
                      </div>
                    </div>
                    <div className="filter-table-list">
                      {displayHierarchyData.map(hierarchy => (
                        <div key={hierarchy.parentTable} className="hierarchy-group">
                          <div className="hierarchy-parent-label">
                            Children of {hierarchy.parentTable}:
                          </div>
                          {renderChildHierarchy(hierarchy.children, 0, hierarchy.parentTable)}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Legend Section */}
        <div className="erd-legend-section">
          {/* Show All Tables button - hidden for now, keep code for future use
          <button
            className="show-all-button"
            onClick={handleShowAll}
            title="Show all tables"
          >
            Show All Tables
          </button>
          */}
          <Legend isInHeader={true} />
        </div>
      </div>
    </div>
  );
};