import { toPng } from 'html-to-image';

export type ExportQuality = 'low' | 'medium' | 'high' | 'ultra';

export interface ExportOptions {
  schemaName?: string;
  format?: 'pdf' | 'svg';
  quality?: ExportQuality;
  includeAllTables?: boolean;
}

const QUALITY_SCALES: Record<ExportQuality, number> = { low: 1, medium: 1.5, high: 2, ultra: 3 };

export const exportERDToPDF = async (
  options: ExportOptions,
  progressCallback: (progress: number, message: string) => void
): Promise<void> => {
  try {
    const reactFlowInstance = (window as { reactFlowInstance?: unknown }).reactFlowInstance;
    if (!reactFlowInstance) throw new Error('React Flow instance not available. Please try again.');
    return await exportViaServer(options, progressCallback);
  } catch (error) {
    await cleanupAfterExport();
    const msg = (error as Error).message;
    if (msg.includes('Failed to fetch') || msg.includes('fetch')) throw new Error('Cannot connect to server. Please ensure the backend is running on port 4000 and try again.');
    if (msg.includes('timeout')) throw new Error('Export timed out. The diagram might be too large. Please try again.');
    if (msg.includes('React Flow')) throw new Error('Diagram not ready. Please wait a moment and try again.');
    throw new Error('Unable to generate PDF at this time. Please try again later.');
  }
};

const exportViaServer = async (
  options: ExportOptions,
  progressCallback: (progress: number, message: string) => void
): Promise<void> => {
  const { schemaName = 'schema', format = 'pdf' } = options;

  progressCallback(10, 'Preparing diagram...');
  await prepareForExport(options.includeAllTables);

  progressCallback(40, 'Capturing diagram (optimized)...');
  const canvas = await captureAsCanvasOptimized(options.quality || 'high');
  if (!canvas) throw new Error('Failed to capture diagram. Please try again.');

  progressCallback(50, 'Converting to image...');
  const imageDataUrl = canvas.toDataURL('image/png');

  progressCallback(60, 'Sending to server...');
  const backendURL = (process.env.REACT_APP_API_BASE_URL || 'http://localhost:4001/api').replace('/api', '');

  const response = await fetch(`${backendURL}/api/export/pdf`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageData: imageDataUrl, options: { ...options, width: canvas.width, height: canvas.height } }),
    signal: AbortSignal.timeout(300000),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Server export failed:', response.status, errorText);
    throw new Error(`Server returned error: ${response.status}. Please try again later.`);
  }

  progressCallback(80, 'Downloading PDF...');
  const blob = await response.blob();

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

  progressCallback(100, 'Export complete!');
  await cleanupAfterExport();
};

const prepareForExport = async (includeAllTables?: boolean): Promise<void> => {
  const elementsToHide = ['.draggable-minimap','.canvas-controls','.erd-toolbar','.relationship-toolbar','.react-flow__controls','.react-flow__attribution'];
  elementsToHide.forEach((selector) => {
    const element = document.querySelector<HTMLElement>(selector);
    if (element) { element.style.display = 'none'; element.setAttribute('data-hidden-for-export', 'true'); }
  });

  const reactFlowInstance = (window as { reactFlowInstance?: { fitView: (opts: unknown) => Promise<void> } }).reactFlowInstance;
  if (document.querySelector('.react-flow') && reactFlowInstance) {
    await reactFlowInstance.fitView({ padding: 0.1, duration: 0 });
  }
  if (document.fonts?.ready) await document.fonts.ready;
  await new Promise((resolve) => setTimeout(resolve, 300));
};

const captureAsCanvasOptimized = async (quality: ExportQuality): Promise<HTMLCanvasElement | null> => {
  const reactFlowInstance = (window as { reactFlowInstance?: { getNodes: () => Array<{ position: { x: number; y: number }; width?: number; height?: number }> } }).reactFlowInstance;
  if (!reactFlowInstance) throw new Error('React Flow instance not available');

  const viewportElement = document.querySelector<HTMLElement>('.react-flow__viewport');
  if (!viewportElement) throw new Error('React Flow viewport not found');

  const nodes = reactFlowInstance.getNodes();
  if (nodes.length === 0) throw new Error('No nodes found in diagram');

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  nodes.forEach((node) => {
    const { x, y } = node.position;
    const width = node.width || 300, height = node.height || 200;
    minX = Math.min(minX, x); minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + width); maxY = Math.max(maxY, y + height);
  });

  const padding = 100;
  const imageWidth = maxX - minX + padding * 2;
  const imageHeight = maxY - minY + padding * 2;
  let scale = QUALITY_SCALES[quality] || 2;
  const nodeCount = nodes.length;
  if (nodeCount >= 100) scale = Math.min(scale, 1);
  else if (nodeCount >= 50) scale = Math.min(scale, 1.5);

  const offsetX = -minX + padding;
  const offsetY = -minY + padding;

  return new Promise((resolve, reject) => {
    const doCapture = async () => {
      try {
        const dataUrl = await toPng(viewportElement, {
          backgroundColor: '#ffffff', width: imageWidth, height: imageHeight, pixelRatio: scale,
          style: { width: `${imageWidth}px`, height: `${imageHeight}px`, transform: `translate(${offsetX}px, ${offsetY}px) scale(1)` },
          cacheBust: false, skipAutoScale: true,
        });
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = imageWidth * scale; canvas.height = imageHeight * scale;
          canvas.getContext('2d')!.drawImage(img, 0, 0);
          resolve(canvas);
        };
        img.onerror = reject;
        img.src = dataUrl;
      } catch (error) { reject(error); }
    };

    if ('requestIdleCallback' in window) {
      (window as { requestIdleCallback: (cb: () => void, opts: { timeout: number }) => void }).requestIdleCallback(doCapture, { timeout: 2000 });
    } else {
      setTimeout(doCapture, 0);
    }
  });
};

const cleanupAfterExport = async (): Promise<void> => {
  document.querySelectorAll<HTMLElement>('[data-hidden-for-export="true"]').forEach((element) => {
    element.style.display = ''; element.removeAttribute('data-hidden-for-export');
  });
  await new Promise((resolve) => setTimeout(resolve, 100));
};
