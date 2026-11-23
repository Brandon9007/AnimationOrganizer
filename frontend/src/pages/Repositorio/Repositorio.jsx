import React, { useEffect, useMemo, useRef, useState } from 'react';
import './Repositorio.css';

const initialFolders = ['Todos los archivos', 'Imágenes', 'Videos', 'Audio', 'Documentos', 'Otros'];
const categoryFor = (file) => {
  if (file.type.startsWith('image/')) return 'Imágenes';
  if (file.type.startsWith('video/')) return 'Videos';
  if (file.type.startsWith('audio/')) return 'Audio';
  if (file.type.includes('pdf') || file.type.includes('text') || /\.(docx?|xlsx?|pptx?|txt|pdf)$/i.test(file.name)) return 'Documentos';
  return 'Otros';
};
const sizeLabel = (bytes) => bytes < 1024 ? `${bytes} B` : bytes < 1048576 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1048576).toFixed(1)} MB`;

export default function Repositorio() {
  const [assets, setAssets] = useState([]);
  const [folder, setFolder] = useState('Todos los archivos');
  const [search, setSearch] = useState('');
  const [view, setView] = useState('grid');
  const [project, setProject] = useState('Proyecto principal');
  const [projects, setProjects] = useState(['Proyecto principal']);
  const [newProject, setNewProject] = useState('');
  const [showProjectForm, setShowProjectForm] = useState(false);
  const [preview, setPreview] = useState(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);
  const assetsRef = useRef(assets);
  assetsRef.current = assets;
  useEffect(() => () => assetsRef.current.forEach(a => URL.revokeObjectURL(a.url)), []);

  const addFiles = (files) => {
    const additions = Array.from(files || []).map(file => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name: file.name, size: file.size, category: categoryFor(file),
      type: file.type, date: new Date().toLocaleDateString('es-MX'),
      url: URL.createObjectURL(file), project
    }));
    setAssets(current => [...additions, ...current]);
  };
  const filtered = useMemo(() => assets.filter(a => a.project === project && (folder === 'Todos los archivos' || a.category === folder) && a.name.toLowerCase().includes(search.toLowerCase())), [assets, project, folder, search]);
  const projectAssets = assets.filter(a => a.project === project);
  const remove = (asset) => {
    if (!window.confirm(`¿Quitar "${asset.name}" del repositorio?`)) return;
    setAssets(current => current.filter(a => a.id !== asset.id));
    if (preview?.id === asset.id) setPreview(null);
    URL.revokeObjectURL(asset.url);
  };
  const createProject = (event) => {
    event.preventDefault();
    const name = newProject.trim();
    if (!name || projects.some(p => p.toLowerCase() === name.toLowerCase())) return;
    setProjects(p => [...p, name]); setProject(name); setNewProject(''); setShowProjectForm(false); setFolder('Todos los archivos');
  };
  const icon = (category) => ({'Imágenes':'▧','Videos':'▶','Audio':'♫','Documentos':'▤','Otros':'⬡'}[category] || '▦');
  return (
    <main className="repo-page">
      <header className="repo-header">
        <div><span className="repo-eyebrow">BIBLIOTECA DE PRODUCCIÓN</span><h1>Repositorio de assets</h1><p>Organiza y consulta los recursos de tus proyectos de animación.</p></div>
        <button className="repo-primary" onClick={() => inputRef.current?.click()}>＋ Subir archivos</button>
      </header>
      <input ref={inputRef} type="file" multiple hidden onChange={e => {addFiles(e.target.files); e.target.value = '';}} />
      <div className="repo-project-bar"><div><label htmlFor="repo-project">Proyecto actual</label><select id="repo-project" value={project} onChange={e => {setProject(e.target.value); setFolder('Todos los archivos'); setSearch('');}}>{projects.map(p => <option key={p}>{p}</option>)}</select></div><button className="repo-outline" onClick={() => setShowProjectForm(v => !v)}>＋ Nuevo proyecto</button></div>
      {showProjectForm && <form className="repo-new-project" onSubmit={createProject}><input autoFocus placeholder="Nombre del proyecto" value={newProject} onChange={e => setNewProject(e.target.value)} /><button className="repo-primary">Crear</button><button type="button" className="repo-outline" onClick={() => setShowProjectForm(false)}>Cancelar</button></form>}
      <div className="repo-stats"><div><strong>{projectAssets.length}</strong><span>Archivos</span></div><div><strong>{projectAssets.filter(a => a.category === 'Imágenes').length}</strong><span>Imágenes</span></div><div><strong>{projectAssets.filter(a => a.category === 'Videos').length}</strong><span>Videos</span></div><div><strong>{sizeLabel(projectAssets.reduce((sum,a) => sum + a.size, 0))}</strong><span>Tamaño total</span></div></div>
      <div className="repo-workspace"><aside className="repo-sidebar"><h3>Biblioteca</h3>{initialFolders.map(f => <button key={f} className={`repo-folder ${folder === f ? 'active' : ''}`} onClick={() => setFolder(f)}><span>{f === 'Todos los archivos' ? '▦' : icon(f)}</span>{f}<small>{f === 'Todos los archivos' ? projectAssets.length : projectAssets.filter(a => a.category === f).length}</small></button>)}</aside>
        <section className="repo-content"><div className="repo-toolbar"><div><h2>{folder}</h2><p>{filtered.length} elementos</p></div><div className="repo-tools"><input aria-label="Buscar archivos" placeholder="⌕ Buscar archivos..." value={search} onChange={e => setSearch(e.target.value)} /><button className={view === 'grid' ? 'selected' : ''} title="Cuadrícula" onClick={() => setView('grid')}>▦</button><button className={view === 'list' ? 'selected' : ''} title="Lista" onClick={() => setView('list')}>☰</button></div></div>
          <div className={`repo-dropzone ${dragging ? 'dragging' : ''}`} onDragOver={e => {e.preventDefault(); setDragging(true);}} onDragLeave={e => {e.preventDefault(); setDragging(false);}} onDrop={e => {e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files);}}><span className="repo-upload-icon">↑</span><strong>Arrastra tus archivos aquí</strong><span>o <button onClick={() => inputRef.current?.click()}>selecciona archivos</button> desde tu equipo</span><small>Imágenes, videos, audio, documentos y más</small></div>
          {filtered.length ? <div className={`repo-assets ${view}`} >{filtered.map(asset => <article className="repo-asset" key={asset.id}><button className="repo-thumbnail" onClick={() => setPreview(asset)} aria-label={`Vista previa de ${asset.name}`}>{asset.category === 'Imágenes' ? <img src={asset.url} alt="" /> : <span>{icon(asset.category)}</span>}</button><div className="repo-asset-info"><strong title={asset.name}>{asset.name}</strong><span>{asset.category} · {sizeLabel(asset.size)}</span><small>{asset.date}</small></div><div className="repo-asset-actions"><button title="Ver" onClick={() => setPreview(asset)}>◉</button><a title="Descargar" href={asset.url} download={asset.name}>↓</a><button title="Eliminar" onClick={() => remove(asset)}>×</button></div></article>)}</div> : <div className="repo-empty"><span>▧</span><h3>{search || folder !== 'Todos los archivos' ? 'No se encontraron archivos' : 'Tu repositorio está vacío'}</h3><p>{search || folder !== 'Todos los archivos' ? 'Prueba otra búsqueda o categoría.' : 'Sube los primeros assets para comenzar a organizar este proyecto.'}</p></div>}
        </section></div>
      {preview && <div className="repo-modal-backdrop" onClick={() => setPreview(null)}><div className="repo-modal" role="dialog" aria-modal="true" aria-label="Vista previa" onClick={e => e.stopPropagation()}><div className="repo-modal-header"><strong>{preview.name}</strong><button onClick={() => setPreview(null)}>×</button></div><div className="repo-preview">{preview.category === 'Imágenes' ? <img src={preview.url} alt={preview.name} /> : preview.category === 'Videos' ? <video controls src={preview.url} /> : preview.category === 'Audio' ? <audio controls src={preview.url} /> : <div className="repo-no-preview"><span>{icon(preview.category)}</span><p>Vista previa no disponible para este formato.</p></div>}</div><div className="repo-modal-footer"><span>{preview.category} · {sizeLabel(preview.size)}</span><a className="repo-primary" href={preview.url} download={preview.name}>↓ Descargar</a></div></div></div>}
      <p className="repo-note">Versión de interfaz: los archivos permanecen disponibles solo durante esta sesión. No se envían a un servidor.</p>
    </main>
  );
}
