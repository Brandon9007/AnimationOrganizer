import React, { useState, useRef } from 'react';
import AssetsTarea from '../../components/Sidebar/AssetsTarea';

const API_BASE_URL = 'http://localhost:8000';

function TasksSection({
  viewId,
  assetContexts,
  canManage,
  isAdmin,
  tasks,
  openTaskModal,
  openEditTaskModal,
  handleToggleLock,
  handleDeleteTask,
  handleToggleStatus,
  taskComments,
  fetchTaskComments,
  handleAddComment,
  currentUsername,
  fetchTasks
}) {
  const token = localStorage.getItem('fastapi_token');

  const viewTasks = new Map(
    tasks
      .filter((task) => task.views_pk === viewId && task.is_active !== false)
      .map((task) => [task.tasks_pk, task])
  );

  const projectsByTask = new Map();
  for (const context of assetContexts) {
    if (!viewTasks.has(context.tasks_pk)) {
      viewTasks.set(context.tasks_pk, { ...context, assetsOnly: true });
    }
    if (!projectsByTask.has(context.tasks_pk)) projectsByTask.set(context.tasks_pk, []);
    projectsByTask.get(context.tasks_pk).push(context);
  }

  const [openChatTaskId, setOpenChatTaskId] = useState(null);
  const [newCommentText, setNewCommentText] = useState('');
  const fileInputRefs = useRef({});

  const toggleChat = (taskId) => {
    if (openChatTaskId === taskId) {
      setOpenChatTaskId(null);
    } else {
      setOpenChatTaskId(taskId);
      fetchTaskComments(taskId);
    }
  };

  const submitComment = (taskId) => {
    if (!newCommentText.trim()) return;
    handleAddComment(taskId, newCommentText);
    setNewCommentText('');
  };

  const handleFileUpload = async (e, taskId) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(`${API_BASE_URL}/tasks/${taskId}/upload`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData
      });

      if (response.ok) {
        alert('Archivo subido con éxito');
        if (fetchTasks) fetchTasks();
      } else {
        alert('Error al subir archivo');
      }
    } catch (error) {
      console.error('Upload error:', error);
    }
  };

  const triggerFileInput = (taskId) => {
    if (fileInputRefs.current[taskId]) {
      fileInputRefs.current[taskId].click();
    }
  };

  return (
    <div className="task-dropdown-menu-container">
      {canManage && (
        <button
          type="button"
          className="create-task-btn"
          onClick={() => openTaskModal(viewId)}
        >
          ＋ Crear Nueva Tarea
        </button>
      )}

      <div className="tasks-list">
        {viewTasks.size === 0 ? (
          <p className="empty-tasks-text">No hay tareas en esta vista</p>
        ) : (
          Array.from(viewTasks.values(), (task) => {
            const isImage = task.file_path && task.file_path.match(/\.(jpeg|jpg|gif|png)$/i);
            const isVideo = task.file_path && task.file_path.match(/\.(mp4|webm|ogg|mov)$/i);
            const isCompleted =
              task.task_status === 'Completada' || task.task_status === 'Completado';

            return (
              <div key={task.tasks_pk} className="task-item-container task-item">
                <div className="task-item-main">
                  <div className="task-item-left">
                    <div className="task-title-row">
                      {/* Candado estático: interactivo solo para Admin, solo lectura para User */}
                      {!task.assetsOnly &&
                        (isAdmin ? (
                          <button
                            type="button"
                            className="task-lock-btn"
                            onClick={() => handleToggleLock(task)}
                            title={
                              task.is_estatic
                                ? 'Desbloquear tarea estática'
                                : 'Marcar como tarea estática'
                            }
                          >
                            {task.is_estatic ? '🔒' : '🔓'}
                          </button>
                        ) : (
                          task.is_estatic && (
                            <span
                              className="task-static-readonly"
                              title="Tarea estática (solo administrador)"
                            >
                              🔒 Estática
                            </span>
                          )
                        ))}

                      <span className="task-name">{task.task_name}</span>
                    </div>

                    {/* Miniatura del archivo subido */}
                    {task.file_path && (
                      <div className="task-media-preview">
                        {isImage && (
                          <img src={`${API_BASE_URL}/${task.file_path}`} alt="preview" />
                        )}
                        {isVideo && (
                          <video src={`${API_BASE_URL}/${task.file_path}`} muted />
                        )}
                      </div>
                    )}
                  </div>

                  {!task.assetsOnly && (
                    <div className="task-actions">
                      <input
                        type="file"
                        accept="video/*, image/*"
                        style={{ display: 'none' }}
                        ref={(el) => (fileInputRefs.current[task.tasks_pk] = el)}
                        onChange={(e) => handleFileUpload(e, task.tasks_pk)}
                      />
                      <button
                        type="button"
                        className="task-btn-upload"
                        title="Subir Archivo"
                        onClick={() => triggerFileInput(task.tasks_pk)}
                      >
                        📎 Subir
                      </button>

                      {/* Estatus: botón editable solo para Admin; badge fijo para User */}
                      {isAdmin ? (
                        <button
                          type="button"
                          className={`task-status-btn ${isCompleted ? 'done' : 'pending'}`}
                          title="Cambiar Estatus"
                          onClick={() => handleToggleStatus(task)}
                        >
                          {isCompleted ? '✓ Completada' : '● Pendiente'}
                        </button>
                      ) : (
                        <span
                          className={`task-status-readonly ${isCompleted ? 'done' : 'pending'}`}
                          title="Solo un administrador puede cambiar el estado"
                        >
                          {task.task_status || 'Pendiente'}
                        </span>
                      )}

                      <button
                        type="button"
                        className="task-btn-chat"
                        title="Chat de la Tarea"
                        onClick={() => toggleChat(task.tasks_pk)}
                      >
                        💬 Chat
                      </button>

                      {canManage && (
                        <>
                          <button
                            type="button"
                            className="task-btn-edit"
                            title="Editar tarea"
                            onClick={() => openEditTaskModal(task)}
                          >
                            ✎
                          </button>
                          <button
                            type="button"
                            className="task-btn-delete"
                            title="Eliminar tarea"
                            onClick={() => handleDeleteTask(task.tasks_pk)}
                          >
                            🗑
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>

                {projectsByTask.get(task.tasks_pk)?.map((context) => (
                  <div key={context.project_pk} className="task-assets-wrap">
                    {projectsByTask.get(task.tasks_pk).length > 1 && (
                      <h5>{context.project_name}</h5>
                    )}
                    <AssetsTarea proyectoId={context.project_pk} tareaId={task.tasks_pk} />
                  </div>
                ))}

                {openChatTaskId === task.tasks_pk && (
                  <div className="task-chat-box">
                    <div className="task-chat-messages">
                      {!taskComments[task.tasks_pk] ||
                      taskComments[task.tasks_pk].length === 0 ? (
                        <span className="task-chat-empty">No hay comentarios aún.</span>
                      ) : (
                        taskComments[task.tasks_pk].map((comment) => {
                          const isMine = comment.created_by === currentUsername;
                          return (
                            <div
                              key={comment.comments_pk}
                              className={`task-chat-bubble ${isMine ? 'mine' : 'other'}`}
                            >
                              <span className="task-chat-author">{comment.created_by}</span>
                              <span className="task-chat-text">
                                {comment.comments_description}
                              </span>
                            </div>
                          );
                        })
                      )}
                    </div>

                    <div className="task-chat-input-row">
                      <input
                        type="text"
                        placeholder="Escribe un comentario..."
                        value={newCommentText}
                        onChange={(e) => setNewCommentText(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && submitComment(task.tasks_pk)}
                      />
                      <button type="button" onClick={() => submitComment(task.tasks_pk)}>
                        Enviar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default TasksSection;