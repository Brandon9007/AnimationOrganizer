import React, { useEffect, useRef, useState } from "react";
import "../AssetsTarea.css";

const API_URL = (process.env.REACT_APP_API_URL || "http://localhost:8000").replace(/\/$/, "");

export async function requestTaskAssets(path, signal) {
  const token = localStorage.getItem("fastapi_token");
  if (!token) throw new Error("Debes iniciar sesión.");

  const response = await fetch(`${API_URL}/api${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal,
  });
  if (response.ok) return response;

  const errors = {
    401: "Tu sesión no es válida o ha expirado. Inicia sesión de nuevo.",
    403: "No tienes acceso a estos archivos.",
    404: "La tarea o el archivo ya no está disponible.",
    415: "Este formato solo está disponible para descargar.",
  };
  throw new Error(errors[response.status] || "No se pudieron obtener los archivos.");
}

function Preview({ file, onClose }) {
  const dialog = useRef(null);

  useEffect(() => {
    dialog.current.showModal();
  }, []);

  return (
    <dialog ref={dialog} className="asset-modal" aria-label={`Vista previa de ${file.name}`} onClose={onClose}>
      <div className="asset-modal-header">
        <h3>{file.name}</h3>
        <button type="button" onClick={() => dialog.current.close()} aria-label="Cerrar">✕</button>
      </div>
      <div className="asset-modal-contenido">
        {file.type.startsWith("image/") && <img src={file.url} alt={file.name} />}
        {file.type.startsWith("video/") && <video src={file.url} controls />}
        {file.type.startsWith("audio/") && <audio src={file.url} controls />}
        {file.type === "application/pdf" && <iframe src={file.url} title={file.name} />}
      </div>
    </dialog>
  );
}

export default function AssetsTarea({ tareaId, proyectoId }) {
  const [assets, setAssets] = useState(null);
  const [preview, setPreview] = useState(null);
  const [pending, setPending] = useState(null);
  const [error, setError] = useState("");
  const actionRequest = useRef(null);
  const path = `/projects/${encodeURIComponent(proyectoId)}/tasks/${encodeURIComponent(tareaId)}/assets`;

  useEffect(() => {
    if (preview) return () => URL.revokeObjectURL(preview.url);
  }, [preview]);

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      try {
        const response = await requestTaskAssets(path, controller.signal);
        const data = await response.json();
        if (!controller.signal.aborted) setAssets(data.assets);
      } catch (err) {
        if (!controller.signal.aborted) setError(err.message);
      }
    };

    load();
    return () => {
      controller.abort();
      actionRequest.current?.abort();
    };
  }, [path]);

  const obtenerArchivo = async (asset, accion) => {
    if (actionRequest.current) return;
    const controller = new AbortController();
    actionRequest.current = controller;
    setPending({ id: asset.id, accion });
    setError("");

    try {
      const response = await requestTaskAssets(
        `${path}/${encodeURIComponent(asset.id)}/${accion}`, controller.signal
      );
      const blob = await response.blob();
      if (controller.signal.aborted) return;

      const url = URL.createObjectURL(blob);
      if (accion === "preview") {
        setPreview({ name: asset.name, url, type: blob.type });
      } else {
        const enlace = document.createElement("a");
        enlace.href = url;
        enlace.download = asset.name;
        document.body.appendChild(enlace);
        enlace.click();
        enlace.remove();
        setTimeout(() => URL.revokeObjectURL(url), 60000);
      }
    } catch (err) {
      if (!controller.signal.aborted) setError(err.message);
    } finally {
      actionRequest.current = null;
      if (!controller.signal.aborted) setPending(null);
    }
  };

  return (
    <section className="assets-tarea">
      <h4>Assets vinculados{assets && ` (${assets.length})`}</h4>
      {!assets && !error && <p role="status">Cargando archivos…</p>}
      {error && <p className="assets-error" role="alert">{error}</p>}
      {assets?.length === 0 && <p className="assets-vacio">Esta tarea no tiene archivos vinculados.</p>}
      {assets?.map((asset) => (
        <div className="asset-item" key={asset.id}>
          <span className="asset-nombre">{asset.name}</span>
          {!asset.mime_type && <p className="assets-vacio">Este formato solo está disponible para descargar.</p>}
          <div className="asset-botones">
            {asset.mime_type && (
              <button
                type="button"
                className="btn-visualizar"
                disabled={Boolean(pending)}
                onClick={() => obtenerArchivo(asset, "preview")}
              >
                {pending?.id === asset.id && pending.accion === "preview" ? "Abriendo…" : "👁 Visualizar"}
              </button>
            )}
            <button
              type="button"
              className="btn-descargar"
              disabled={Boolean(pending)}
              onClick={() => obtenerArchivo(asset, "download")}
            >
              {pending?.id === asset.id && pending.accion === "download" ? "Descargando…" : "⬇ Descargar"}
            </button>
          </div>
        </div>
      ))}
      {preview && <Preview file={preview} onClose={() => setPreview(null)} />}
    </section>
  );
}
