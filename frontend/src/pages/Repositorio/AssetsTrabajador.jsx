import { useEffect, useState } from 'react';
import AssetsTarea, { requestTaskAssets } from '../../components/Sidebar/AssetsTarea';
import './Repositorio.css';

export default function AssetsTrabajador() {
  const [tasks, setTasks] = useState(null);
  const [projectId, setProjectId] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    requestTaskAssets('/me/task-asset-contexts', controller.signal)
      .then((response) => response.json())
      .then(({ tasks: assigned }) => {
        if (controller.signal.aborted) return;
        setTasks(assigned);

        const activeId = localStorage.getItem('active_project_id');
        const hasActive =
          activeId && assigned?.some((t) => String(t.project_pk) === String(activeId));

        setProjectId(
          hasActive ? String(activeId) : String(assigned?.[0]?.project_pk ?? '')
        );
      })
      .catch((err) => {
        if (!controller.signal.aborted) setError(err.message);
      });
    return () => controller.abort();
  }, []);

  const projects = new Map(tasks?.map((task) => [task.project_pk, task.project_name]));
  const projectTasks = new Map(
    tasks
      ?.filter((task) => String(task.project_pk) === projectId)
      .map((task) => [task.tasks_pk, task])
  );

  return (
    <section className="repo-page">
      <header className="repo-header">
        <div>
          <span className="repo-eyebrow">ESPACIO DE TRABAJO</span>
          <h1>Mis assets</h1>
          <p>Consulta, previsualiza y descarga los archivos vinculados a tus tareas asignadas.</p>
        </div>
      </header>

      {error && (
        <p className="repo-worker-error" role="alert">
          {error}
        </p>
      )}

      {tasks === null && !error && (
        <div className="repo-empty">
          <span>✦</span>
          <p role="status">Cargando tareas…</p>
        </div>
      )}

      {tasks?.length === 0 && (
        <div className="repo-empty">
          <span>◈</span>
          <p>No tienes tareas asignadas a un proyecto activo.</p>
        </div>
      )}

      {projects.size > 0 && (
        <>
          <div className="repo-project-bar">
            <div>
              <label htmlFor="worker-project">Proyecto</label>
              <select
                id="worker-project"
                value={projectId}
                onChange={(event) => setProjectId(event.target.value)}
              >
                {Array.from(projects, ([id, name]) => (
                  <option key={id} value={id}>
                    {name || id}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="repo-worker-stats">
            <div>
              <strong>{projects.size}</strong>
              <span>{projects.size === 1 ? 'Proyecto asignado' : 'Proyectos asignados'}</span>
            </div>
            <div>
              <strong>{projectTasks.size}</strong>
              <span>
                {projectTasks.size === 1
                  ? 'Tarea en este proyecto'
                  : 'Tareas en este proyecto'}
              </span>
            </div>
          </div>

          <div className="repo-worker-grid">
            {Array.from(projectTasks.values(), (task) => (
              <section
                key={`${task.project_pk}-${task.tasks_pk}`}
                className="repo-worker-panel"
              >
                <div className="repo-worker-panel-header">
                  <div>
                    <span className="repo-eyebrow">
                      {task.views_name ? `VISTA · ${task.views_name}` : 'TAREA ASIGNADA'}
                    </span>
                    <h2>{task.task_name}</h2>
                  </div>
                  <span className="repo-worker-badge">● Activa</span>
                </div>

                <AssetsTarea proyectoId={task.project_pk} tareaId={task.tasks_pk} />
              </section>
            ))}
          </div>
        </>
      )}
    </section>
  );
}