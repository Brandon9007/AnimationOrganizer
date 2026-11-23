import React, { useState, useEffect, useMemo } from "react";
import { Gantt } from "gantt-task-react";
import "gantt-task-react/dist/index.css";
import "./Cronograma.css";

const API_URL = "http://localhost:8000";

const parseLocalDate = (dateStr) => {
  if (!dateStr) return new Date();
  const [year, month, day] = String(dateStr).split("T")[0].split("-").map(Number);
  return new Date(year, month - 1, day);
};

export default function Cronograma() {
  const token = localStorage.getItem("fastapi_token");
  const activeProjectId = localStorage.getItem("active_project_id");
  const activeProjectName = localStorage.getItem("active_project_name");
  const isAdmin = (localStorage.getItem("user_role") || "").toLowerCase() === "admin";

  const [tasks, setTasks] = useState([]);
  const [selectedTask, setSelectedTask] = useState(null);
  const [users, setUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchCronograma = async () => {
    setLoading(true);
    setError("");
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const [cronoRes, viewsRes, allTasksRes] = await Promise.all([
        fetch(`${API_URL}/cronograma`, { headers }),
        activeProjectId
          ? fetch(`${API_URL}/projects/${activeProjectId}/views`, { headers })
          : Promise.resolve(null),
        activeProjectId
          ? fetch(`${API_URL}/tasks`, { headers })
          : Promise.resolve(null),
      ]);

      if (!cronoRes.ok) throw new Error(`Error HTTP: ${cronoRes.status}`);
      let data = await cronoRes.json();

      if (activeProjectId && viewsRes?.ok && allTasksRes?.ok) {
        const viewsJson = await viewsRes.json();
        const tasksJson = await allTasksRes.json();
        const projectViewIds = new Set((viewsJson.data || []).map((v) => v.views_pk));
        const projectTaskIds = new Set(
          (tasksJson.data || [])
            .filter((t) => projectViewIds.has(t.views_pk))
            .map((t) => t.tasks_pk)
        );
        data = data.filter((item) => projectTaskIds.has(item.task_id));
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const formattedTasks = data.map((t) => {
        const dueDate = parseLocalDate(t.due_date);
        let startDate = parseLocalDate(t.start_date);

        if (startDate > dueDate) {
          startDate = new Date(dueDate);
        }

        const safeEndDate = new Date(dueDate);
        if (startDate.getTime() === safeEndDate.getTime()) {
          safeEndDate.setHours(23, 59, 59, 999);
        }

        let bgColor = "#d978b8";
        let progColor = "#b85597";
        let statusKey = "pending";
        let taskProgress = 0;
        const currentStatus = t.status ? t.status.trim().toLowerCase() : "";

        const isOverdue =
          dueDate < today &&
          currentStatus !== "completado" &&
          currentStatus !== "completada" &&
          currentStatus !== "cancelado" &&
          currentStatus !== "cancelada";

        if (currentStatus === "completado" || currentStatus === "completada") {
          bgColor = "#22c55e";
          progColor = "#16a34a";
          statusKey = "completed";
          taskProgress = 100;
        } else if (currentStatus === "cancelado" || currentStatus === "cancelada") {
          bgColor = "#a89bb8";
          progColor = "#7c6f8c";
          statusKey = "cancelled";
          taskProgress = 0;
        } else if (isOverdue) {
          bgColor = "#f59e0b";
          progColor = "#d97706";
          statusKey = "overdue";
          taskProgress = currentStatus === "en proceso" || currentStatus === "en progreso" ? 50 : 15;
        } else if (currentStatus === "en proceso" || currentStatus === "en progreso") {
          bgColor = "#8b68e8";
          progColor = "#6c47d1";
          statusKey = "in_progress";
          taskProgress = 50;
        }

        const statusLabel = isOverdue
          ? `${t.status || "Pendiente"} (Atrasada)`
          : t.status || "Pendiente";

        return {
          start: startDate,
          end: safeEndDate,
          rawTaskName: t.task_name,
          assignedUserName: t.assigned_user || "Sin asignar",
          name: `${t.task_name} (${t.assigned_user || "Sin asignar"})`,
          id: t.task_id.toString(),
          type: "task",
          progress: taskProgress,
          status: statusLabel,
          statusKey,
          assignedUserId: t.assigned_user_id,
          isDisabled: false,
          styles: {
            backgroundColor: bgColor,
            progressColor: progColor,
          },
        };
      });

      setTasks(formattedTasks);
    } catch (err) {
      setError("No se pudo cargar el cronograma.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCronograma();
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    fetch(`${API_URL}/cronograma/usuarios`, { headers })
      .then((res) => {
        if (!res.ok) throw new Error(`Error HTTP: ${res.status}`);
        return res.json();
      })
      .then((data) => setUsers(data))
      .catch((err) => console.error(err));
  }, [activeProjectId]);

  const handleAsignarUsuario = async () => {
    if (!selectedTask || !isAdmin) return;
    setIsSaving(true);
    try {
      const response = await fetch(
        `${API_URL}/cronograma/${selectedTask.id}/asignar`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            user_pk: selectedUserId ? Number(selectedUserId) : null,
          }),
        }
      );

      if (!response.ok) throw new Error(`Error HTTP: ${response.status}`);

      await fetchCronograma();
      setSelectedTask(null);
    } catch (err) {
      console.error(err);
      alert("No se pudo guardar la asignación.");
    } finally {
      setIsSaving(false);
    }
  };

  const metrics = useMemo(() => {
    const total = tasks.length;
    const assigned = tasks.filter(
      (t) => t.assignedUserId !== null && t.assignedUserId !== undefined
    ).length;
    const unassigned = total - assigned;
    const assignedPct = total > 0 ? Math.round((assigned / total) * 100) : 0;
    const unassignedPct = total > 0 ? 100 - assignedPct : 0;

    const statusCounts = {
      completed: tasks.filter((t) => t.statusKey === "completed").length,
      in_progress: tasks.filter((t) => t.statusKey === "in_progress").length,
      pending: tasks.filter((t) => t.statusKey === "pending").length,
      overdue: tasks.filter((t) => t.statusKey === "overdue").length,
      cancelled: tasks.filter((t) => t.statusKey === "cancelled").length,
    };

    return {
      total,
      assigned,
      unassigned,
      assignedPct,
      unassignedPct,
      statusCounts,
    };
  }, [tasks]);

  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const assignedDash = (metrics.assignedPct / 100) * circumference;

  const statusSummaryList = [
    { key: "completed", label: "Completadas", count: metrics.statusCounts.completed },
    { key: "in_progress", label: "En Progreso", count: metrics.statusCounts.in_progress },
    { key: "pending", label: "Pendientes", count: metrics.statusCounts.pending },
    { key: "overdue", label: "Atrasadas", count: metrics.statusCounts.overdue },
    { key: "cancelled", label: "Canceladas", count: metrics.statusCounts.cancelled },
  ];

  return (
    <main className="crono-page">
      <div className="cronograma-container">
        <header className="crono-header">
          <div>
            <span className="crono-eyebrow">PLANIFICACIÓN Y SEGUIMIENTO</span>
            <h1>Cronograma de Producción</h1>
            <p>
              
            </p>
          </div>
          {activeProjectName && (
            <div className="crono-project-badge">
              <small>PROYECTO ACTIVO</small>
              <strong>{activeProjectName}</strong>
            </div>
          )}
        </header>

        {error && <div className="crono-error">{error}</div>}

        {loading ? (
          <div className="crono-empty">
            <span>✦</span>
            <h3>Cargando cronograma...</h3>
          </div>
        ) : tasks.length === 0 ? (
          <div className="crono-empty">
            <span>◈</span>
            <h3>No hay actividades programadas</h3>
            <p>Crea tareas dentro de las vistas del proyecto para visualizarlas en el cronograma.</p>
          </div>
        ) : (
          <>
            <section className="crono-analytics-grid">
              <article className="crono-card crono-pie-card">
                <div className="crono-card-head">
                  <span className="crono-eyebrow">DISTRIBUCIÓN DE EQUIPO</span>
                  <h3>Tareas Asignadas</h3>
                </div>

                <div className="crono-pie-body">
                  <div className="crono-pie-chart">
                    <svg viewBox="0 0 140 140" className="crono-pie-svg">
                      <defs>
                        <linearGradient id="cronoPieGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="#8b68e8" />
                          <stop offset="100%" stopColor="#d978b8" />
                        </linearGradient>
                      </defs>
                      <circle
                        cx="70"
                        cy="70"
                        r={radius}
                        fill="transparent"
                        stroke="#f6e3f0"
                        strokeWidth="18"
                      />
                      <circle
                        cx="70"
                        cy="70"
                        r={radius}
                        fill="transparent"
                        stroke="url(#cronoPieGrad)"
                        strokeWidth="18"
                        strokeDasharray={`${assignedDash} ${circumference}`}
                        strokeLinecap="round"
                        transform="rotate(-90 70 70)"
                      />
                    </svg>
                    <div className="crono-pie-center">
                      <strong>{metrics.assignedPct}%</strong>
                      <span>Asignadas</span>
                    </div>
                  </div>

                  <div className="crono-pie-legend">
                    <div className="crono-legend-item">
                      <span className="crono-dot assigned" />
                      <div>
                        <strong>Tareas asignadas</strong>
                        <small>
                          {metrics.assigned} de {metrics.total} ({metrics.assignedPct}%)
                        </small>
                      </div>
                    </div>

                    <div className="crono-legend-item">
                      <span className="crono-dot unassigned" />
                      <div>
                        <strong>Sin asignar</strong>
                        <small>
                          {metrics.unassigned} de {metrics.total} ({metrics.unassignedPct}%)
                        </small>
                      </div>
                    </div>
                  </div>
                </div>
              </article>

              <article className="crono-card crono-status-card">
                <div className="crono-card-head">
                  <span className="crono-eyebrow">AVANCE GENERAL</span>
                  <h3>Estado de las Actividades</h3>
                </div>

                <div className="crono-status-bars">
                  {statusSummaryList.map((st) => {
                    const pct = metrics.total > 0 ? Math.round((st.count / metrics.total) * 100) : 0;
                    return (
                      <div key={st.key} className="crono-status-row">
                        <div className="crono-status-row-top">
                          <span className={`crono-status-pill ${st.key}`}>{st.label}</span>
                          <strong>
                            {st.count} ({pct}%)
                          </strong>
                        </div>
                        <div className="crono-bar-track">
                          <div
                            className={`crono-bar-fill ${st.key}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </article>
            </section>

            <section className="crono-card crono-gantt-card">
              <div className="crono-card-head">
                <span className="crono-eyebrow">LÍNEA DE TIEMPO</span>
                <h3>Diagrama de Gantt</h3>
              </div>

              <div className="gantt-wrapper">
                <Gantt
                  tasks={tasks}
                  viewMode="Day"
                  locale="es"
                  listCellWidth="230px"
                  columnWidth={80}
                  rowHeight={50}
                  fontSize={12}
                  onClick={(task) => {
                    const fullTask = tasks.find((t) => t.id === task.id) || task;
                    setSelectedTask(fullTask);
                    setSelectedUserId(
                      fullTask.assignedUserId ? String(fullTask.assignedUserId) : ""
                    );
                  }}
                  TooltipContent={() => null}
                />
              </div>
            </section>

            <section className="crono-card">
              <div className="crono-card-head">
                <span className="crono-eyebrow">DETALLE POR ACTIVIDAD</span>
                <h3>Estado y Responsable</h3>
              </div>

              <div className="crono-table-wrap">
                <table className="crono-table">
                  <thead>
                    <tr>
                      <th>Actividad</th>
                      <th>Responsable</th>
                      <th>Inicio</th>
                      <th>Entrega</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tasks.map((t) => (
                      <tr
                        key={t.id}
                        onClick={() => {
                          setSelectedTask(t);
                          setSelectedUserId(t.assignedUserId ? String(t.assignedUserId) : "");
                        }}
                      >
                        <td>
                          <strong>{t.rawTaskName}</strong>
                        </td>
                        <td>
                          <span
                            className={`crono-user-chip ${
                              t.assignedUserId ? "assigned" : "unassigned"
                            }`}
                          >
                            {t.assignedUserName}
                          </span>
                        </td>
                        <td>{t.start.toLocaleDateString("es-ES")}</td>
                        <td>{t.end.toLocaleDateString("es-ES")}</td>
                        <td>
                          <span className={`crono-status-pill ${t.statusKey}`}>
                            {t.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}

        {selectedTask && (
          <div className="crono-modal-backdrop" onClick={() => setSelectedTask(null)}>
            <div className="crono-modal" onClick={(e) => e.stopPropagation()}>
              <div className="crono-modal-header">
                <div>
                  <span className="crono-eyebrow">DETALLES DE ACTIVIDAD</span>
                  <h3>{selectedTask.rawTaskName}</h3>
                </div>
                <button className="crono-close" onClick={() => setSelectedTask(null)}>
                  ×
                </button>
              </div>

              <div className="crono-modal-body">
                <div className="crono-detail-row">
                  <span>Estado actual:</span>
                  <span className={`crono-status-pill ${selectedTask.statusKey}`}>
                    {selectedTask.status}
                  </span>
                </div>

                <div className="crono-detail-row">
                  <span>Fecha de inicio:</span>
                  <strong>{selectedTask.start.toLocaleDateString("es-ES")}</strong>
                </div>

                <div className="crono-detail-row">
                  <span>Fecha límite:</span>
                  <strong>{selectedTask.end.toLocaleDateString("es-ES")}</strong>
                </div>

                <div className="crono-detail-row">
                  <span>Progreso:</span>
                  <span className="crono-progress-badge">{selectedTask.progress}%</span>
                </div>

                {isAdmin ? (
                  <div className="crono-assign-field">
                    <label htmlFor="crono-user-select">Asignar responsable:</label>
                    <select
                      id="crono-user-select"
                      value={selectedUserId}
                      onChange={(e) => setSelectedUserId(e.target.value)}
                    >
                      <option value="">Sin asignar</option>
                      {users.map((u) => (
                        <option key={u.user_pk} value={u.user_pk}>
                          {u.user_name}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="crono-detail-row">
                    <span>Responsable:</span>
                    <strong>{selectedTask.assignedUserName}</strong>
                  </div>
                )}
              </div>

              <div className="crono-modal-footer">
                <button
                  type="button"
                  className="crono-outline"
                  onClick={() => setSelectedTask(null)}
                >
                  Cerrar
                </button>
                {isAdmin && (
                  <button
                    type="button"
                    className="crono-primary"
                    onClick={handleAsignarUsuario}
                    disabled={isSaving}
                  >
                    {isSaving ? "Guardando..." : "Guardar asignación"}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}