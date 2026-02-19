import pdfExportService from '../services/pdfExportService.js';

/**
 * Export ERD to PDF (server-side generation)
 */
export const exportERDToPDF = async (req, res) => {
  console.log('📥 Received PDF export request');
  
  try {
    const { imageData, options } = req.body;

    if (!imageData) {
      console.error('❌ No image data provided');
      return res.status(400).json({
        success: false,
        message: 'No image data provided'
      });
    }

    console.log('✅ Image data received', {
      size: `${(imageData.length / 1024).toFixed(2)} KB`,
      options
    });

    // Generate PDF from image
    const pdfBuffer = await pdfExportService.generatePDFFromImage(imageData, options);

    // Generate filename
    const schemaName = options?.schemaName || 'schema';
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `ERD_${schemaName}_${timestamp}.pdf`;

    console.log('📤 Sending PDF to client:', filename);

    // Send PDF as download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    
    res.send(pdfBuffer);

  } catch (error) {
    console.error('❌ Export error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate PDF',
      error: error.message
    });
  }
};
