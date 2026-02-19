import { jsPDF } from 'jspdf';
import { toPng, toSvg } from 'html-to-image';

/**
 * Export ERD diagram to PDF with comprehensive edge case handling
 * Uses html-to-image library which works better with React Flow
 * Supports 200+ tables by capturing the entire transformed viewport
 */

// Page size configurations (in points: 1 point = 1/72 inch)
const PAGE_SIZES = {
  a4: { width: 595, height: 842 },
  a3: { width: 842, height: 1191 },
  letter: { width: 612, height: 792 },
  legal: { width: 612, height: 1008 }
};

// Quality scale factors
const QUALITY_SCALES = {
  low: 1,
  medium: 1.5,
  high: 2,
  ultra: 3
};

/**
 * Main export function - ALL exports use server-side generation
 */
export const exportERDToPDF = async (options, progressCallback) => {
  const {
    pageSize = 'a4',
    orientation = 'auto',
    quality = 'high',
    includeAllTables = true,
    includeUserCreated = true,
    format = 'pdf',
    schemaName = 'schema'
  } = options;

  try {
    const reactFlowInstance = window.reactFlowInstance;
    
    if (!reactFlowInstance) {
      throw new Error('React Flow instance not available');
    }

    // Always use server-side export for consistency and reliability
    return await exportViaServer(options, progressCallback);

  } catch (error) {
    console.error('Export error:', error);
    await cleanupAfterExport();
    throw error;
  }
};

/**
 * Server-side export (for 100+ tables)
 * Captures actual DOM as image, then sends to server for PDF conversion
 */
const exportViaServer = async (options, progressCallback) => {
  const { schemaName = 'schema', format = 'pdf' } = options;
  
  try {
    // Step 1: Prepare diagram (10%)
    progressCallback(10, 'Preparing diagram...');
    await prepareForExport(options.includeAllTables);

    // Step 2: Capture as image (40%)
    progressCallback(40, 'Capturing diagram...');
    const canvas = await captureAsCanvas(options.quality);

    if (!canvas) {
      throw new Error('Failed to capture diagram');
    }

    // Step 3: Convert canvas to base64
    progressCallback(50, 'Converting to image...');
    const imageDataUrl = canvas.toDataURL('image/png');
    
    // Step 4: Send to server (60%)
    progressCallback(60, 'Sending to server...');
    
    // Use backend URL from environment or default
    const backendURL = import.meta.env.VITE_API_BASE_URL?.replace('/api', '') || 'http://localhost:4000';
    
    const response = await fetch(`${backendURL}/api/export/pdf`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({
        imageData: imageDataUrl,
        options: {
          ...options,
          width: canvas.width,
          height: canvas.height
        }
      }),
      // Increase timeout for large diagrams (5 minutes)
      signal: AbortSignal.timeout(300000)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Server export failed:', response.status, errorText);
      throw new Error(`Server export failed: ${response.status}`);
    }

    // Step 5: Download (80%)
    progressCallback(80, 'Downloading PDF...');
    
    const blob = await response.blob();
    
    // Step 6: Save file (95%)
    progressCallback(95, 'Saving file...');
    
    const timestamp = new Date().toISOString().split('T')[0];
    const extension = format === 'svg' ? 'png' : 'pdf';
    const filename = `ERD_${schemaName}_${timestamp}.${extension}`;
    
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    // Step 7: Cleanup (100%)
    progressCallback(100, 'Export complete!');
    await cleanupAfterExport();

  } catch (error) {
    console.error('Server export error:', error);
    await cleanupAfterExport();
    // Fallback to client-side export
    progressCallback(50, 'Server export failed, using client-side...');
    return await exportViaClient(options, progressCallback);
  }
};

/**
 * Client-side export (for <100 tables)
 */
const exportViaClient = async (options, progressCallback) => {
  const {
    pageSize = 'a4',
    orientation = 'auto',
    quality = 'high',
    format = 'pdf',
    schemaName = 'schema'
  } = options;

  // Step 1: Prepare the diagram (10%)
  progressCallback(10, 'Preparing diagram...');
  await prepareForExport(options.includeAllTables);

  // Step 2: Capture as canvas (40%)
  progressCallback(40, 'Capturing diagram...');
  const canvas = await captureAsCanvas(quality);

  if (!canvas) {
    throw new Error('Failed to capture diagram');
  }

  // Step 3: Export based on format (70%)
  progressCallback(70, `Generating ${format.toUpperCase()}...`);
  
  if (format === 'svg') {
    await exportToPNG(canvas, schemaName, progressCallback);
  } else {
    await exportToPDF(canvas, {
      pageSize,
      orientation,
      quality,
      schemaName
    }, progressCallback);
  }

  // Step 4: Cleanup (90%)
  progressCallback(90, 'Cleaning up...');
  await cleanupAfterExport();

  // Step 5: Complete (100%)
  progressCallback(100, 'Export complete!');
};

/**
 * Prepare diagram for export
 * - Hide UI elements (minimap, controls, toolbars)
 * - Clear temporary highlights
 * - Fit view to show all content
 */
const prepareForExport = async (includeAllTables) => {
  // Hide UI elements
  const elementsToHide = [
    '.draggable-minimap',
    '.canvas-controls',
    '.erd-toolbar',
    '.relationship-toolbar',
    '.react-flow__controls',
    '.react-flow__attribution'
  ];

  elementsToHide.forEach(selector => {
    const element = document.querySelector(selector);
    if (element) {
      element.style.display = 'none';
      element.setAttribute('data-hidden-for-export', 'true');
    }
  });

  // CRITICAL: Fit all content into view before capturing
  // This ensures we capture the entire diagram, not just the visible viewport
  const reactFlow = document.querySelector('.react-flow');
  if (reactFlow && window.reactFlowInstance) {
    // Use React Flow's fitView to show all nodes
    await window.reactFlowInstance.fitView({ 
      padding: 0.1,
      duration: 0 // Instant, no animation
    });
  }

  // Wait for fonts to load
  if (document.fonts && document.fonts.ready) {
    await document.fonts.ready;
  }

  // Longer delay to ensure layout is stable after fitView
  await new Promise(resolve => setTimeout(resolve, 500));
};

/**
 * Capture the React Flow viewport as high-quality image
 * Uses React Flow instance to get proper node bounds
 */
const captureAsCanvas = async (quality) => {
  const reactFlowInstance = window.reactFlowInstance;
  
  if (!reactFlowInstance) {
    throw new Error('React Flow instance not available');
  }

  // Get the viewport element
  const viewportElement = document.querySelector('.react-flow__viewport');
  
  if (!viewportElement) {
    throw new Error('React Flow viewport not found');
  }

  // Get all nodes from React Flow
  const nodes = reactFlowInstance.getNodes();
  
  if (nodes.length === 0) {
    throw new Error('No nodes found in diagram');
  }

  // Calculate bounds of all nodes
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

  nodes.forEach(node => {
    const x = node.position.x;
    const y = node.position.y;
    const width = node.width || 300; // Default width if not set
    const height = node.height || 200; // Default height if not set

    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + width);
    maxY = Math.max(maxY, y + height);
  });

  // Add padding
  const padding = 100;
  const imageWidth = (maxX - minX) + (padding * 2);
  const imageHeight = (maxY - minY) + (padding * 2);

  // Get quality scale
  const scale = QUALITY_SCALES[quality] || 2;

  // Get current viewport transform
  const viewport = reactFlowInstance.getViewport();

  // Calculate the transform needed to show all content
  const offsetX = -minX + padding;
  const offsetY = -minY + padding;

  // Capture using html-to-image with proper transform
  const dataUrl = await toPng(viewportElement, {
    backgroundColor: '#ffffff',
    width: imageWidth,
    height: imageHeight,
    pixelRatio: scale,
    style: {
      width: `${imageWidth}px`,
      height: `${imageHeight}px`,
      transform: `translate(${offsetX}px, ${offsetY}px) scale(1)`
    }
  });

  // Convert data URL to canvas
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = imageWidth * scale;
      canvas.height = imageHeight * scale;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      resolve(canvas);
    };
    img.onerror = reject;
    img.src = dataUrl;
  });
};

/**
 * Calculate bounds of all content
 */
const calculateBounds = (container) => {
  const nodes = container.querySelectorAll('.react-flow__node');
  
  let minX = Infinity, minY = Infinity;
  let maxX = -Infinity, maxY = -Infinity;

  nodes.forEach(node => {
    const transform = node.style.transform;
    const match = transform.match(/translate\(([^,]+),\s*([^)]+)\)/);
    
    if (match) {
      const x = parseFloat(match[1]);
      const y = parseFloat(match[2]);
      const width = node.offsetWidth;
      const height = node.offsetHeight;

      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x + width);
      maxY = Math.max(maxY, y + height);
    }
  });

  // Add padding
  const padding = 50;
  
  return {
    x: minX - padding,
    y: minY - padding,
    width: (maxX - minX) + (padding * 2),
    height: (maxY - minY) + (padding * 2)
  };
};

/**
 * Process SVG for better quality
 */
const processSVG = async (svgElement, quality) => {
  const scale = QUALITY_SCALES[quality] || 2;

  // Apply quality scaling
  const currentWidth = parseFloat(svgElement.getAttribute('width'));
  const currentHeight = parseFloat(svgElement.getAttribute('height'));

  svgElement.setAttribute('width', currentWidth * scale);
  svgElement.setAttribute('height', currentHeight * scale);

  // Inline all styles
  inlineStyles(svgElement);

  return svgElement;
};

/**
 * Inline CSS styles into SVG elements
 */
const inlineStyles = (svgElement) => {
  const elements = svgElement.querySelectorAll('*');
  
  elements.forEach(element => {
    const computedStyle = window.getComputedStyle(element);
    const styleString = Array.from(computedStyle).reduce((str, property) => {
      return `${str}${property}:${computedStyle.getPropertyValue(property)};`;
    }, '');
    
    element.setAttribute('style', styleString);
  });
};

/**
 * Export to PDF
 */
const exportToPDF = async (canvas, options, progressCallback) => {
  const { pageSize, orientation, quality, schemaName } = options;

  progressCallback(80, 'Creating PDF document...');

  const imgWidth = canvas.width;
  const imgHeight = canvas.height;
  const aspectRatio = imgWidth / imgHeight;

  // Determine orientation
  let finalOrientation = orientation;
  if (orientation === 'auto') {
    finalOrientation = aspectRatio > 1 ? 'landscape' : 'portrait';
  }

  // Get page dimensions in pixels (at 96 DPI)
  let pdfWidth, pdfHeight;
  
  if (pageSize === 'custom') {
    // Fit to content - use canvas dimensions
    // Convert pixels to points (1 point = 1/72 inch, 1 pixel = 1/96 inch)
    pdfWidth = (imgWidth * 72) / 96;
    pdfHeight = (imgHeight * 72) / 96;
  } else {
    const pageDimensions = PAGE_SIZES[pageSize];
    if (finalOrientation === 'landscape') {
      pdfWidth = pageDimensions.height;
      pdfHeight = pageDimensions.width;
    } else {
      pdfWidth = pageDimensions.width;
      pdfHeight = pageDimensions.height;
    }
  }

  // Create PDF
  const pdf = new jsPDF({
    orientation: finalOrientation,
    unit: 'pt',
    format: pageSize === 'custom' ? [pdfWidth, pdfHeight] : pageSize
  });

  progressCallback(85, 'Adding image to PDF...');

  // Convert canvas to image
  const imgData = canvas.toDataURL('image/png');

  // Calculate dimensions to fit page
  let finalWidth, finalHeight;
  
  if (pageSize === 'custom') {
    finalWidth = pdfWidth;
    finalHeight = pdfHeight;
  } else {
    // Scale to fit page while maintaining aspect ratio
    const pageAspectRatio = pdfWidth / pdfHeight;
    
    if (aspectRatio > pageAspectRatio) {
      // Image is wider - fit to width
      finalWidth = pdfWidth;
      finalHeight = pdfWidth / aspectRatio;
    } else {
      // Image is taller - fit to height
      finalHeight = pdfHeight;
      finalWidth = pdfHeight * aspectRatio;
    }
  }

  // Center the image on the page
  const xOffset = (pdfWidth - finalWidth) / 2;
  const yOffset = (pdfHeight - finalHeight) / 2;

  // Add image to PDF
  pdf.addImage(imgData, 'PNG', xOffset, yOffset, finalWidth, finalHeight);

  progressCallback(95, 'Saving file...');

  // Generate filename
  const timestamp = new Date().toISOString().split('T')[0];
  const filename = `ERD_${schemaName}_${timestamp}.pdf`;

  // Save PDF
  pdf.save(filename);
};

/**
 * Export to PNG file
 */
const exportToPNG = async (canvas, schemaName, progressCallback) => {
  progressCallback(80, 'Preparing PNG file...');

  // Convert canvas to blob
  canvas.toBlob((blob) => {
    progressCallback(95, 'Saving file...');

    // Generate filename
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `ERD_${schemaName}_${timestamp}.png`;

    // Download
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, 'image/png');
};

/**
 * Cleanup after export
 * - Restore hidden UI elements
 * - Clear temporary states
 */
const cleanupAfterExport = async () => {
  // Restore hidden elements
  const hiddenElements = document.querySelectorAll('[data-hidden-for-export="true"]');
  
  hiddenElements.forEach(element => {
    element.style.display = '';
    element.removeAttribute('data-hidden-for-export');
  });

  // Small delay to ensure cleanup is complete
  await new Promise(resolve => setTimeout(resolve, 100));
};
