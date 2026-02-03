import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { Legend } from "./Legend";
import { useVirtualSchema } from "../../context/VirtualSchemaContext";
import "./ERDHeader.css";

export const ERDHeader = ({ onTableFilter, isSchemaCollapsed }) => {
  const { workingSchema } = useVirtualSchema();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTables, setSelectedTables] = useState(new Set()); // Changed to Set for multiple tables
  const [lastSelectedTable, setLastSelectedTable] = useState(null); // Track most recently selected table
  const [selectedParents, setSelectedParents] = useState(new Set());
  const [selectedChildren, setSelectedChildren] = useState(new Set());
  const [isAddDropdownOpen, setIsAddDropdownOpen] = useState(false);
  const [isManageDropdownOpen, setIsManageDropdownOpen] = useState(false);
  const [parentsExpanded, setParentsExpanded] = useState(true);
  const [childrenExpanded, setChildrenExpanded] = useState(true);
  const carouselRef = useRef(null);

  // Get all table names for autocomplete
  const tableNames = useMemo(() => {
    if (!workingSchema?.tables) return [];
    return Object.keys(workingSchema.tables).sort();
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
    
    setIsAddDropdownOpen(false);
    setSearchQuery("");
  }, [selectedTables]);

  // Handle clear all tables
  const handleClearAll = useCallback(() => {
    setSelectedTables(new Set());
    setSelectedParents(new Set());
    setSelectedChildren(new Set());
    setLastSelectedTable(null); // Clear last selected table
    setIsManageDropdownOpen(false);
    onTableFilter(null, null);
  }, [onTableFilter]);

  // Filter tables based on search query
  const filteredTableNames = useMemo(() => {
    if (!searchQuery) return tableNames;
    return tableNames.filter(name => 
      name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [tableNames, searchQuery]);

  // Analyze relationships for multiple tables with context
  const analyzeRelationships = useCallback((tableNames) => {
    if (!workingSchema?.relationships || !tableNames || tableNames.size === 0) {
      return { parents: [], children: [] };
    }

    const parentsMap = new Map(); // parent -> [selected tables that reference it]
    const childrenMap = new Map(); // child -> [selected tables it references]

    // Analyze relationships for all selected tables
    tableNames.forEach(tableName => {
      workingSchema.relationships.forEach(rel => {
        if (rel.fromTable === tableName && !tableNames.has(rel.toTable)) {
          // This table is the FK side (child), so toTable is parent
          if (!parentsMap.has(rel.toTable)) {
            parentsMap.set(rel.toTable, []);
          }
          parentsMap.get(rel.toTable).push(tableName);
        }
        if (rel.toTable === tableName && !tableNames.has(rel.fromTable)) {
          // This table is the PK side (parent), so fromTable is child
          if (!childrenMap.has(rel.fromTable)) {
            childrenMap.set(rel.fromTable, []);
          }
          childrenMap.get(rel.fromTable).push(tableName);
        }
      });
    });

    // Convert to arrays with context
    const parents = Array.from(parentsMap.entries()).map(([table, relatedTables]) => ({
      table,
      relatedTables: [...new Set(relatedTables)].sort()
    })).sort((a, b) => a.table.localeCompare(b.table));

    const children = Array.from(childrenMap.entries()).map(([table, relatedTables]) => ({
      table,
      relatedTables: [...new Set(relatedTables)].sort()
    })).sort((a, b) => a.table.localeCompare(b.table));

    return { parents, children };
  }, [workingSchema]);

  // Get current relationship data for all selected tables
  const relationshipData = useMemo(() => {
    if (selectedTables.size === 0) return { parents: [], children: [] };
    return analyzeRelationships(selectedTables);
  }, [selectedTables, analyzeRelationships]);

  // Get tables to show based on current selection and filters
  const getVisibleTables = useCallback(() => {
    if (selectedTables.size === 0) {
      // No tables selected, show all tables
      return tableNames;
    }

    const visibleTables = Array.from(selectedTables); // Always include selected tables

    // Add selected parent tables
    selectedParents.forEach(parent => {
      if (relationshipData.parents.includes(parent)) {
        visibleTables.push(parent);
      }
    });

    // Add selected child tables
    selectedChildren.forEach(child => {
      if (relationshipData.children.includes(child)) {
        visibleTables.push(child);
      }
    });

    return [...new Set(visibleTables)]; // Remove duplicates
  }, [selectedTables, selectedParents, selectedChildren, relationshipData, tableNames]);

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
    // Relationship analysis will be handled by useEffect
  }, [selectedTables]);

  // Handle table removal (remove chip)
  const handleTableRemove = useCallback((tableName) => {
    const newSelectedTables = new Set(selectedTables);
    newSelectedTables.delete(tableName);
    setSelectedTables(newSelectedTables);
    
    // Update last selected table logic
    if (lastSelectedTable === tableName) {
      // If we're removing the last selected table, set the previous one as last selected
      const remainingTables = Array.from(newSelectedTables);
      setLastSelectedTable(remainingTables.length > 0 ? remainingTables[remainingTables.length - 1] : null);
    }
    // Relationship analysis will be handled by useEffect
  }, [selectedTables, lastSelectedTable]);

  // Handle search input change
  const handleSearchChange = useCallback((e) => {
    const value = e.target.value;
    setSearchQuery(value);
    setIsAddDropdownOpen(value.length > 0);
  }, []);

  // Handle individual parent checkbox changes
  const handleParentToggle = useCallback((parentTable) => {
    const newSelectedParents = new Set(selectedParents);
    if (newSelectedParents.has(parentTable)) {
      newSelectedParents.delete(parentTable);
    } else {
      newSelectedParents.add(parentTable);
    }
    setSelectedParents(newSelectedParents);
    
    // Update visible tables
    const visibleTables = Array.from(selectedTables);
    newSelectedParents.forEach(parent => visibleTables.push(parent));
    selectedChildren.forEach(child => visibleTables.push(child));
    onTableFilter([...new Set(visibleTables)], lastSelectedTable);
  }, [selectedParents, selectedTables, selectedChildren, onTableFilter, lastSelectedTable]);

  // Handle individual child checkbox changes
  const handleChildToggle = useCallback((childTable) => {
    const newSelectedChildren = new Set(selectedChildren);
    if (newSelectedChildren.has(childTable)) {
      newSelectedChildren.delete(childTable);
    } else {
      newSelectedChildren.add(childTable);
    }
    setSelectedChildren(newSelectedChildren);
    
    // Update visible tables
    const visibleTables = Array.from(selectedTables);
    selectedParents.forEach(parent => visibleTables.push(parent));
    newSelectedChildren.forEach(child => visibleTables.push(child));
    onTableFilter([...new Set(visibleTables)], lastSelectedTable);
  }, [selectedChildren, selectedTables, selectedParents, onTableFilter, lastSelectedTable]);

  // Handle show all tables
  const handleShowAll = useCallback(() => {
    setSearchQuery("");
    setSelectedTables(new Set());
    setSelectedParents(new Set());
    setSelectedChildren(new Set());
    setLastSelectedTable(null); // Clear last selected table
    setIsAddDropdownOpen(false);
    setIsManageDropdownOpen(false);
    onTableFilter(null, null); // Show all tables
  }, [onTableFilter]);

  // Handle dropdown item click
  const handleDropdownItemClick = useCallback((tableName) => {
    handleTableSelect(tableName);
  }, [handleTableSelect]);

  // Handle input focus
  const handleInputFocus = useCallback(() => {
    if (searchQuery && filteredTableNames.length > 0) {
      setIsAddDropdownOpen(true);
    }
  }, [searchQuery, filteredTableNames.length]);

  // Handle input blur (with delay to allow dropdown clicks)
  const handleInputBlur = useCallback(() => {
    setTimeout(() => {
      setIsAddDropdownOpen(false);
    }, 200);
  }, []);

  // Effect to handle relationship analysis when selectedTables changes
  useEffect(() => {
    if (selectedTables.size > 0) {
      // Analyze relationships for all selected tables
      const { parents, children } = analyzeRelationships(selectedTables);
      const parentTables = parents.map(p => p.table);
      const childTables = children.map(c => c.table);
      setSelectedParents(new Set(parentTables));
      setSelectedChildren(new Set(childTables));
      
      // Apply filter with all relationships and highlight info
      const visibleTables = [...selectedTables, ...parentTables, ...childTables];
      onTableFilter([...new Set(visibleTables)], lastSelectedTable);
    } else {
      // No tables selected, reset everything
      setSelectedParents(new Set());
      setSelectedChildren(new Set());
      onTableFilter(null, null);
    }
  }, [selectedTables, analyzeRelationships, onTableFilter, lastSelectedTable]);

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
              disabled={selectedTables.size <= 1}
              aria-label="Scroll left"
            >
              ‹
            </button>

            {/* Selected Tables Carousel */}
            <div className="table-carousel">
              <div className="table-carousel-track" ref={carouselRef}>
                {Array.from(selectedTables).map(tableName => (
                  <div key={tableName} className="carousel-table-chip">
                    <span className="carousel-chip-text">{tableName}</span>
                    <button
                      className="carousel-chip-remove"
                      onClick={() => handleTableRemove(tableName)}
                      aria-label={`Remove ${tableName}`}
                    >
                      ×
                    </button>
                  </div>
                ))}
                {selectedTables.size === 0 && (
                  <div className="carousel-placeholder">
                    No tables selected
                  </div>
                )}
              </div>
            </div>

            {/* Right Arrow */}
            <button 
              className="carousel-arrow carousel-arrow-right"
              onClick={() => scrollCarousel('right')}
              disabled={selectedTables.size <= 1}
              aria-label="Scroll right"
            >
              ›
            </button>

            {/* Add Button */}
            <button 
              className="carousel-add-button"
              onClick={() => setIsAddDropdownOpen(!isAddDropdownOpen)}
              aria-label="Add table"
            >
              +
            </button>

            {/* Dropdown Button */}
            <button 
              className="carousel-dropdown-button"
              onClick={() => setIsManageDropdownOpen(!isManageDropdownOpen)}
              disabled={selectedTables.size === 0}
              aria-label="Manage selected tables"
            >
              ▼
            </button>
          </div>

          {/* Add Table Dropdown */}
          {isAddDropdownOpen && (
            <div className="carousel-add-dropdown">
              <input
                type="text"
                placeholder="Search tables..."
                value={searchQuery}
                onChange={handleSearchChange}
                className="carousel-search-input"
                autoFocus
              />
              {filteredTableNames.length > 0 && (
                <div className="carousel-search-results">
                  {filteredTableNames
                    .filter(tableName => !selectedTables.has(tableName))
                    .map(tableName => (
                    <div
                      key={tableName}
                      className="carousel-search-item"
                      onClick={() => handleTableSelectFromDropdown(tableName)}
                    >
                      {tableName}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Manage Tables Dropdown */}
          {isManageDropdownOpen && selectedTables.size > 0 && (
            <div className="carousel-manage-dropdown">
              <div className="carousel-manage-header">Selected Tables ({selectedTables.size})</div>
              <div className="carousel-manage-list">
                {Array.from(selectedTables).map(tableName => (
                  <div key={tableName} className="carousel-manage-item">
                    <span className="carousel-manage-name">{tableName}</span>
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
          {selectedTables.size > 0 && (
            <>
              {/* Parent Tables */}
              {relationshipData.parents.length > 0 && (
                <div className="filter-dropdown">
                  <div className="filter-dropdown-header" onClick={() => setParentsExpanded(!parentsExpanded)}>
                    <span className="filter-dropdown-title">Parents ({relationshipData.parents.length})</span>
                    <button className="filter-dropdown-toggle" aria-label={parentsExpanded ? 'Collapse parents' : 'Expand parents'}>
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                        <path d={parentsExpanded ? "M2 4 L6 8 L10 4" : "M4 2 L8 6 L4 10"} stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>
                  </div>
                  {parentsExpanded && (
                    <div className="filter-dropdown-content">
                      <div className="filter-table-list">
                        {relationshipData.parents.map(parentData => (
                          <label key={parentData.table} className="filter-table-item">
                            <input
                              type="checkbox"
                              checked={selectedParents.has(parentData.table)}
                              onChange={() => handleParentToggle(parentData.table)}
                            />
                            <div className="filter-table-info">
                              <span className="filter-table-name">{parentData.table}</span>
                              <span className="filter-table-context">
                                ← {parentData.relatedTables.join(', ')}
                              </span>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Child Tables */}
              {relationshipData.children.length > 0 && (
                <div className="filter-dropdown">
                  <div className="filter-dropdown-header" onClick={() => setChildrenExpanded(!childrenExpanded)}>
                    <span className="filter-dropdown-title">Children ({relationshipData.children.length})</span>
                    <button className="filter-dropdown-toggle" aria-label={childrenExpanded ? 'Collapse children' : 'Expand children'}>
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                        <path d={childrenExpanded ? "M2 4 L6 8 L10 4" : "M4 2 L8 6 L4 10"} stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>
                  </div>
                  {childrenExpanded && (
                    <div className="filter-dropdown-content">
                      <div className="filter-table-list">
                        {relationshipData.children.map(childData => (
                          <label key={childData.table} className="filter-table-item">
                            <input
                              type="checkbox"
                              checked={selectedChildren.has(childData.table)}
                              onChange={() => handleChildToggle(childData.table)}
                            />
                            <div className="filter-table-info">
                              <span className="filter-table-name">{childData.table}</span>
                              <span className="filter-table-context">
                                → {childData.relatedTables.join(', ')}
                              </span>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
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