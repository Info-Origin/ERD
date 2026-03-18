import type { Request, Response } from "express";
import pdfExportService from "../services/pdfExportService.js";
import type { ExportOptions } from "../types/index.js";

export const exportERDToPDF = async (req: Request, res: Response): Promise<void> => {
  console.log("📥 Received PDF export request");

  try {
    const { imageData, options } = req.body as {
      imageData?: string;
      options?: ExportOptions;
    };

    if (!imageData) {
      res.status(400).json({ success: false, message: "No image data provided" });
      return;
    }

    const pdfBuffer = await pdfExportService.generatePDFFromImage(imageData, options);

    const schemaName = options?.schemaName || "schema";
    const timestamp = new Date().toISOString().split("T")[0];
    const filename = `ERD_${schemaName}_${timestamp}.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Length", pdfBuffer.length);
    res.send(pdfBuffer);
  } catch (error) {
    console.error("❌ Export error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to generate PDF",
      error: (error as Error).message,
    });
  }
};
