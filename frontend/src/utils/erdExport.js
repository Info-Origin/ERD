import { toPng } from 'html-to-image';

/**
 * Export ERD diagram to PDF - Server-side only
 * Uses html-to-image to capture diagram, then sends to backend for PDF generation
 * Supports 200+ tables by capturing the entire transformed viewport
 */

// Quality scale factors
const QUALITY_SCALES = {
  low: 1,
  medium: 1.5,
  high: 2,
  ultra: 3
};

/**
 * Main export function - Server-side only for consistency and reliability
 */
export const exportERDToPDF = async (options, progressCallback) => {
  const {
    schemaName = 'schema'
  } = options;

  try {
    const reactFlowInstance = window.reactFlowInstance;
    
    if (!reactFlowInstance) {
      throw new Error('React Flow instance not available. Please try again.');
    }

    // Server-side export only
    return await exportViaServer(options, progressCallback);

  } catch (error) {
    console.error('Export error:', error);
    await cleanupAfterExport();
    
    // Provide clear, user-friendly error messages
    if (error.message.includes('Failed to fetch') || error.message.includes('fetch')) {
      throw new Error('Cannot connect to server. Please ensure the backend is running on port 4000 and try again.');
    } else if (error.message.includes('timeout')) {
      throw new Error('Export timed out. The diagram might be too large. Please try again.');
    } else if (error.message.includes('React Flow')) {
      throw new Error('Diagram not ready. Please wait a moment and try again.');
    } else {
      throw new Error('Unable to generate PDF at this time. Please try again later.');
    }
  }
};

/**
 * Server-side export - Captures diagram and sends to backend for PDF generation
 * Handles large diagrams (100+ tables) without browser limitations
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
      throw new Error('Failed to capture diagram. Please try again.');
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
        'Content-Type': 'application/json'
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
      throw new Error(`Server returned error: ${response.status}. Please try again later.`);
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
    throw error; // Re-throw to be handled by main function
  }
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
