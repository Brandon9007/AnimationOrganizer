import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Repositorio.css';

const API_URL = 'http://localhost:8000';

const initialFolders = [
  'Todos los archivos',
  'Imágenes',
  'Videos',
  'Audio',
  'Documentos',
  'Otros'
];

const categoryFromName = (filename = '') => {
  const lower = filename.toLowerCase();
  if (/\.(png|jpe?g|gif|webp|svg|bmp)$/i.test(lower)) return 'Imágenes';
  if (/\.(mp4|webm|ogg|mov|avi|mkv)$/i.test(lower)) return 'Videos';
  if (/\.(mp3|wav|ogg|aac|flac|m4a)$/i.test(lower)) return 'Audio';
  if (/\.(docx?|xlsx?|pptx?|txt|pdf|csv|md)$/i.test(lower)) return 'Documentos';
  return 'Otros';
};

const sizeLabel = (bytes = 0) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
};

export default function Repositorio() {
  const navigate = useNavigate();
  const token = localStorage.getItem('fastapi_token');
  const userRole = (localStorage.getItem('user_role') || '').toLowerCase();
  const isAdmin = userRole === 'admin';

  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState(
    localStorage.getItem('active_project_id') || ''
  );

  const [assets, setAssets] = useState([]);
  const [folder, setFolder] = useState('Todos los archivos');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('recent'); // 'recent' | 'name' | 'size'
  const [view, setView] = useState('grid');

  const [loadingProjects, setLoadingProjects] = useState(true);
  const [loadingAssets, setLoadingAssets] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const [preview, setPreview] = useState(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);

  // 1. Cargar los proyectos reales del usuario
  useEffect(() => {
    const fetchProjects = async () => {
      setLoadingProjects(true);
      try {
        const res = await fetch(`${API_URL}/projects/my-projects`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('No se pudieron cargar los proyectos.');
        const json = await res.json();
        const list = json.data || [];
        setProjects(list);

        if (list.length > 0) {
          const exists = list.some(
            (p) => String(p.project_pk) === String(selectedProjectId)
          );
          const chosen = exists
            ? list.find((p) => String(p.project_pk) === String(selectedProjectId))
            : list[0];

          setSelectedProjectId(String(chosen.project_pk));
          localStorage.setItem('active_project_id', String(chosen.project_pk));
          localStorage.setItem('active_project_name', chosen.project_name);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoadingProjects(false);
      }
    };

    fetchProjects();
  }, [token]);

  // 2. Cargar archivos del repositorio del proyecto seleccionado
  const fetchAssets = async (projId) => {
    if (!projId) return;
    setLoadingAssets(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/repositories/project/${projId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new Error(errJson?.detail || 'Error al cargar los archivos del repositorio.');
      }
      const json = await res.json();
      const mapped = (json.data || []).map((item) => ({
        id: item.repository_pk,
        name: item.file_name,
        description: item.repository_description,
        size: item.file_size || 0,
        category: categoryFromName(item.file_name),
        date: item.created_at,
        link: item.link,
        url: `${API_URL}/${item.link}`
      }));
      setAssets(mapped);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingAssets(false);
    }
  };

  useEffect(() => {
    if (selectedProjectId) {
      fetchAssets(selectedProjectId);
    }
  }, [selectedProjectId]);

  // 3. Subir archivos reales al backend
  const uploadFiles = async (fileList) => {
    const filesArray = Array.from(fileList || []);
    if (!filesArray.length || !selectedProjectId) return;

    setUploading(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('project_id', selectedProjectId);
      filesArray.forEach((file) => formData.append('files', file));

      const res = await fetch(`${API_URL}/repositories/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.detail || 'Error al subir los archivos.');

      await fetchAssets(selectedProjectId);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  // 4. Eliminar archivo del repositorio
  const removeAsset = async (asset) => {
    if (!window.confirm(`¿Eliminar "${asset.name}" del repositorio?`)) return;
    try {
      const res = await fetch(`${API_URL}/repositories/${asset.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('No se pudo eliminar el archivo.');

      setAssets((current) => current.filter((a) => a.id !== asset.id));
      if (preview?.id === asset.id) setPreview(null);
    } catch (err) {
      setError(err.message);
    }
  };

  // Descarga directa con el nombre original
  const downloadAsset = async (asset) => {
    try {
      const response = await fetch(asset.url);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = asset.name;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(blobUrl);
    } catch {
      window.open(asset.url, '_blank', 'noreferrer');
    }
  };

  // Filtrado y ordenamiento
  const filtered = useMemo(() => {
    const list = assets.filter(
      (a) =>
        (folder === 'Todos los archivos' || a.category === folder) &&
        a.name.toLowerCase().includes(search.toLowerCase())
    );

    return [...list].sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'size') return b.size - a.size;
      return b.id - a.id; // 'recent'
    });
  }, [assets, folder, search, sortBy]);

  const handleProjectChange = (e) => {
    const newId = e.target.value;
    setSelectedProjectId(newId);
    setFolder('Todos los archivos');
    setSearch('');

    const found = projects.find((p) => String(p.project_pk) === String(newId));
    if (found) {
      localStorage.setItem('active_project_id', String(found.project_pk));
      localStorage.setItem('active_project_name', found.project_name);
    }
  };

  const icon = (category) =>
    ({
      Imágenes: '▧',
      Videos: '▶',
      Audio: '♫',
      Documentos: '▤',
      Otros: '⬡'
    }[category] || '▦');

  const isPdf = (name = '') => /\.pdf$/i.test(name);

  return (
    <main className="repo-page">
      <header className="repo-header">
        <div>
          <span className="repo-eyebrow">BIBLIOTECA DE PRODUCCIÓN</span>
          <h1>Repositorio de assets</h1>
          <p></p>
        </div>

        <button
          className="repo-primary"
          disabled={!selectedProjectId || uploading}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? 'Subiendo...' : '＋ Subir archivos'}
        </button>
      </header>

      <input
        ref={inputRef}
        type="file"
        multiple
        hidden
        onChange={(e) => {
          uploadFiles(e.target.files);
          e.target.value = '';
        }}
      />

      {error && <div className="repo-worker-error">{error}</div>}

      {/* Selector de proyecto real */}
      <div className="repo-project-bar">
        <div>
          <label htmlFor="repo-project">Proyecto actual</label>
          <select
            id="repo-project"
            value={selectedProjectId}
            disabled={loadingProjects || projects.length === 0}
            onChange={handleProjectChange}
          >
            {projects.length === 0 ? (
              <option value="">Sin proyectos disponibles</option>
            ) : (
              projects.map((p) => (
                <option key={p.project_pk} value={p.project_pk}>
                  {p.project_name}
                </option>
              ))
            )}
          </select>
        </div>

        {isAdmin && (
          <button
            className="repo-outline"
            onClick={() => navigate('/proyectos?crear=true')}
          >
            ＋ Nuevo proyecto
          </button>
        )}
      </div>

      {/* Estadísticas del proyecto */}
      <div className="repo-stats">
        <div>
          <strong>{assets.length}</strong>
          <span>Archivos</span>
        </div>
        <div>
          <strong>{assets.filter((a) => a.category === 'Imágenes').length}</strong>
          <span>Imágenes</span>
        </div>
        <div>
          <strong>{assets.filter((a) => a.category === 'Videos').length}</strong>
          <span>Videos</span>
        </div>
        <div>
          <strong>{sizeLabel(assets.reduce((sum, a) => sum + a.size, 0))}</strong>
          <span>Tamaño total</span>
        </div>
      </div>

      <div className="repo-workspace">
        <aside className="repo-sidebar">
          <h3>Biblioteca</h3>
          {initialFolders.map((f) => (
            <button
              key={f}
              className={`repo-folder ${folder === f ? 'active' : ''}`}
              onClick={() => setFolder(f)}
            >
              <span>{f === 'Todos los archivos' ? '▦' : icon(f)}</span>
              {f}
              <small>
                {f === 'Todos los archivos'
                  ? assets.length
                  : assets.filter((a) => a.category === f).length}
              </small>
            </button>
          ))}
        </aside>

        <section className="repo-content">
          <div className="repo-toolbar">
            <div>
              <h2>{folder}</h2>
              <p>{filtered.length} elementos</p>
            </div>

            <div className="repo-tools">
              <input
                aria-label="Buscar archivos"
                placeholder="⌕ Buscar archivos..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <select
                aria-label="Ordenar archivos"
                className="repo-sort-select"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
              >
                <option value="recent">Más recientes</option>
                <option value="name">Nombre (A-Z)</option>
                <option value="size">Mayor tamaño</option>
              </select>
              <button
                className={view === 'grid' ? 'selected' : ''}
                title="Cuadrícula"
                onClick={() => setView('grid')}
              >
                ▦
              </button>
              <button
                className={view === 'list' ? 'selected' : ''}
                title="Lista"
                onClick={() => setView('list')}
              >
                ☰
              </button>
            </div>
          </div>

          <div
            className={`repo-dropzone ${dragging ? 'dragging' : ''}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              setDragging(false);
            }}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              uploadFiles(e.dataTransfer.files);
            }}
          >
            <span className="repo-upload-icon">↑</span>
            <strong>
              {uploading
                ? 'Subiendo archivos al servidor...'
                : 'Arrastra tus archivos aquí'}
            </strong>
            <span>
              o{' '}
              <button type="button" onClick={() => inputRef.current?.click()}>
                selecciona archivos
              </button>{' '}
              desde tu equipo
            </span>
            <small>Imágenes, videos, audio, documentos y más</small>
          </div>

          {loadingAssets ? (
            <div className="repo-empty">
              <span>✦</span>
              <h3>Cargando archivos...</h3>
            </div>
          ) : filtered.length ? (
            <div className={`repo-assets ${view}`}>
              {filtered.map((asset) => (
                <article className="repo-asset" key={asset.id}>
                  <button
                    className="repo-thumbnail"
                    onClick={() => setPreview(asset)}
                    aria-label={`Vista previa de ${asset.name}`}
                  >
                    {asset.category === 'Imágenes' ? (
                      <img src={asset.url} alt={asset.name} />
                    ) : (
                      <span>{icon(asset.category)}</span>
                    )}
                  </button>

                  <div className="repo-asset-info">
                    <strong title={asset.name}>{asset.name}</strong>
                    <span>
                      {asset.category} · {sizeLabel(asset.size)}
                    </span>
                    <small>{asset.date}</small>
                  </div>

                  <div className="repo-asset-actions">
                    <button title="Ver" onClick={() => setPreview(asset)}>
                      ◉
                    </button>
                    <button title="Descargar" onClick={() => downloadAsset(asset)}>
                      ↓
                    </button>
                    <button title="Eliminar" onClick={() => removeAsset(asset)}>
                      ×
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="repo-empty">
              <span>▧</span>
              <h3>
                {search || folder !== 'Todos los archivos'
                  ? 'No se encontraron archivos'
                  : 'Tu repositorio está vacío'}
              </h3>
              <p>
                {search || folder !== 'Todos los archivos'
                  ? 'Prueba otra búsqueda o categoría.'
                  : 'Sube los primeros assets para comenzar a organizar este proyecto.'}
              </p>
            </div>
          )}
        </section>
      </div>

      {/* Modal de Vista Previa */}
      {preview && (
        <div className="repo-modal-backdrop" onClick={() => setPreview(null)}>
          <div
            className="repo-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Vista previa"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="repo-modal-header">
              <strong>{preview.name}</strong>
              <button onClick={() => setPreview(null)}>×</button>
            </div>

            <div className="repo-preview">
              {preview.category === 'Imágenes' ? (
                <img src={preview.url} alt={preview.name} />
              ) : preview.category === 'Videos' ? (
                <video controls src={preview.url} />
              ) : preview.category === 'Audio' ? (
                <audio controls src={preview.url} />
              ) : isPdf(preview.name) ? (
                <iframe
                  src={preview.url}
                  title={preview.name}
                  className="repo-pdf-preview"
                />
              ) : (
                <div className="repo-no-preview">
                  <span>{icon(preview.category)}</span>
                  <p>Vista previa no disponible para este formato.</p>
                </div>
              )}
            </div>

            <div className="repo-modal-footer">
              <span>
                {preview.category} · {sizeLabel(preview.size)}
              </span>
              <button
                className="repo-primary"
                onClick={() => downloadAsset(preview)}
              >
                ↓ Descargar
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}