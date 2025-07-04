const express = require("express");
const router = express.Router();

const { TEMPLATE_INVOICE_URL } = require("../consts/template_invoice_url");

const {
  CLOUD_RUN_CONVERTER_URL,
} = require("../consts/cloud_run_converter_url");

const axios = require("axios");
const { TemplateHandler } = require("easy-template-x");

const admin = require("firebase-admin");
if (!admin.apps.length) {
  admin.initializeApp();
}
const storageBucket = admin
  .storage()
  .bucket("renta-control.firebasestorage.app");

if (!TEMPLATE_INVOICE_URL) {
  console.error(
    "ERROR: La URL de la plantilla no está definida en TEMPLATE_URL."
  );
}

router.post("/", async (req, res) => {
  try {
    if (!req.body || typeof req.body.data != "object") {
      return res.status(400).json({
        error:
          "Invalid request body: 'data' field is missing or not an object.",
      });
    }

    const invoiceData = req.body.data;
    console.log(
      "Datos recibidos para sustitución con easy-template-x:",
      invoiceData
    );

    if (!TEMPLATE_INVOICE_URL) {
      return res.status(500).json({
        error: "Template URL is not configured. Cannot download template.",
      });
    }

    const templateResponse = await axios.get(TEMPLATE_INVOICE_URL, {
      responseType: "arraybuffer",
    });
    const templateBuffer = Buffer.from(templateResponse.data);

    const handler = new TemplateHandler();
    const processedDocxBuffer = await handler.process(
      templateBuffer,
      invoiceData
    );
    console.log("Plantilla procesada con easy-template-x.");

    console.log(
      "Enviando documento procesado a Cloud Run para conversión a PDF..."
    );
    const pdfConverterResponse = await axios.post(
      CLOUD_RUN_CONVERTER_URL,
      processedDocxBuffer,
      {
        headers: {
          "Content-Type": "application/octet-stream",
        },
        responseType: "arraybuffer",
      }
    );
    const pdfBuffer = Buffer.from(pdfConverterResponse.data);
    console.log("PDF recibido de Cloud Run");

    const fileName = `recibos_generados/recibo_${Date.now()}.pdf`;
    const file = storageBucket.file(fileName);

    await file.save(pdfBuffer, {
      metadata: {
        contentType: "application/pdf",
      },
      public: true,
    });
    console.log(
      `PDF subido a Firebase Storage: gs://${storageBucket.name}/${fileName}`
    );

    const [downloadUrl] = await file.getSignedUrl({
      action: "read",
      expires: "03-09-2491", // Fecha de expiración muy lejana
    });
    console.log("URL de descarga pública del PDF:", downloadUrl);

    res.status(200).json({
      message: "Recibo generado y PDF subido exitosamente",
      downloadUrl: downloadUrl,
    });
  } catch (error) {
    console.error("Error en POST /invoices:", error);
    res.status(500).json({
      error: "Internal Server Error: " + (error.message || "Unknown error"),
    });
  }
});

module.exports = router;
