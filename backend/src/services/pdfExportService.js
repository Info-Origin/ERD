import { chromium } from 'playwright';

/**
 * Server-side PDF export service using Playwright
 * Generates high-quality PDFs without browser limitations
 */

class PDFExportService {
  constructor() {
    this.browser = null;
    console.log('📄 PDF Export Service initialized');
  }

  /**
   * Initialize browser instance (reusable)
   */
  async initBrowser() {
    if (!this.browser) {
      console.log('🚀 Launching Playwright browser...');
      this.browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      console.log('✅ Browser launched successfully');
    }
    return this.browser;
  }

  /**
   * Generate PDF from captured image (EXACT SNAPSHOT)
   * This preserves all styling, relationships, and layout from React Flow
   */
  async generatePDFFromImage(imageDataUrl, options = {}) {
    console.log('📊 Starting PDF generation from image...');

    const {
      pageSize = 'a4',
      orientation = 'auto',
      width,
      height
    } = options;

    let page = null;

    try {
      // Initialize browser
      console.log('🌐 Initializing browser...');
      const browser = await this.initBrowser();
      page = await browser.newPage();
      console.log('📄 New page created');

      // Determine orientation based on image dimensions
      let finalOrientation = orientation;
      if (orientation === 'auto' && width && height) {
        finalOrientation = width > height ? 'landscape' : 'portrait';
      }

      // Build simple HTML with the captured image
      const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    @page {
      size: ${width}px ${height}px;
      margin: 0;
    }
    
    html, body {
      width: ${width}px;
      height: ${height}px;
      margin: 0;
      padding: 0;
      overflow: hidden;
    }

    img {
      width: 100%;
      height: 100%;
      display: block;
      object-fit: contain;
    }
  </style>
</head>
<body>
  <img src="${imageDataUrl}" alt="ERD Diagram" />
</body>
</html>
      `;

      // Set content
      console.log('📝 Setting page content...');
      await page.setContent(html, {
        waitUntil: 'networkidle',
        timeout: 60000
      });

      // Wait for image to load
      console.log('⏳ Waiting for image to load...');
      await page.waitForTimeout(1000);

      // Generate PDF
      console.log('🖨️ Generating PDF...');
      
      // Always use custom size to fit everything on one page
      const pdfBuffer = await page.pdf({
        format: undefined, // Don't use standard formats
        landscape: finalOrientation === 'landscape',
        printBackground: true,
        preferCSSPageSize: false,
        // Set exact dimensions to match canvas (fit everything on one page)
        width: width ? `${width}px` : '2000px',
        height: height ? `${height}px` : '1500px',
        scale: 1,
        margin: {
          top: '0mm',
          right: '0mm',
          bottom: '0mm',
          left: '0mm'
        }
      });

      console.log('✅ PDF generated successfully', {
        size: `${(pdfBuffer.length / 1024).toFixed(2)} KB`
      });

      return pdfBuffer;

    } catch (error) {
      console.error('❌ PDF generation error:', error);
      throw new Error(`Failed to generate PDF: ${error.message}`);
    } finally {
      if (page) {
        await page.close();
        console.log('🔒 Page closed');
      }
    }
  }

  /**
   * Generate PDF from ERD data
   */
  async generatePDF(erdData, options = {}) {
    console.log('📊 Starting PDF generation...', {
      nodeCount: erdData.nodes?.length || 0,
      edgeCount: erdData.edges?.length || 0,
      options
    });

    const {
      pageSize = 'a4',
      orientation = 'landscape',
      quality = 'high',
      schemaName = 'schema'
    } = options;

    let page = null;

    try {
      // Initialize browser
      console.log('🌐 Initializing browser...');
      const browser = await this.initBrowser();
      page = await browser.newPage();
      console.log('📄 New page created');

      // Set viewport based on quality
      const qualityScales = {
        low: 1,
        medium: 1.5,
        high: 2,
        ultra: 3
      };
      const scale = qualityScales[quality] || 2;

      // Build HTML content with ERD data
      console.log('🏗️ Building HTML content...');
      const html = this.buildERDHTML(erdData, scale);

      // Set content
      console.log('📝 Setting page content...');
      await page.setContent(html, {
        waitUntil: 'networkidle',
        timeout: 120000 // 2 minutes timeout for large diagrams
      });

      // Wait for rendering to complete (increased for large diagrams)
      console.log('⏳ Waiting for rendering...');
      await page.waitForTimeout(2000);

      // Generate PDF
      console.log('🖨️ Generating PDF...');
      const pdfBuffer = await page.pdf({
        format: pageSize === 'custom' ? undefined : pageSize,
        landscape: orientation === 'landscape',
        printBackground: true,
        preferCSSPageSize: pageSize === 'custom',
        scale: 1,
        margin: {
          top: '10mm',
          right: '10mm',
          bottom: '10mm',
          left: '10mm'
        }
      });

      console.log('✅ PDF generated successfully', {
        size: `${(pdfBuffer.length / 1024).toFixed(2)} KB`
      });

      return pdfBuffer;

    } catch (error) {
      console.error('❌ PDF generation error:', error);
      throw new Error(`Failed to generate PDF: ${error.message}`);
    } finally {
      if (page) {
        await page.close();
        console.log('🔒 Page closed');
      }
    }
  }

  /**
   * Build HTML content from ERD data
   */
  buildERDHTML(erdData, scale) {
    const { nodes, edges, viewport, theme = 'light' } = erdData;

    // Calculate bounds
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    
    nodes.forEach(node => {
      const x = node.position.x;
      const y = node.position.y;
      const width = node.width || 300;
      const height = node.height || 200;

      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x + width);
      maxY = Math.max(maxY, y + height);
    });

    const padding = 50;
    const totalWidth = (maxX - minX) + (padding * 2);
    const totalHeight = (maxY - minY) + (padding * 2);

    // Build HTML with inline styles
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: white;
      width: ${totalWidth}px;
      height: ${totalHeight}px;
      position: relative;
      overflow: hidden;
    }

    .erd-container {
      position: relative;
      width: 100%;
      height: 100%;
      transform: translate(${-minX + padding}px, ${-minY + padding}px);
    }

    .table-card {
      position: absolute;
      background: white;
      border: 2px solid #3b82f6;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      min-width: 250px;
    }

    .table-header {
      background: #3b82f6;
      color: white;
      padding: 10px 12px;
      font-weight: 600;
      font-size: 14px;
      border-radius: 6px 6px 0 0;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .table-body {
      padding: 8px 0;
    }

    .column-row {
      padding: 6px 12px;
      font-size: 12px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid #f0f0f0;
    }

    .column-row:last-child {
      border-bottom: none;
    }

    .column-name {
      font-weight: 500;
      color: #374151;
    }

    .column-type {
      color: #6b7280;
      font-size: 11px;
    }

    .pk-icon {
      color: #f59e0b;
      font-weight: bold;
      margin-right: 4px;
    }

    .fk-icon {
      color: #3b82f6;
      font-weight: bold;
      margin-right: 4px;
    }

    svg {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 0;
    }

    .relationship-line {
      stroke: #94a3b8;
      stroke-width: 1.5;
      fill: none;
    }

    .user-created-line {
      stroke: #1e40af;
      stroke-width: 2.5;
      fill: none;
    }
  </style>
</head>
<body>
  <div class="erd-container">
    <!-- SVG for relationships -->
    <svg width="${totalWidth}" height="${totalHeight}">
      ${this.buildEdgesSVG(edges, minX, minY, padding)}
    </svg>

    <!-- Table cards -->
    ${this.buildNodesHTML(nodes)}
  </div>
</body>
</html>
    `;
  }

  /**
   * Build SVG for relationship edges
   */
  buildEdgesSVG(edges, minX, minY, padding) {
    if (!edges || edges.length === 0) return '';

    return edges.map(edge => {
      const isUserCreated = edge.data?.isUserCreated || false;
      const className = isUserCreated ? 'user-created-line' : 'relationship-line';

      // Simple straight line for now
      return `
        <line 
          x1="${edge.sourceX - minX + padding}" 
          y1="${edge.sourceY - minY + padding}" 
          x2="${edge.targetX - minX + padding}" 
          y2="${edge.targetY - minY + padding}" 
          class="${className}"
        />
      `;
    }).join('');
  }

  /**
   * Build HTML for table nodes
   */
  buildNodesHTML(nodes) {
    if (!nodes || nodes.length === 0) return '';

    return nodes.map(node => {
      const { position, data } = node;
      const { tableName, columns } = data || {};
      
      // Handle columns - could be array or object
      let columnArray = [];
      if (Array.isArray(columns)) {
        columnArray = columns;
      } else if (columns && typeof columns === 'object') {
        // Convert object to array
        columnArray = Object.values(columns);
      }

      return `
        <div class="table-card" style="left: ${position.x}px; top: ${position.y}px;">
          <div class="table-header">
            <span>📊</span>
            <span>${tableName || 'Table'}</span>
          </div>
          <div class="table-body">
            ${columnArray.length > 0 ? columnArray.map(col => `
              <div class="column-row">
                <div class="column-name">
                  ${col.isPrimaryKey ? '<span class="pk-icon">🔑</span>' : ''}
                  ${col.isForeignKey ? '<span class="fk-icon">🔗</span>' : ''}
                  ${col.name || col.columnName || 'Column'}
                </div>
                <div class="column-type">${col.type || col.dataType || ''}</div>
              </div>
            `).join('') : '<div class="column-row"><div class="column-name">No columns</div></div>'}
          </div>
        </div>
      `;
    }).join('');
  }

  /**
   * Cleanup browser instance
   */
  async cleanup() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}

// Singleton instance
const pdfExportService = new PDFExportService();

// Cleanup on process exit
process.on('exit', () => {
  pdfExportService.cleanup();
});

export default pdfExportService;
