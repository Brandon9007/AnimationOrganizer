import React, { useState, useRef } from 'react';

// Recuerda ajustar el puerto si tu backend corre en 8000 o 8080
const API_BASE_URL = 'http://localhost:8080';

function TasksSection({
  viewId,
  tasks,
  openTaskModal,
  openEditTaskModal,
  handleToggleLock,
  handleDeleteTask,
  handleToggleStatus,
  taskComments,
  fetchTaskComments,
  handleAddComment,
  currentUserRole,
  fetchTasks
}) {
  const viewTasks = tasks.filter(t => t.views_pk === viewId && t.is_active !== false);
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
    handleAddComment(taskId, newCommentText, currentUserRole);
    setNewCommentText('');
  };

  const handleFileUpload = async (e, taskId) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch(`${API_BASE_URL}/tasks/${taskId}/upload`, {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        alert("Archivo subido con éxito");
        if (fetchTasks) fetchTasks();
      } else {
        alert("Error al subir archivo");
      }
    } catch (error) {
      console.error("Upload error:", error);
    }
  };

  const triggerFileInput = (taskId) => {
    if (fileInputRefs.current[taskId]) {
      fileInputRefs.current[taskId].click();
    }
  };

  return (
    <div className="task-dropdown-menu-container">
      <button className="create-task-btn" onClick={() => openTaskModal(viewId)}>
        ➕ Crear Nueva Tarea
      </button>

      <div className="tasks-list" style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '15px' }}>
        {viewTasks.length === 0 ? (
          <p className="empty-tasks-text" style={{ width: '100%' }}>No hay tareas en esta vista</p>
        ) : (
          viewTasks.map(task => {
            const isImage = task.file_path && task.file_path.match(/\.(jpeg|jpg|gif|png)$/i);
            const isVideo = task.file_path && task.file_path.match(/\.(mp4|webm|ogg|mov)$/i);

            return (
              <div key={task.tasks_pk} className="task-item-container" style={{ display: 'flex', flexDirection: 'column', background: '#1e2128', border: '1px solid #333', borderRadius: '6px' }}>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', overflow: 'hidden', gap: '8px' }}>
                      <span onClick={() => handleToggleLock(task)} style={{ cursor: 'pointer', fontSize: '16px' }} title={task.is_estatic ? "Desbloquear Tarea" : "Bloquear Tarea"}>
                        {task.is_estatic ? '🔒' : '🔓'}
                      </span>
                      <span className="task-name" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 'bold', color: 'white' }}>
                        {task.task_name}
                      </span>
                    </div>

                    {/* MINIATURA DEL ARCHIVO SUBIDO */}
                    {task.file_path && (
                      <div style={{ marginTop: '5px', padding: '2px', border: '1px dashed #555', display: 'inline-block', borderRadius: '4px', background: '#111' }}>
                        {isImage && (
                          <img src={`${API_BASE_URL}/${task.file_path}`} alt="preview" style={{ height: '40px', width: 'auto', borderRadius: '2px' }} />
                        )}
                        {isVideo && (
                          <video src={`${API_BASE_URL}/${task.file_path}`} style={{ height: '40px', width: 'auto', borderRadius: '2px' }} muted />
                        )}
                      </div>
                    )}
                  </div>

                  <div className="task-actions" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      type="file"
                      accept="video/*, image/*"
                      style={{ display: 'none' }}
                      ref={el => fileInputRefs.current[task.tasks_pk] = el}
                      onChange={(e) => handleFileUpload(e, task.tasks_pk)}
                    />
                    <button title="Subir Archivo" onClick={() => triggerFileInput(task.tasks_pk)} style={{ background: '#8e44ad', border: 'none', borderRadius: '4px', cursor: 'pointer', color: 'white', padding: '4px 8px', fontSize: '11px' }}>
                      📎 Subir
                    </button>

                    <button title="Cambiar Estatus" onClick={() => handleToggleStatus(task)} style={{ background: task.task_status === 'Completada' ? '#27ae60' : '#f39c12', border: 'none', borderRadius: '4px', cursor: 'pointer', color: 'white', fontWeight: 'bold', padding: '4px 8px', fontSize: '11px' }}>
                      {task.task_status === 'Completada' ? ' Completada' : 'Pendiente'}
                    </button>

                    <button title="Chat de la Tarea" onClick={() => toggleChat(task.tasks_pk)} style={{ background: '#34495e', border: 'none', borderRadius: '4px', cursor: 'pointer', color: 'white', padding: '4px 8px', fontSize: '11px' }}>
                      💬 CHAT
                    </button>
                    <button title="Actualizar" onClick={() => openEditTaskModal(task)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#4a90e2', fontWeight: 'bold', fontSize: '12px' }}>PUT</button>
                    <button title="Borrar" onClick={() => handleDeleteTask(task.tasks_pk)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#e74c3c', fontWeight: 'bold', fontSize: '12px' }}>DELETE</button>
                  </div>
                </div>

                {openChatTaskId === task.tasks_pk && (
                  <div style={{ background: '#16181d', padding: '10px', borderTop: '1px solid #333', borderBottomLeftRadius: '6px', borderBottomRightRadius: '6px' }}>
                    <div style={{ maxHeight: '150px', overflowY: 'auto', marginBottom: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {(!taskComments[task.tasks_pk] || taskComments[task.tasks_pk].length === 0) ? (
                        <span style={{ color: '#777', fontSize: '12px', fontStyle: 'italic' }}>No hay comentarios aún.</span>
                      ) : (
                        taskComments[task.tasks_pk].map(comment => (
                          <div key={comment.comments_pk} style={{ display: 'flex', flexDirection: 'column', background: comment.created_by === 'admin' ? '#2c3e50' : '#34495e', padding: '6px 10px', borderRadius: '4px', width: 'fit-content', maxWidth: '85%', alignSelf: comment.created_by === currentUserRole ? 'flex-end' : 'flex-start' }}>
                            <span style={{ fontSize: '10px', color: '#bdc3c7', marginBottom: '2px' }}>{comment.created_by}</span>
                            <span style={{ fontSize: '13px', color: 'white' }}>{comment.comments_description}</span>
                          </div>
                        ))
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '5px' }}>
                      <input type="text" placeholder="Escribe un comentario..." value={newCommentText} onChange={(e) => setNewCommentText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submitComment(task.tasks_pk)} style={{ flex: 1, padding: '6px', borderRadius: '4px', border: '1px solid #555', background: '#222', color: 'white', fontSize: '12px' }} />
                      <button onClick={() => submitComment(task.tasks_pk)} style={{ background: '#4a90e2', border: 'none', borderRadius: '4px', cursor: 'pointer', color: 'white', padding: '6px 12px', fontWeight: 'bold', fontSize: '12px' }}>Enviar</button>
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
