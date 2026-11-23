import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Usuarios.css';

const API_URL = 'http://localhost:8000';

export default function Usuarios() {
  const navigate = useNavigate();
  const token = localStorage.getItem('fastapi_token');
  const userRole = (localStorage.getItem('user_role') || '').toLowerCase();
  const isAdmin = userRole === 'admin';

  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all'); // 'all' | '1' | '2'
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    user_name: '',
    user_email: '',
    user_password: '',
    role_pk: 2,
    is_active: true
  });

  const [editingUser, setEditingUser] = useState(null);

  useEffect(() => {
    if (!isAdmin) {
      navigate('/proyectos', { replace: true });
      return;
    }
    fetchUsers();
  }, [isAdmin, navigate]);

  const fetchUsers = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/users`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('No se pudieron cargar los usuarios.');
      const json = await res.json();
      setUsers(json.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const matchesRole =
        roleFilter === 'all' || String(u.role_pk) === roleFilter;
      const q = search.trim().toLowerCase();
      const matchesQuery =
        !q ||
        u.user_name.toLowerCase().includes(q) ||
        u.user_email.toLowerCase().includes(q);
      return matchesRole && matchesQuery;
    });
  }, [users, search, roleFilter]);

  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (!formData.user_name.trim() || !formData.user_email.trim() || !formData.user_password.trim()) {
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          ...formData,
          role_pk: Number(formData.role_pk),
          user_status: 'Activo'
        })
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.detail || 'Error al crear usuario');

      setShowCreateModal(false);
      setFormData({
        user_name: '',
        user_email: '',
        user_password: '',
        role_pk: 2,
        is_active: true
      });
      await fetchUsers();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateUser = async (e) => {
    e.preventDefault();
    if (!editingUser) return;

    setSubmitting(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/users/${editingUser.user_pk}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          user_name: editingUser.user_name,
          user_email: editingUser.user_email,
          user_password: editingUser.new_password || null,
          user_status: editingUser.is_active ? 'Activo' : 'Inactivo',
          is_active: editingUser.is_active,
          role_pk: Number(editingUser.role_pk)
        })
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.detail || 'Error al actualizar usuario');

      setEditingUser(null);
      await fetchUsers();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (user) => {
    try {
      if (user.is_active) {
        if (!window.confirm(`¿Desactivar al usuario "${user.user_name}"?`)) return;
        const res = await fetch(`${API_URL}/users/${user.user_pk}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('No se pudo desactivar el usuario');
      } else {
        const res = await fetch(`${API_URL}/users/${user.user_pk}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            user_name: user.user_name,
            user_email: user.user_email,
            user_status: 'Activo',
            is_active: true,
            role_pk: Number(user.role_pk)
          })
        });
        if (!res.ok) throw new Error('No se pudo reactivar el usuario');
      }
      await fetchUsers();
    } catch (err) {
      setError(err.message);
    }
  };

  if (!isAdmin) return null;

  const totalAdmins = users.filter((u) => u.role_pk === 1).length;
  const totalRegular = users.filter((u) => u.role_pk === 2).length;

  return (
    <main className="usr-page">
      <header className="usr-header">
        <div>
          <span className="usr-eyebrow">ADMINISTRACIÓN DE EQUIPO</span>
          <h1>Gestión de Usuarios</h1>
          <p></p>
        </div>

        <button className="usr-primary" onClick={() => setShowCreateModal(true)}>
          ＋ Nuevo usuario
        </button>
      </header>

      {error && <div className="usr-error">{error}</div>}

      {/* tarjetita  */}
      <div className="usr-stats">
        <div>
          <strong>{users.length}</strong>
          <span>Total de usuarios</span>
        </div>
        <div>
          <strong>{totalAdmins}</strong>
          <span>Administradores</span>
        </div>
        <div>
          <strong>{totalRegular}</strong>
          <span>Usuarios estándar</span>
        </div>
      </div>

      {/* Filtro */}
      <div className="usr-toolbar">
        <div className="usr-filter-pills">
          <button
            className={roleFilter === 'all' ? 'active' : ''}
            onClick={() => setRoleFilter('all')}
          >
            Todos
          </button>
          <button
            className={roleFilter === '1' ? 'active' : ''}
            onClick={() => setRoleFilter('1')}
          >
            Administradores
          </button>
          <button
            className={roleFilter === '2' ? 'active' : ''}
            onClick={() => setRoleFilter('2')}
          >
            Usuarios
          </button>
        </div>

        <input
          className="usr-search"
          placeholder="⌕ ..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="usr-empty">
          <span>✦</span>
          <h3>Cargando usuarios...</h3>
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="usr-empty">
          <span>◈</span>
          <h3>No se encontraron usuarios</h3>
          <p>Prueba ajustando los filtros o crea un nuevo usuario para el equipo.</p>
        </div>
      ) : (
        <section className="usr-grid">
          {filteredUsers.map((u) => {
            const isRoleAdmin = u.role_pk === 1;
            return (
              <article
                key={u.user_pk}
                className={`usr-card ${!u.is_active ? 'inactive' : ''}`}
              >
                <div className="usr-card-top">
                  <span className={`usr-role-badge ${isRoleAdmin ? 'admin' : 'user'}`}>
                    {isRoleAdmin ? '★ Admin' : '● User'}
                  </span>
                  <span className={`usr-status ${u.is_active ? 'on' : 'off'}`}>
                    {u.is_active ? 'Activo' : 'Inactivo'}
                  </span>
                </div>

                <div className="usr-identity">
                  <div className="usr-avatar">
                    {u.user_name.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h3>{u.user_name}</h3>
                    <p>{u.user_email}</p>
                  </div>
                </div>

                <div className="usr-card-actions">
                  <button
                    className="usr-btn-edit"
                    onClick={() => setEditingUser({ ...u, new_password: '' })}
                  >
                    ✎ Editar rol / datos
                  </button>
                  <button
                    className={`usr-btn-toggle ${u.is_active ? 'danger' : 'restore'}`}
                    onClick={() => handleToggleActive(u)}
                  >
                    {u.is_active ? 'Desactivar' : 'Reactivar'}
                  </button>
                </div>
              </article>
            );
          })}
        </section>
      )}

      {/* Creacion de Usarios */}
      {showCreateModal && (
        <div className="usr-modal-backdrop" onClick={() => setShowCreateModal(false)}>
          <div className="usr-modal" onClick={(e) => e.stopPropagation()}>
            <div className="usr-modal-header">
              <div>
                <span className="usr-eyebrow">ALTA DE EQUIPO</span>
                <h2>Crear nuevo usuario</h2>
              </div>
              <button className="usr-close" onClick={() => setShowCreateModal(false)}>
                ×
              </button>
            </div>

            <form className="usr-form" onSubmit={handleCreateUser}>
              <div className="usr-field">
                <label htmlFor="usr-name">Nombre de usuario *</label>
                <input
                  id="usr-name"
                  required
                  autoFocus
                  placeholder="Ej. ana_animadora"
                  value={formData.user_name}
                  onChange={(e) => setFormData({ ...formData, user_name: e.target.value })}
                />
              </div>

              <div className="usr-field">
                <label htmlFor="usr-email">Correo electrónico *</label>
                <input
                  id="usr-email"
                  type="email"
                  required
                  placeholder="ana@estudio.com"
                  value={formData.user_email}
                  onChange={(e) => setFormData({ ...formData, user_email: e.target.value })}
                />
              </div>

              <div className="usr-field">
                <label htmlFor="usr-pass">Contraseña *</label>
                <input
                  id="usr-pass"
                  type="password"
                  required
                  placeholder="••••••••"
                  value={formData.user_password}
                  onChange={(e) => setFormData({ ...formData, user_password: e.target.value })}
                />
              </div>

              <div className="usr-field">
                <label>Rol asignado *</label>
                <div className="usr-role-selector">
                  <button
                    type="button"
                    className={`usr-role-option ${Number(formData.role_pk) === 2 ? 'selected' : ''}`}
                    onClick={() => setFormData({ ...formData, role_pk: 2 })}
                  >
                    <strong>Usuario (User)</strong>
                    <small>Acceso a proyectos asignados, pipeline y subida de assets.</small>
                  </button>

                  <button
                    type="button"
                    className={`usr-role-option ${Number(formData.role_pk) === 1 ? 'selected' : ''}`}
                    onClick={() => setFormData({ ...formData, role_pk: 1 })}
                  >
                    <strong>Administrador (Admin)</strong>
                    <small>Control total de proyectos, vistas, usuarios y producción.</small>
                  </button>
                </div>
              </div>

              <div className="usr-modal-footer">
                <button
                  type="button"
                  className="usr-outline"
                  onClick={() => setShowCreateModal(false)}
                >
                  Cancelar
                </button>
                <button type="submit" className="usr-primary" disabled={submitting}>
                  {submitting ? 'Creando...' : 'Crear usuario'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Editar Usuario */}
      {editingUser && (
        <div className="usr-modal-backdrop" onClick={() => setEditingUser(null)}>
          <div className="usr-modal" onClick={(e) => e.stopPropagation()}>
            <div className="usr-modal-header">
              <div>
                <span className="usr-eyebrow">EDITAR CUENTA</span>
                <h2>Modificar usuario</h2>
              </div>
              <button className="usr-close" onClick={() => setEditingUser(null)}>
                ×
              </button>
            </div>

            <form className="usr-form" onSubmit={handleUpdateUser}>
              <div className="usr-field">
                <label>Nombre de usuario *</label>
                <input
                  required
                  value={editingUser.user_name}
                  onChange={(e) => setEditingUser({ ...editingUser, user_name: e.target.value })}
                />
              </div>

              <div className="usr-field">
                <label>Correo electrónico *</label>
                <input
                  type="email"
                  required
                  value={editingUser.user_email}
                  onChange={(e) => setEditingUser({ ...editingUser, user_email: e.target.value })}
                />
              </div>

              <div className="usr-field">
                <label>Nueva contraseña (opcional)</label>
                <input
                  type="password"
                  placeholder="Dejar vacío para conservar la actual"
                  value={editingUser.new_password}
                  onChange={(e) => setEditingUser({ ...editingUser, new_password: e.target.value })}
                />
              </div>

              <div className="usr-field">
                <label>Rol asignado</label>
                <div className="usr-role-selector">
                  <button
                    type="button"
                    className={`usr-role-option ${Number(editingUser.role_pk) === 2 ? 'selected' : ''}`}
                    onClick={() => setEditingUser({ ...editingUser, role_pk: 2 })}
                  >
                    <strong>Usuario (User)</strong>
                    <small>Acceso estándar a sus proyectos.</small>
                  </button>

                  <button
                    type="button"
                    className={`usr-role-option ${Number(editingUser.role_pk) === 1 ? 'selected' : ''}`}
                    onClick={() => setEditingUser({ ...editingUser, role_pk: 1 })}
                  >
                    <strong>Administrador (Admin)</strong>
                    <small>Control total del sistema.</small>
                  </button>
                </div>
              </div>

              <div className="usr-modal-footer">
                <button
                  type="button"
                  className="usr-outline"
                  onClick={() => setEditingUser(null)}
                >
                  Cancelar
                </button>
                <button type="submit" className="usr-primary" disabled={submitting}>
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