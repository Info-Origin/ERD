import { chromium, type Browser, type Page } from "playwright";
import type { ExportOptions, ERDData, ERDNode, ERDEdge } from "../types/index.js";

class PDFExportService {
  private browser: Browser | null = null;

  constructor() {
    console.log("📄 PDF Export Service initialized");
  }

  async initBrowser(): Promise<Browser> {
    if (!this.browser) {
      console.log("🚀 Launching Playwright browser...");
      this.browser = await chromium.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      });
      console.log("✅ Browser launched successfully");
    }
    return this.browser;
  }

  async generatePDFFromImage(
    imageDataUrl: string,
    options: ExportOptions = {}
  ): Promise<Buffer> {
    console.log("📊 Starting PDF generation from image...");

    const { orientation = "auto", width, height } = options;

    let page: Page | null = null;

    try {
      const browser = await this.initBrowser();
      page = await browser.newPage();

      let finalOrientation = orientation;
      if (orientation === "auto" && width && height) {
        finalOrientation = width > height ? "landscape" : "portrait";
      }

      const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    @page { size: ${width}px ${height}px; margin: 0; }
    html, body { width: ${width}px; height: ${height}px; margin: 0; padding: 0; overflow: hidden; }
    img { width: 100%; height: 100%; display: block; object-fit: contain; }
  </style>
</head>
<body>
  <img src="${imageDataUrl}" alt="ERD Diagram" />
</body>
</html>`;

      await page.setContent(html, { waitUntil: "networkidle", timeout: 60000 });
      await page.waitForTimeout(1000);

      const pdfBuffer = await page.pdf({
        format: undefined,
        landscape: finalOrientation === "landscape",
        printBackground: true,
        preferCSSPageSize: false,
        width: width ? `${width}px` : "2000px",
        height: height ? `${height}px` : "1500px",
        scale: 1,
        margin: { top: "0mm", right: "0mm", bottom: "0mm", left: "0mm" },
      });

      console.log("✅ PDF generated successfully", {
        size: `${(pdfBuffer.length / 1024).toFixed(2)} KB`,
      });

      return Buffer.from(pdfBuffer);
    } catch (error) {
      throw new Error(`Failed to generate PDF: ${(error as Error).message}`);
    } finally {
      if (page) {
        await page.close();
      }
    }
  }

  async generatePDF(erdData: ERDData, options: ExportOptions = {}): Promise<Buffer> {
    console.log("📊 Starting PDF generation...", {
      nodeCount: erdData.nodes?.length || 0,
      edgeCount: erdData.edges?.length || 0,
      options,
    });

    const {
      pageSize = "a4",
      orientation = "landscape",
      quality = "high",
    } = options;

    let page: Page | null = null;

    try {
      const browser = await this.initBrowser();
      page = await browser.newPage();

      const qualityScales: Record<string, number> = {
        low: 1,
        medium: 1.5,
        high: 2,
        ultra: 3,
      };
      const scale = qualityScales[quality] || 2;

      const html = this.buildERDHTML(erdData, scale);

      await page.setContent(html, { waitUntil: "networkidle", timeout: 120000 });
      await page.waitForTimeout(2000);

      const pdfBuffer = await page.pdf({
        format: pageSize === "custom" ? undefined : (pageSize as "a4" | "letter"),
        landscape: orientation === "landscape",
        printBackground: true,
        preferCSSPageSize: pageSize === "custom",
        scale: 1,
        margin: { top: "10mm", right: "10mm", bottom: "10mm", left: "10mm" },
      });

      return Buffer.from(pdfBuffer);
    } catch (error) {
      throw new Error(`Failed to generate PDF: ${(error as Error).message}`);
    } finally {
      if (page) {
        await page.close();
      }
    }
  }

  buildERDHTML(erdData: ERDData, _scale: number): string {
    const { nodes, edges } = erdData;

    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;

    nodes.forEach((node) => {
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
    const totalWidth = maxX - minX + padding * 2;
    const totalHeight = maxY - minY + padding * 2;

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: white; width: ${totalWidth}px; height: ${totalHeight}px; position: relative; overflow: hidden; }
    .erd-container { position: relative; width: 100%; height: 100%; transform: translate(${-minX + padding}px, ${-minY + padding}px); }
    .table-card { position: absolute; background: white; border: 2px solid #3b82f6; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); min-width: 250px; }
    .table-header { background: #3b82f6; color: white; padding: 10px 12px; font-weight: 600; font-size: 14px; border-radius: 6px 6px 0 0; }
    .table-body { padding: 8px 0; }
    .column-row { padding: 6px 12px; font-size: 12px; display: flex; justify-content: space-between; border-bottom: 1px solid #f0f0f0; }
    .column-row:last-child { border-bottom: none; }
    .column-name { font-weight: 500; color: #374151; }
    .column-type { color: #6b7280; font-size: 11px; }
    svg { position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 0; }
    .relationship-line { stroke: #94a3b8; stroke-width: 1.5; fill: none; }
    .user-created-line { stroke: #1e40af; stroke-width: 2.5; fill: none; }
  </style>
</head>
<body>
  <div class="erd-container">
    <svg width="${totalWidth}" height="${totalHeight}">
      ${this.buildEdgesSVG(edges, minX, minY, padding)}
    </svg>
    ${this.buildNodesHTML(nodes)}
  </div>
</body>
</html>`;
  }

  buildEdgesSVG(edges: ERDEdge[], minX: number, minY: number, padding: number): string {
    if (!edges || edges.length === 0) return "";
    return edges
      .map((edge) => {
        const isUserCreated = edge.data?.isUserCreated || false;
        const className = isUserCreated ? "user-created-line" : "relationship-line";
        return `<line x1="${(edge.sourceX ?? 0) - minX + padding}" y1="${(edge.sourceY ?? 0) - minY + padding}" x2="${(edge.targetX ?? 0) - minX + padding}" y2="${(edge.targetY ?? 0) - minY + padding}" class="${className}" />`;
      })
      .join("");
  }

  buildNodesHTML(nodes: ERDNode[]): string {
    if (!nodes || nodes.length === 0) return "";
    return nodes
      .map((node) => {
        const { position, data } = node;
        const tableName = data?.tableName;
        const columns = data?.columns;

        let columnArray: { name?: string; columnName?: string; type?: string; dataType?: string; isPrimaryKey?: boolean; isForeignKey?: boolean }[] = [];
        if (Array.isArray(columns)) {
          columnArray = columns as typeof columnArray;
        } else if (columns && typeof columns === "object") {
          columnArray = Object.values(columns) as typeof columnArray;
        }

        return `
        <div class="table-card" style="left: ${position.x}px; top: ${position.y}px;">
          <div class="table-header">${tableName || "Table"}</div>
          <div class="table-body">
            ${
              columnArray.length > 0
                ? columnArray
                    .map(
                      (col) => `
              <div class="column-row">
                <div class="column-name">${col.name || col.columnName || "Column"}</div>
                <div class="column-type">${col.type || col.dataType || ""}</div>
              </div>`
                    )
                    .join("")
                : '<div class="column-row"><div class="column-name">No columns</div></div>'
            }
          </div>
        </div>`;
      })
      .join("");
  }

  async cleanup(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}

const pdfExportService = new PDFExportService();

process.on("exit", () => {
  pdfExportService.cleanup();
});

export default pdfExportService;
