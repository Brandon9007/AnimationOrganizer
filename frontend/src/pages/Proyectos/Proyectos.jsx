import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import './Proyectos.css';

const API_URL = 'http://localhost:8000';

export default function Proyectos() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const token = localStorage.getItem('fastapi_token');
  const userRole = (localStorage.getItem('user_role') || '').toLowerCase();
  const isAdmin = userRole === 'admin';

  const [projects, setProjects] = useState([]);
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [editingProject, setEditingProject] = useState(null);

  // Modal para gestionar usuarios de un proyecto ya creado
  const [teamProject, setTeamProject] = useState(null);
  const [teamUserIds, setTeamUserIds] = useState([]);
  const [loadingTeam, setLoadingTeam] = useState(false);

  // Modal de creación
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    project_name: '',
    project_description: '',
    start_date: new Date().toISOString().split('T')[0],
    is_active: true,
    user_ids: []
  });

  useEffect(() => {
    if (isAdmin && searchParams.get('crear') === 'true') {
      setShowModal(true);
      setSearchParams({});
    }
  }, [isAdmin, searchParams, setSearchParams]);

  const fetchProjects = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/projects/my-projects`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('No se pudieron cargar los proyectos.');
      const json = await res.json();
      setProjects(json.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    if (!isAdmin) return;
    try {
      const res = await fetch(`${API_URL}/users`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) return;
      const json = await res.json();
      setUsers((json.data || []).filter((u) => u.is_active));
    } catch (err) {
      console.error('Error cargando usuarios:', err);
    }
  };

  useEffect(() => {
    fetchProjects();
    fetchUsers();
  }, []);

  const filteredProjects = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter(
      (p) =>
        p.project_name.toLowerCase().includes(q) ||
        (p.project_description || '').toLowerCase().includes(q)
    );
  }, [projects, search]);

  const handleSelectProject = (project) => {
    localStorage.setItem('active_project_id', String(project.project_pk));
    localStorage.setItem('active_project_name', project.project_name);
    navigate('/pipeline');
  };

  const toggleUserSelection = (userPk) => {
    setFormData((prev) => {
      const exists = prev.user_ids.includes(userPk);
      return {
        ...prev,
        user_ids: exists
          ? prev.user_ids.filter((id) => id !== userPk)
          : [...prev.user_ids, userPk]
      };
    });
  };

  // Abrir modal de gestión de equipo de un proyecto existente
  const openTeamModal = async (e, project) => {
    e.stopPropagation();
    setTeamProject(project);
    setTeamUserIds([]);
    setLoadingTeam(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/projects/${project.project_pk}/users`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('No se pudo cargar el equipo del proyecto.');
      const json = await res.json();
      setTeamUserIds(json.user_ids || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingTeam(false);
    }
  };

  const toggleTeamUser = (userPk) => {
    setTeamUserIds((prev) =>
      prev.includes(userPk) ? prev.filter((id) => id !== userPk) : [...prev, userPk]
    );
  };

  const handleSaveTeam = async (e) => {
    e.preventDefault();
    if (!teamProject) return;

    setSubmitting(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/projects/${teamProject.project_pk}/users`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ user_ids: teamUserIds })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.detail || 'Error al actualizar el equipo.');
      setTeamProject(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateProject = async (e) => {
    e.preventDefault();
    if (!formData.project_name.trim()) return;

    setSubmitting(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/projects`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.detail || 'Error al crear el proyecto');

      setShowModal(false);
      setFormData({
        project_name: '',
        project_description: '',
        start_date: new Date().toISOString().split('T')[0],
        is_active: true,
        user_ids: []
      });
      await fetchProjects();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const activeProjectId = localStorage.getItem('active_project_id');

  const handleUpdateProject = async (e) => {
    e.preventDefault();
    if (!editingProject || !editingProject.project_name.trim()) return;

    setSubmitting(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/projects/${editingProject.project_pk}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          project_name: editingProject.project_name,
          project_description: editingProject.project_description,
          start_date: editingProject.start_date,
          is_active: true
        })
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.detail || 'Error al actualizar el proyecto');

      if (String(editingProject.project_pk) === localStorage.getItem('active_project_id')) {
        localStorage.setItem('active_project_name', editingProject.project_name);
      }

      setEditingProject(null);
      await fetchProjects();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteProject = async (e, project) => {
    e.stopPropagation();
    if (!window.confirm(`¿Deshabilitar el proyecto "${project.project_name}"? Ya no se podrá acceder a sus vistas.`)) {
      return;
    }

    try {
      const res = await fetch(`${API_URL}/projects/${project.project_pk}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('No se pudo deshabilitar el proyecto');

      if (String(project.project_pk) === localStorage.getItem('active_project_id')) {
        localStorage.removeItem('active_project_id');
        localStorage.removeItem('active_project_name');
      }

      await fetchProjects();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <main className="proj-page">
      <header className="proj-header">
        <div>
          <span className="proj-eyebrow">ESPACIO DE PRODUCCIÓN</span>
          <h1>Seleccion de Proyectos</h1>
          <p>
            {isAdmin
              ? ''
              : 'Selecciona uno de tus proyectos asignados para abrir su pipeline.'}
          </p>
        </div>

        {isAdmin && (
          <button className="proj-primary" onClick={() => setShowModal(true)}>
            ＋ Nuevo proyecto
          </button>
        )}
      </header>

      {error && <div className="proj-error">{error}</div>}

      {projects.length > 0 && (
        <div className="proj-toolbar">
          <div className="proj-stats-pill">
            <strong>{projects.length}</strong>
            <span>{projects.length === 1 ? 'Proyecto disponible' : 'Proyectos disponibles'}</span>
          </div>
          <input
            className="proj-search"
            placeholder="⌕ Buscar proyecto..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      )}

      {loading ? (
        <div className="proj-empty">
          <span>✦</span>
          <h3>Cargando proyectos...</h3>
        </div>
      ) : filteredProjects.length === 0 ? (
        <div className="proj-empty">
          <span>◈</span>
          <h3>
            {search
              ? 'No se encontraron proyectos con ese nombre'
              : isAdmin
              ? 'No se han creado proyectos aun'
              : 'Sin proyectos asignados'}
          </h3>
          <p>
            {search
              ? 'Intenta con otra búsqueda.'
              : isAdmin
              ? 'Crea tu primer proyecto para organizar sus vistas y tareas en el pipeline'
              : 'Aún no estás enlazado a ningún proyecto activo. Contacta a un administrador'}
          </p>
          {isAdmin && !search && (
            <button className="proj-primary" onClick={() => setShowModal(true)}>
              ＋ Crear primer proyecto
            </button>
          )}
        </div>
      ) : (
        <section className="proj-grid">
          {filteredProjects.map((project) => {
            const isCurrent = String(project.project_pk) === activeProjectId;
            return (
              <article
                key={project.project_pk}
                className={`proj-card ${isCurrent ? 'active' : ''}`}
                onClick={() => handleSelectProject(project)}
              >
                <div className="proj-card-top">
                  <span className="proj-badge">
                    {isCurrent ? '● Proyecto actual' : 'Activo'}
                  </span>
                  <small>{project.start_date}</small>
                </div>

                <h3>{project.project_name}</h3>
                <p>
                  {project.project_description || 'Sin descripción registrada.'}
                </p>

                <div className="proj-card-footer">
                  <span>Abrir Pipeline →</span>

                  {isAdmin && (
                    <div className="proj-card-admin-actions">
                      <button
                        type="button"
                        className="proj-icon-btn team"
                        title="Agregar o gestionar usuarios"
                        onClick={(e) => openTeamModal(e, project)}
                      >
                        👥 Equipo
                      </button>
                      <button
                        type="button"
                        className="proj-icon-btn edit"
                        title="Editar proyecto"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingProject({ ...project });
                        }}
                      >
                        ✎
                      </button>
                      <button
                        type="button"
                        className="proj-icon-btn delete"
                        title="Deshabilitar proyecto"
                        onClick={(e) => handleDeleteProject(e, project)}
                      >
                        🗑
                      </button>
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </section>
      )}

      {/* Modal: Gestionar usuarios de un proyecto existente */}
      {teamProject && isAdmin && (
        <div className="proj-modal-backdrop" onClick={() => setTeamProject(null)}>
          <div className="proj-modal" onClick={(e) => e.stopPropagation()}>
            <div className="proj-modal-header">
              <div>
                <span className="proj-eyebrow">EQUIPO DEL PROYECTO</span>
                <h2>{teamProject.project_name}</h2>
              </div>
              <button className="proj-close" onClick={() => setTeamProject(null)}>
                ×
              </button>
            </div>

            <form className="proj-form" onSubmit={handleSaveTeam}>
              <div className="proj-field">
                <label>
                  Selecciona los usuarios con acceso ({teamUserIds.length} seleccionados)
                </label>

                {loadingTeam ? (
                  <small className="proj-users-empty">Cargando miembros...</small>
                ) : (
                  <div className="proj-users-list">
                    {users.length === 0 ? (
                      <small className="proj-users-empty">
                        No hay usuarios activos disponibles.
                      </small>
                    ) : (
                      users.map((u) => {
                        const selected = teamUserIds.includes(u.user_pk);
                        return (
                          <label
                            key={u.user_pk}
                            className={`proj-user-item ${selected ? 'selected' : ''}`}
                          >
                            <input
                              type="checkbox"
                              checked={selected}
                              onChange={() => toggleTeamUser(u.user_pk)}
                            />
                            <div>
                              <strong>{u.user_name}</strong>
                              <span>{u.user_email}</span>
                            </div>
                          </label>
                        );
                      })
                    )}
                  </div>
                )}
              </div>

              <div className="proj-modal-footer">
                <button
                  type="button"
                  className="proj-outline"
                  onClick={() => setTeamProject(null)}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="proj-primary"
                  disabled={submitting || loadingTeam}
                >
                  {submitting ? 'Guardando...' : 'Guardar equipo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Crear proyecto */}
      {showModal && isAdmin && (
        <div className="proj-modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="proj-modal" onClick={(e) => e.stopPropagation()}>
            <div className="proj-modal-header">
              <div>
                <span className="proj-eyebrow"></span>
                <h2>Crear proyecto</h2>
              </div>
              <button className="proj-close" onClick={() => setShowModal(false)}>
                ×
              </button>
            </div>

            <form className="proj-form" onSubmit={handleCreateProject}>
              <div className="proj-field">
                <label htmlFor="proj-name">Nombre del proyecto *</label>
                <input
                  id="proj-name"
                  required
                  autoFocus
                  placeholder="Ej. Cortometraje Piloto 2026"
                  value={formData.project_name}
                  onChange={(e) =>
                    setFormData({ ...formData, project_name: e.target.value })
                  }
                />
              </div>

              <div className="proj-field">
                <label htmlFor="proj-desc">Descripcion</label>
                <textarea
                  id="proj-desc"
                  rows={3}
                  placeholder="Describe brevemente el estilo, duración o metas del proyecto..."
                  value={formData.project_description}
                  onChange={(e) =>
                    setFormData({ ...formData, project_description: e.target.value })
                  }
                />
              </div>

              <div className="proj-field">
                <label htmlFor="proj-date">Fecha de inicio</label>
                <input
                  id="proj-date"
                  type="date"
                  value={formData.start_date}
                  onChange={(e) =>
                    setFormData({ ...formData, start_date: e.target.value })
                  }
                />
              </div>

              <div className="proj-field">
                <label>
                  Asignar usuarios al proyecto ({formData.user_ids.length} seleccionados)
                </label>
                <div className="proj-users-list">
                  {users.length === 0 ? (
                    <small className="proj-users-empty">
                      No se encontraron usuarios activos en la base de datos.
                    </small>
                  ) : (
                    users.map((u) => {
                      const selected = formData.user_ids.includes(u.user_pk);
                      return (
                        <label
                          key={u.user_pk}
                          className={`proj-user-item ${selected ? 'selected' : ''}`}
                        >
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() => toggleUserSelection(u.user_pk)}
                          />
                          <div>
                            <strong>{u.user_name}</strong>
                            <span>{u.user_email}</span>
                          </div>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="proj-modal-footer">
                <button
                  type="button"
                  className="proj-outline"
                  onClick={() => setShowModal(false)}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="proj-primary"
                  disabled={submitting}
                >
                  {submitting ? 'Creando...' : 'Crear proyecto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Editar proyecto */}
      {editingProject && isAdmin && (
        <div className="proj-modal-backdrop" onClick={() => setEditingProject(null)}>
          <div className="proj-modal" onClick={(e) => e.stopPropagation()}>
            <div className="proj-modal-header">
              <div>
                <span className="proj-eyebrow">EDITAR PRODUCCIÓN</span>
                <h2>Modificar proyecto</h2>
              </div>
              <button className="proj-close" onClick={() => setEditingProject(null)}>
                ×
              </button>
            </div>

            <form className="proj-form" onSubmit={handleUpdateProject}>
              <div className="proj-field">
                <label>Nombre del proyecto *</label>
                <input
                  required
                  value={editingProject.project_name}
                  onChange={(e) =>
                    setEditingProject({ ...editingProject, project_name: e.target.value })
                  }
                />
              </div>

              <div className="proj-field">
                <label>Descripción</label>
                <textarea
                  rows={3}
                  value={editingProject.project_description || ''}
                  onChange={(e) =>
                    setEditingProject({ ...editingProject, project_description: e.target.value })
                  }
                />
              </div>

              <div className="proj-field">
                <label>Fecha de inicio</label>
                <input
                  type="date"
                  value={editingProject.start_date || ''}
                  onChange={(e) =>
                    setEditingProject({ ...editingProject, start_date: e.target.value })
                  }
                />
              </div>

              <div className="proj-modal-footer">
                <button
                  type="button"
                  className="proj-outline"
                  onClick={() => setEditingProject(null)}
                >
                  Cancelar
                </button>
                <button type="submit" className="proj-primary" disabled={submitting}>
                  {submitting ? 'Guardando...' : 'Guardar cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}