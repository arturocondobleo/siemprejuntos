"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { uploadData } from "aws-amplify/storage";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "@/amplify/data/resource";
import { Amplify } from "aws-amplify";
import outputs from "@/amplify_outputs.json";
import "@aws-amplify/ui-react/styles.css";
import "./../app.css";

Amplify.configure(outputs);

const client = generateClient<Schema>();

function MobileUploadContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("sessionId");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [error, setError] = useState("");

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file || !sessionId) return;

    setUploading(true);
    setError("");

    try {
      const filename = `evidence/${sessionId}-${Date.now()}-${file.name}`;
      
      await uploadData({
        path: filename,
        data: file,
      }).result;

      // Update the session record
      const { errors } = await client.models.PaymentEvidenceSession.update({
        id: sessionId, // Assuming sessionId passed is the record ID
        status: "COMPLETED",
        imageUrl: filename,
      });

      if (errors) throw new Error(errors[0].message);

      setCompleted(true);
    } catch (err) {
      console.error(err);
      setError("Error al subir la imagen. Intenta de nuevo.");
    } finally {
      setUploading(false);
    }
  };

  if (!sessionId) {
    return <div className="container">Error: Sesión no válida.</div>;
  }

  if (completed) {
    return (
      <div className="container" style={{ textAlign: "center", marginTop: "2rem" }}>
        <div style={{ fontSize: "4rem", marginBottom: "1rem" }}>✅</div>
        <h2>¡Subida Exitosa!</h2>
        <p>La evidencia se ha guardado correctamente.</p>
        <p>Ya puedes cerrar esta ventana.</p>
      </div>
    );
  }

  return (
    <div className="container" style={{ padding: "1rem" }}>
      <h2 style={{ textAlign: "center" }}>Subir Evidencia</h2>
      <p style={{ textAlign: "center", color: "#666" }}>
        Toma una foto o selecciona un archivo para el pago.
      </p>

      <div className="card-section" style={{ marginTop: "2rem" }}>
        <div className="input-group">
          <label 
            htmlFor="file-upload" 
            className="btn-primary" 
            style={{ 
              display: "block", 
              textAlign: "center", 
              padding: "1rem",
              cursor: "pointer",
              marginBottom: "1rem"
            }}
          >
            {file ? "Cambiar archivo" : "📸 Tomar Foto / Seleccionar"}
          </label>
          <input
            id="file-upload"
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileChange}
            style={{ display: "none" }}
          />
          
          {file && (
            <div style={{ textAlign: "center", marginBottom: "1rem" }}>
              <strong>Archivo seleccionado:</strong>
              <br />
              {file.name}
            </div>
          )}

          <button
            className="btn-primary"
            onClick={handleUpload}
            disabled={!file || uploading}
            style={{ width: "100%", opacity: !file || uploading ? 0.5 : 1 }}
          >
            {uploading ? "Subiendo..." : "Subir Evidencia"}
          </button>
          
          {error && <p style={{ color: "red", textAlign: "center" }}>{error}</p>}
        </div>
      </div>
    </div>
  );
}

export default function MobileUploadPage() {
  return (
    <Suspense fallback={<div>Cargando...</div>}>
      <MobileUploadContent />
    </Suspense>
  );
}
