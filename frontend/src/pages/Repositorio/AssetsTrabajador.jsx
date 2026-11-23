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
      .then(response => response.json())
      .then(({ tasks: assigned }) => {
        if (controller.signal.aborted) return;
        setTasks(assigned);
        setProjectId(String(assigned[0]?.project_pk ?? ''));
      })
      .catch(error => {
        if (!controller.signal.aborted) setError(error.message);
      });
    return () => controller.abort();
  }, []);

  const projects = new Map(tasks?.map(task => [task.project_pk, task.project_name]));
  const projectTasks = new Map(tasks?.filter(task => String(task.project_pk) === projectId)
    .map(task => [task.tasks_pk, task]));

  return (
    <section className="repo-page">
      <header className="repo-header"><h1>Mis assets</h1></header>
      {error && <p role="alert">{error}</p>}
      {tasks === null && !error && <p role="status">Cargando tareas…</p>}
      {tasks?.length === 0 && <p>No tienes tareas asignadas a un proyecto activo.</p>}
      {projects.size > 0 && (
        <>
          <div className="repo-project-bar">
            <div>
              <label htmlFor="worker-project">Proyecto</label>
              <select id="worker-project" value={projectId} onChange={event => setProjectId(event.target.value)}>
                {Array.from(projects, ([id, name]) => <option key={id} value={id}>{name || id}</option>)}
              </select>
            </div>
          </div>
          {Array.from(projectTasks.values(), task => (
            <section key={`${task.project_pk}-${task.tasks_pk}`}>
              <h2>{task.task_name}</h2>
              <AssetsTarea proyectoId={task.project_pk} tareaId={task.tasks_pk} />
            </section>
          ))}
        </>
      )}
    </section>
  );
}
