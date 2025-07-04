const express = require("express");
const router = express.Router();

// Importa la URL de tu plantilla DOCX en Firebase Storage
const { TEMPLATE_URL } = require("../consts/template_url");
//
const {
  CLOUD_RUN_CONVERTER_URL,
} = require("../consts/cloud_run_converter_url");

const axios = require("axios");
const { TemplateHandler } = require("easy-template-x"); // Importa TemplateHandler de easy-template-x

const admin = require("firebase-admin");
// Solo inicializa Firebase Admin si no se ha hecho antes
if (!admin.apps.length) {
  admin.initializeApp();
}
const storageBucket = admin.storage().bucket("renta-control.firebasestorage.app"); // Obtiene el bucket de Firebase Storage

// Verifica que la URL de la plantilla esté configurada
if (!TEMPLATE_URL) {
  console.error(
    "ERROR: La URL de la plantilla no está definida en TEMPLATE_URL."
  );
}

router.post("/", async (req, res) => {
  try {
    // Validación básica del cuerpo de la solicitud
    if (!req.body || typeof req.body.data !== "object") {
      return res.status(400).json({
        error:
          "Invalid request body: 'data' field is missing or not an object.",
      });
    }

    const contractData = req.body.data;
    console.log(
      "Datos recibidos para sustitución con easy-template-x:",
      contractData
    );

    // Verifica que la URL de la plantilla esté configurada
    if (!TEMPLATE_URL) {
      return res.status(500).json({
        error: "Template URL is not configured. Cannot download template.",
      });
    }

    // 1. Descargar la plantilla DOCX desde Firebase Storage URL
    const templateResponse = await axios.get(TEMPLATE_URL, {
      responseType: "arraybuffer", // Obtener el archivo como un ArrayBuffer binario
    });
    const templateBuffer = Buffer.from(templateResponse.data); // Convertir ArrayBuffer a Buffer de Node.js

    // 2. Crear una instancia de TemplateHandler de easy-template-x
    const handler = new TemplateHandler();
    const processedDocxBuffer = await handler.process(
      templateBuffer,
      contractData
    );
    console.log("Plantilla procesada con easy-template-x.");

    // 3. Enviar el documento procesado a Cloud Run para convertirlo a PDF
    console.log(
      "Enviando documento procesado a Cloud Run para conversión a PDF..."
    );
    const pdfConverterResponse = await axios.post(
      CLOUD_RUN_CONVERTER_URL,
      processedDocxBuffer,
      {
        headers: {
          "Content-Type": "application/octet-stream", // Indica que se está enviando un archivo binario
        },
        responseType: "arraybuffer", // Espera una respuesta en formato binario
      }
    );
    const pdfBuffer = Buffer.from(pdfConverterResponse.data);
    console.log("PDF recibido de Cloud Run.");

    // 4. Subir el PDF a Firebase Storage
    const fileName = `contratos_generados/contrato_${Date.now()}.pdf`;
    const file = storageBucket.file(fileName);

    await file.save(pdfBuffer, {
      metadata: {
        contentType: "application/pdf", // Establece el tipo de contenido del archivo PDF
      },
      public: true, // Opcional: si quieres que el archivo sea público
    });
    console.log(
      `PDF subido a Firebase Storage: gs://${storageBucket.name}/${fileName}`
    );

    // Obtenemos la URL pública del archivo PDF
    const [downloadUrl] = await file.getSignedUrl({
      action: "read",
      expires: "03-09-2491", // Fecha de expiración muy lejana
    });
    console.log("URL de descarga pública del PDF:", downloadUrl);

    // 5. Enviar la URL del PDF generado como respuesta
    res.status(200).json({
      message: "Contrato generado y PDF subido exitosamente.",
      downloadUrl: downloadUrl,
    });
  } catch (error) {
    console.error("Error en POST /contracts:", error);

    // Manejo de errores simplificado, ya que CloudConvert fue eliminado
    res.status(500).json({
      error: "Internal Server Error: " + (error.message || "Unknown error"),
    });
  }
});

module.exports = router;
