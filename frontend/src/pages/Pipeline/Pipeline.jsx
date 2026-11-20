import React, { useRef, useState, useEffect, useMemo } from 'react';
import ViewsSection from './ViewsSection';
import './Pipeline.css';

import Box from '@mui/material/Box';
import Slider from '@mui/material/Slider';




// Utilities
const parseDuration = (durStr) => {
  if (!durStr) return 60;
  const parts = durStr.split(':');
  if (parts.length === 3) return parseInt(parts[0], 10) * 3600 + parseInt(parts[1], 10) * 60 + parseInt(parts[2], 10);
  return 60;
};

const formatDuration = (totalSeconds) => {
  const h = Math.floor(totalSeconds / 3600).toString().padStart(2, '0');
  const m = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0');
  const s = Math.floor(totalSeconds % 60).toString().padStart(2, '0');
  return `${h}:${m}:${s}`;
};

//Backend
const API_BASE_URL = 'http://localhost:8000';

function LayerVideo({ src, localTimeMs, isPlaying }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!ref.current) return;
    const targetTime = localTimeMs / 1000;
    if (Math.abs(ref.current.currentTime - targetTime) > 0.4) {
      ref.current.currentTime = targetTime;
    }
    if (isPlaying && ref.current.paused) {
      ref.current.play().catch(() => { });
    } else if (!isPlaying && !ref.current.paused) {
      ref.current.pause();
    }
  }, [localTimeMs, isPlaying, src]);

  return (
    <video
      ref={ref}
      src={src}
      className="video-element"
      muted={false}
    />
  );
}

function Pipeline({ userRole = 'admin', projectName = 'Proyecto X' }) {
  const currentUsername = localStorage.getItem('user_name') || userRole;
  const videoRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [globalProgressMs, setGlobalProgressMs] = useState(0);
  const [timelineScale, setTimelineScale] = useState(1);

  const [views, setViews] = useState([]);
  const [tasks, setTasks] = useState([]);

  const [viewCounter, setViewCounter] = useState(1);
  const [newViewNameInput, setNewViewNameInput] = useState('');
  const [openDropdownViewId, setOpenDropdownViewId] = useState(null);
  const [activeTimelineViewId, setActiveTimelineViewId] = useState(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [targetViewId, setTargetViewId] = useState(null);
  const [taskForm, setTaskForm] = useState({ task_name: '', task_description: '', task_due_date: '', is_estatic: false });
  const [editTaskForm, setEditTaskForm] = useState(null);

  // DnD
  const dragRef = useRef({ isDragging: false, taskId: null, startX: 0, startDur: 0, taskRef: null });
  const [draggedTaskId, setDraggedTaskId] = useState(null);
  const [draggedViewId, setDraggedViewId] = useState(null);

  const [taskComments, setTaskComments] = useState({});

  const fetchTasks = async () => {
    try {
      const tasksRes = await fetch(`${API_BASE_URL}/tasks`);
      if (tasksRes.ok) {
        const tasksResult = await tasksRes.json();
        setTasks(tasksResult.data || tasksResult);
      }
    } catch (error) { console.error("Error de red:", error); }
  };

  useEffect(() => {
    const fetchViews = async () => {
      try {
        const viewsRes = await fetch(`${API_BASE_URL}/views`);
        if (viewsRes.ok) {
          const viewsResult = await viewsRes.json();
          const sortedViews = (viewsResult.data || viewsResult).sort((a, b) => a.views_order - b.views_order);
          setViews(sortedViews);
          setViewCounter(sortedViews.length + 1);
        }
      } catch (error) { console.error("Error de red views:", error); }
    };
    fetchViews();
    fetchTasks();
  }, []);

  useEffect(() => {
    setGlobalProgressMs(0);
    setIsPlaying(false);
  }, [activeTimelineViewId]);

  const activeTasks = useMemo(() => {
    return activeTimelineViewId
      ? tasks.filter(t => t.views_pk === activeTimelineViewId && t.is_active !== false).sort((a, b) => a.tasks_order - b.tasks_order)
      : [];
  }, [tasks, activeTimelineViewId]);

  const getTaskAtTime = (viewId, timeMs) => {
    const vTasks = tasks
      .filter(t => t.views_pk === viewId && t.is_active !== false)
      .sort((a, b) => a.tasks_order - b.tasks_order);

    let accMs = 0;
    for (let i = 0; i < vTasks.length; i++) {
      const durMs = parseDuration(vTasks[i].tasks_duration) * 1000;
      if (timeMs >= accMs && timeMs < accMs + durMs) {
        return { task: vTasks[i], localMs: timeMs - accMs };
      }
      accMs += durMs;
    }
    return null;
  };

  //Metricas de la timeline
  const { totalDurationMs, currentTaskIndex, currentTask, localTaskProgressMs } = useMemo(() => {
    let totalMs = 0;
    let activeIdx = 0;
    let localProgMs = 0;

    for (let i = 0; i < activeTasks.length; i++) {
      const taskDurationMs = parseDuration(activeTasks[i].tasks_duration) * 1000;
      if (globalProgressMs >= totalMs && globalProgressMs < totalMs + taskDurationMs) {
        activeIdx = i;
        localProgMs = globalProgressMs - totalMs;
      }
      totalMs += taskDurationMs;
    }

    if (globalProgressMs >= totalMs && activeTasks.length > 0) {
      activeIdx = activeTasks.length - 1;
      localProgMs = parseDuration(activeTasks[activeTasks.length - 1].tasks_duration) * 1000;
    }

    return {
      totalDurationMs: totalMs,
      currentTaskIndex: activeIdx,
      currentTask: activeTasks[activeIdx],
      localTaskProgressMs: localProgMs
    };
  }, [activeTasks, globalProgressMs]);

  const hasMedia = !!currentTask?.file_path;
  //const isImageMedia = hasMedia && currentTask.file_path.match(/\.(jpeg|jpg|gif|png)$/i);
  const isVideoMedia = hasMedia && currentTask.file_path.match(/\.(mp4|webm|ogg|mov)$/i);

  useEffect(() => {
    let interval;
    if (isPlaying && totalDurationMs > 0) {
      const updateInterval = 50;

      interval = setInterval(() => {
        setGlobalProgressMs(prev => {
          const nextVal = prev + updateInterval;
          if (nextVal >= totalDurationMs) {
            setIsPlaying(false);
            return totalDurationMs;
          }
          return nextVal;
        });
      }, updateInterval);
    }
    return () => clearInterval(interval);
  }, [isPlaying, totalDurationMs]);

  useEffect(() => {
    if (currentTask && isVideoMedia && videoRef.current) {
      const targetTime = localTaskProgressMs / 1000;

      if (Math.abs(videoRef.current.currentTime - targetTime) > 0.5) {
        videoRef.current.currentTime = targetTime;
      }

      if (isPlaying && videoRef.current.paused) {
        videoRef.current.play().catch(e => console.log("Autoplay prevent:", e));
      } else if (!isPlaying && !videoRef.current.paused) {
        videoRef.current.pause();
      }
    }
  }, [currentTaskIndex, isPlaying, isVideoMedia, currentTask, localTaskProgressMs]);

  const togglePlay = () => {
    if (activeTasks.length === 0) return;
    if (!isPlaying && globalProgressMs >= totalDurationMs) {
      setGlobalProgressMs(0);
    }
    setIsPlaying(!isPlaying);
  };

  const handleProgressChange = (e) => {
    const newPercentage = parseFloat(e.target.value);
    setGlobalProgressMs((newPercentage / 100) * totalDurationMs);
  };

  const handleFastForward = () => {
    setGlobalProgressMs(prev => Math.min(totalDurationMs, prev + 5000));
  };

  const handleRewind = () => {
    setGlobalProgressMs(prev => Math.max(0, prev - 5000));
  };

  // --- Task Resizing Logic ---
  const handleDragStart = (e, task) => {
    e.preventDefault(); e.stopPropagation();
    const timelineInnerContainer = document.querySelector('.timeline-inner-track');
    const timelineWidth = timelineInnerContainer ? timelineInnerContainer.clientWidth : 800;

    dragRef.current = {
      isDragging: true, taskId: task.tasks_pk, startX: e.clientX,
      startDur: parseDuration(task.tasks_duration), timelineWidth, taskRef: task
    };

    const handleMouseMove = (moveEvent) => {
      if (!dragRef.current.isDragging) return;
      const deltaX = moveEvent.clientX - dragRef.current.startX;
      const visibleDur = Math.max(totalDurationMs / 1000, 300);
      const deltaSecs = (deltaX / dragRef.current.timelineWidth) * visibleDur;

      //Duracion mnima de las tasks le puse 1 segundo 
      let newDur = Math.max(1, dragRef.current.startDur + deltaSecs);
      setTasks(prev => prev.map(t => t.tasks_pk === dragRef.current.taskId ? { ...t, tasks_duration: formatDuration(newDur) } : t));
    };

    const handleMouseUp = async (upEvent) => {
      if (!dragRef.current.isDragging) return;
      dragRef.current.isDragging = false;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);

      const deltaX = upEvent.clientX - dragRef.current.startX;
      const visibleDur = Math.max(totalDurationMs / 1000, 300);
      const deltaSecs = (deltaX / dragRef.current.timelineWidth) * visibleDur;

      let finalDur = Math.max(1, dragRef.current.startDur + deltaSecs);
      const todayDate = new Date().toISOString().split('T')[0];

      const updatedTask = {
        ...dragRef.current.taskRef,
        tasks_duration: formatDuration(finalDur),
        task_created_at: dragRef.current.taskRef.task_created_at || todayDate,
        task_status: dragRef.current.taskRef.task_status || "Pendiente",
        task_due_date: dragRef.current.taskRef.task_due_date || todayDate,
        task_updated_at: todayDate
      };

      try {
        await fetch(`${API_BASE_URL}/tasks/${dragRef.current.taskId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updatedTask) });
      } catch (error) { console.error('Error guardando duración:', error); }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // --- Reordenamiento de Tareas ---
  const onDragStartTask = (e, taskId) => { setDraggedTaskId(taskId); e.dataTransfer.effectAllowed = "move"; };
  const onDragOverTask = (e) => { e.preventDefault(); };
  const onDropTask = async (e, targetTaskId) => {
    e.preventDefault();
    if (!draggedTaskId || draggedTaskId === targetTaskId) return;

    const currentTasks = [...tasks];
    const draggedIndex = currentTasks.findIndex(t => t.tasks_pk === draggedTaskId);
    const targetIndex = currentTasks.findIndex(t => t.tasks_pk === targetTaskId);

    if (currentTasks[draggedIndex].is_estatic || currentTasks[targetIndex].is_estatic) return;

    const tempOrder = currentTasks[draggedIndex].tasks_order;
    currentTasks[draggedIndex].tasks_order = currentTasks[targetIndex].tasks_order;
    currentTasks[targetIndex].tasks_order = tempOrder;

    setTasks(currentTasks);
    setDraggedTaskId(null);

    const todayDate = new Date().toISOString().split('T')[0];
    const taskA = { ...currentTasks[draggedIndex], task_updated_at: todayDate };
    const taskB = { ...currentTasks[targetIndex], task_updated_at: todayDate };

    try {
      await fetch(`${API_BASE_URL}/tasks/${taskA.tasks_pk}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(taskA) });
      await fetch(`${API_BASE_URL}/tasks/${taskB.tasks_pk}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(taskB) });
    } catch (error) { console.error("Error updating order:", error); }
  };

  // --- Reordenamiento de Vistas ---
  const onDragStartView = (e, viewId) => { setDraggedViewId(viewId); e.dataTransfer.effectAllowed = "move"; };
  const onDragOverView = (e) => { e.preventDefault(); };
  const onDropView = async (e, targetViewId) => {
    e.preventDefault();
    if (!draggedViewId || draggedViewId === targetViewId) return;

    const currentViews = [...views];
    const draggedIndex = currentViews.findIndex(v => v.views_pk === draggedViewId);
    const targetIndex = currentViews.findIndex(v => v.views_pk === targetViewId);

    const tempOrder = currentViews[draggedIndex].views_order;
    currentViews[draggedIndex].views_order = currentViews[targetIndex].views_order;
    currentViews[targetIndex].views_order = tempOrder;

    const sortedViews = [...currentViews].sort((a, b) => a.views_order - b.views_order);
    setViews(sortedViews);
    setDraggedViewId(null);

    const viewA = { ...currentViews[draggedIndex] };
    const viewB = { ...currentViews[targetIndex] };

    try {
      await fetch(`${API_BASE_URL}/views/${viewA.views_pk}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(viewA) });
      await fetch(`${API_BASE_URL}/views/${viewB.views_pk}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(viewB) });
    } catch (error) { console.error("Error updating view order:", error); }
  };

  // --- Views CRUD ---
  const handleCreateView = async () => {
    const finalViewName = newViewNameInput.trim() !== '' ? newViewNameInput : `view_${viewCounter}`;
    const newViewData = { views_name: finalViewName, views_order: views.length + 1, is_active: true };
    try {
      const response = await fetch(`${API_BASE_URL}/views`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newViewData) });
      if (response.ok) {
        const result = await response.json();
        setViews([...views, result.data || result]);
        setViewCounter(viewCounter + 1); setNewViewNameInput('');
      }
    } catch (error) { console.error('Error:', error); }
  };

  const handleUpdateView = async (viewId, currentOrder) => {
    const updatedName = prompt("Escribe el nuevo nombre para esta vista:");
    if (!updatedName) return;
    const updatedViewData = { views_pk: viewId, views_name: updatedName, views_order: currentOrder, is_active: true };
    try {
      const response = await fetch(`${API_BASE_URL}/views/${viewId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updatedViewData) });
      if (response.ok) setViews(views.map(v => v.views_pk === viewId ? { ...v, views_name: updatedName } : v));
    } catch (error) { console.error('Error:', error); }
  };

  const handleDeleteView = async (viewId) => {
    const tieneTareas = tasks.some(t => t.views_pk === viewId && t.is_active !== false);
    if (tieneTareas) { alert("⚠️ No puedes borrar esta vista porque tiene tareas enlazadas. Borra las tareas primero."); return; }
    if (!window.confirm("¿Seguro que deseas eliminar esta vista?")) return;
    try {
      const response = await fetch(`${API_BASE_URL}/views/${viewId}`, { method: 'DELETE' });
      if (response.ok) setViews(views.filter(v => v.views_pk !== viewId));
    } catch (error) { console.error('Error:', error); }
  };

  const toggleTaskDropdown = (viewId) => setOpenDropdownViewId(openDropdownViewId === viewId ? null : viewId);

  // --- Funciones para Modales de Tareas ---
  const openTaskModal = (viewId) => { setTargetViewId(viewId); setTaskForm({ task_name: '', task_description: '', task_due_date: '', is_estatic: false }); setIsModalOpen(true); };
  const closeTaskModal = () => { setIsModalOpen(false); setTargetViewId(null); };
  const openEditTaskModal = (task) => { setEditTaskForm({ ...task, task_due_date: task.task_due_date || '' }); };
  const closeEditTaskModal = () => { setEditTaskForm(null); };

  // --- Tasks CRUD ---
  const handleCreateTask = async () => {
    if (!taskForm.task_name.trim()) return alert("El nombre es obligatorio.");
    const todayDate = new Date().toISOString().split('T')[0];

    const newTaskData = {
      task_name: taskForm.task_name,
      task_description: taskForm.task_description || "Sin descripción",
      task_status: "Pendiente",
      task_created_at: todayDate,
      task_updated_at: todayDate,
      task_due_date: taskForm.task_due_date || todayDate,
      tasks_order: tasks.filter(t => t.views_pk === targetViewId).length + 1,
      tasks_duration: taskForm.is_estatic ? "00:00:01" : "00:01:00",
      is_estatic: taskForm.is_estatic,
      is_active: true
    };

    try {
      const responseTask = await fetch(`${API_BASE_URL}/tasks`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newTaskData) });
      if (responseTask.ok) {
        const resultTask = await responseTask.json();
        const createdTask = resultTask.data || newTaskData;
        const newRelationData = { groups_tasks_views_name: `${createdTask.task_name}_view_${targetViewId}`, is_active: true, task_pk: createdTask.tasks_pk, views_pk: targetViewId };
        const responseRelation = await fetch(`${API_BASE_URL}/groups_tasks_views`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newRelationData) });

        if (responseRelation.ok) { setTasks([...tasks, { ...createdTask, views_pk: targetViewId }]); closeTaskModal(); }
        else { alert("La tarea se creó, pero falló al enlazarla."); }
      }
    } catch (error) { console.error('Error:', error); }
  };

  const handleSaveUpdatedTask = async () => {
    if (!editTaskForm.task_name.trim()) return alert("El nombre es obligatorio.");
    const todayDate = new Date().toISOString().split('T')[0];
    const updatedTaskData = { ...editTaskForm, task_updated_at: todayDate };

    try {
      const response = await fetch(`${API_BASE_URL}/tasks/${editTaskForm.tasks_pk}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updatedTaskData)
      });
      if (response.ok) {
        setTasks(tasks.map(t => t.tasks_pk === editTaskForm.tasks_pk ? updatedTaskData : t));
        closeEditTaskModal();
      }
    } catch (error) { console.error('Error:', error); }
  };

  const handleToggleLock = async (task) => {
    const updatedTaskData = { ...task, is_estatic: !task.is_estatic };
    try {
      const response = await fetch(`${API_BASE_URL}/tasks/${task.tasks_pk}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updatedTaskData)
      });
      if (response.ok) setTasks(tasks.map(t => t.tasks_pk === task.tasks_pk ? updatedTaskData : t));
    } catch (error) { console.error('Error toggling lock:', error); }
  };

  const handleDeleteTask = async (taskId) => {
    if (!window.confirm("¿Seguro que deseas eliminar esta tarea?")) return;
    try {
      const response = await fetch(`${API_BASE_URL}/tasks/${taskId}`, { method: 'DELETE' });
      if (response.ok) setTasks(tasks.filter(t => t.tasks_pk !== taskId));
    } catch (error) { console.error('Error:', error); }
  };

  // --- STATUS & CHAT ---
  const handleToggleStatus = async (task) => {
    const newStatus = task.task_status === 'Completada' ? 'Pendiente' : 'Completada';
    const todayDate = new Date().toISOString().split('T')[0];
    const updatedTaskData = { ...task, task_status: newStatus, task_updated_at: todayDate };

    try {
      const response = await fetch(`${API_BASE_URL}/tasks/${task.tasks_pk}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updatedTaskData)
      });
      if (response.ok) {
        setTasks(tasks.map(t => t.tasks_pk === task.tasks_pk ? updatedTaskData : t));
      }
    } catch (error) { console.error('Error toggling status:', error); }
  };

  const fetchTaskComments = async (taskId) => {
    try {
      const res = await fetch(`${API_BASE_URL}/tasks/${taskId}/comments`);
      if (res.ok) {
        const result = await res.json();
        setTaskComments(prev => ({ ...prev, [taskId]: result.data || result }));
      }
    } catch (error) { console.error('Error fetching comments:', error); }
  };



const handleAddComment = async (taskId, text) => {
    const todayDate = new Date().toISOString().split('T')[0];

    const commentData = {
      comments_description: text,
      comments_created_at: todayDate,
      comments_updated_at: todayDate,
      created_by: currentUsername,
      tasks_fk: taskId,
      is_active: true
    };

    try {
      const response = await fetch(`${API_BASE_URL}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(commentData)
      });

      if (response.ok) {
        fetchTaskComments(taskId);
      } else {
        const errorDetail = await response.json();
        console.error("Error al guardar comentario:", errorDetail);
      }
    } catch (error) {
      console.error('Error posting comment:', error);
    }
  };

  const [viewVisibility, setViewVisibility] = useState({});
  const [viewOpacities, setViewOpacities] = useState({});

  const toggleViewVisibility = (viewId) => {
    setViewVisibility(prev => ({
      ...prev,
      [viewId]: prev[viewId] === undefined ? false : !prev[viewId]
    }));
  };

  const handleViewOpacityChange = (viewId, newOpacity) => {
    setViewOpacities(prev => ({
      ...prev,
      [viewId]: newOpacity
    }));
  };


  return (
    <div className="pipeline-container">

      {/* Modal: Crear Tarea */}
      {isModalOpen && (
        <div className="task-modal-overlay">
          <div className="task-modal-content">
            <h3 className="task-modal-title">Crear Nueva Tarea</h3>
            <label className="task-modal-label">Nombre de la tarea:</label>
            <input
              type="text"
              className="task-modal-input"
              value={taskForm.task_name}
              onChange={(e) => setTaskForm({ ...taskForm, task_name: e.target.value })}
            />
            <label className="task-modal-label">Descripción:</label>
            <textarea
              className="task-modal-textarea"
              value={taskForm.task_description}
              onChange={(e) => setTaskForm({ ...taskForm, task_description: e.target.value })}
            />
            <label className="task-modal-label">Fecha de Entrega (Due Date):</label>
            <input
              type="date"
              className="task-modal-input task-modal-input-last"
              value={taskForm.task_due_date}
              onChange={(e) => setTaskForm({ ...taskForm, task_due_date: e.target.value })}
            />
            <div className="task-modal-actions">
              <button onClick={closeTaskModal} className="modal-btn-cancel">Cancelar</button>
              <button onClick={handleCreateTask} className="modal-btn-save">Guardar Tarea</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Actualizar Tarea */}
      {editTaskForm && (
        <div className="task-modal-overlay">
          <div className="task-modal-content">
            <h3 className="task-modal-title">Actualizar Tarea</h3>
            <label className="task-modal-label">Nombre:</label>
            <input
              type="text"
              className="task-modal-input"
              value={editTaskForm.task_name}
              onChange={(e) => setEditTaskForm({ ...editTaskForm, task_name: e.target.value })}
            />
            <label className="task-modal-label">Descripción:</label>
            <textarea
              className="task-modal-textarea"
              value={editTaskForm.task_description}
              onChange={(e) => setEditTaskForm({ ...editTaskForm, task_description: e.target.value })}
            />
            <label className="task-modal-label">Estatus:</label>
            <select
              className="task-modal-select"
              value={editTaskForm.task_status}
              onChange={(e) => setEditTaskForm({ ...editTaskForm, task_status: e.target.value })}
            >
              <option value="Pendiente">Pendiente</option>
              <option value="En Progreso">En Progreso</option>
              <option value="Completado">Completado</option>
              <option value="Cancelado">Cancelado</option>
            </select>
            <label className="task-modal-label">Due Date (Fecha Límite):</label>
            <input
              type="date"
              className="task-modal-input task-modal-input-last"
              value={editTaskForm.task_due_date || ''}
              onChange={(e) => setEditTaskForm({ ...editTaskForm, task_due_date: e.target.value })}
            />
            <div className="task-modal-actions">
              <button onClick={closeEditTaskModal} className="modal-btn-cancel">Cancelar</button>
              <button onClick={handleSaveUpdatedTask} className="modal-btn-update">Guardar Cambios</button>
            </div>
          </div>
        </div>
      )}

      <div className="project-header"><h2>{projectName}</h2></div>

      <div className="video-container">

        {/* REPRODUCTOR MULTIMEDIA SECUENCIAL */}
        <div className="video-screen">
          {activeTimelineViewId ? (
            views.map((view, idx) => {
              const isVisible = viewVisibility[view.views_pk] !== false;
              if (!isVisible) return null;

              const layerData = getTaskAtTime(view.views_pk, globalProgressMs);
              if (!layerData || !layerData.task?.file_path) return null;

              const { task, localMs } = layerData;
              const isImg = task.file_path.match(/\.(jpeg|jpg|gif|png)$/i);
              const opacityVal = (viewOpacities[view.views_pk] ?? 100) / 100;

              return (
                <div
                  key={view.views_pk}
                  className="video-layer-wrapper"
                  style={{ opacity: opacityVal, zIndex: views.length - idx }}
                >
                  {isImg ? (
                    <img
                      src={`${API_BASE_URL}/${task.file_path}`}
                      className="video-layer-img"
                      alt={task.task_name}
                    />
                  ) : (
                    <LayerVideo
                      src={`${API_BASE_URL}/${task.file_path}`}
                      localTimeMs={localMs}
                      isPlaying={isPlaying}
                    />
                  )}
                </div>
              );
            })
          ) : (
            <div className="no-content-message">
              Selecciona una vista con tareas para previsualizar
            </div>
          )}
        </div>

        <div className="video-controls-centered">
          <button onClick={handleRewind} className="control-btn" title="Rebobinar">◀◀</button>
          <button onClick={togglePlay} className="control-btn play-main-btn">{isPlaying ? '⏸' : '▶'}</button>
          <button onClick={handleFastForward} className="control-btn" title="Adelantar">▶▶</button>

          {activeTimelineViewId && (
            <span className="timeline-time-display">
              <strong>{formatDuration(globalProgressMs / 1000)} / {formatDuration(totalDurationMs / 1000)}</strong>
            </span>
          )}

          {activeTimelineViewId && (
            <Box className="timeline-zoom-box">
              <Slider
                size="small"
                className="timeline-zoom-slider"
                value={timelineScale}
                min={0.05}
                max={2}
                step={0.01}
                onChange={(e, newValue) => setTimelineScale(newValue)}
                aria-label="Timeline Zoom"
                valueLabelDisplay="auto"
                valueLabelFormat={(value) => `${Math.round(value * 100)}%`}
              />
            </Box>
          )}
        </div>

        {/* TIMELINE VISUAL */}
        <div className="timeline-task-tracks">
          <div
            className="timeline-inner-track"
            style={{ minWidth: `${Math.max((totalDurationMs / 1000) * 5, 800) * timelineScale}px` }}
          >
            {activeTimelineViewId ? (
              activeTasks.map((task, index) => {
                const durationInSecs = parseDuration(task.tasks_duration);
                const isCurrentlyPlaying = index === currentTaskIndex;

                const isVideoFile = task.file_path && task.file_path.match(/\.(mp4|webm|ogg|mov)$/i);
                const isImgFile = task.file_path && task.file_path.match(/\.(jpeg|jpg|gif|png)$/i);
                const canResize = !task.is_estatic && !isVideoFile;

                const rawFileName = task.file_path ? task.file_path.split('/').pop() : 'Vacío';
                const widthPercent = totalDurationMs > 0 ? ((durationInSecs * 1000) / totalDurationMs) * 100 : 0;

                const taskBlockClasses = [
                  'timeline-task-block',
                  isVideoFile ? 'is-video' : '',
                  task.is_estatic ? 'is-static' : '',
                  isCurrentlyPlaying ? 'is-playing' : ''
                ].filter(Boolean).join(' ');

                return (
                  <div
                    key={task.tasks_pk}
                    className={taskBlockClasses}
                    title={`${task.task_name} (${task.tasks_duration})`}
                    draggable={!task.is_estatic}
                    onDragStart={(e) => {
                      if (task.is_estatic) e.preventDefault();
                      else onDragStartTask(e, task.tasks_pk);
                    }}
                    onDragOver={onDragOverTask}
                    onDrop={(e) => onDropTask(e, task.tasks_pk)}
                    style={{ width: `${widthPercent}%` }}
                  >
                    {isImgFile && (
                      <img
                        src={`${API_BASE_URL}/${task.file_path}`}
                        className="timeline-task-thumb"
                        alt="thumb"
                      />
                    )}

                    <span className="timeline-task-label">
                      {task.is_estatic && <span>🔒</span>}
                      {isVideoFile && <span>🎬</span>}
                      <span className="timeline-task-filename">{rawFileName}</span>
                    </span>

                    {canResize && (
                      <div
                        className="timeline-resize-handle"
                        onMouseDown={(e) => handleDragStart(e, task)}
                      />
                    )}
                  </div>
                );
              })
            ) : (
              <div className="timeline-empty-message">Selecciona una vista para ver su pipeline</div>
            )}
          </div>
        </div>

        <div className="video-controls-bar">
          <div className="progress-bar-container">
            <input
              type="range" min="0" max="100"
              value={totalDurationMs > 0 ? (globalProgressMs / totalDurationMs) * 100 : 0}
              onChange={handleProgressChange}
              className="progress-bar"
            />
          </div>
        </div>
      </div>

      <ViewsSection
        views={views}
        viewCounter={viewCounter}
        newViewNameInput={newViewNameInput}
        setNewViewNameInput={setNewViewNameInput}
        handleCreateView={handleCreateView}
        handleUpdateView={handleUpdateView}
        handleDeleteView={handleDeleteView}
        onDragStartView={onDragStartView}
        onDragOverView={onDragOverView}
        onDropView={onDropView}
        activeTimelineViewId={activeTimelineViewId}
        setActiveTimelineViewId={setActiveTimelineViewId}
        openDropdownViewId={openDropdownViewId}
        toggleTaskDropdown={toggleTaskDropdown}
        tasks={tasks}
        openTaskModal={openTaskModal}
        openEditTaskModal={openEditTaskModal}
        handleToggleLock={handleToggleLock}
        handleDeleteTask={handleDeleteTask}
        handleToggleStatus={handleToggleStatus}
        taskComments={taskComments}
        fetchTaskComments={fetchTaskComments}
        handleAddComment={handleAddComment}
        currentUserRole={userRole}
        currentUsername={currentUsername}
        fetchTasks={fetchTasks}
        viewVisibility={viewVisibility}
        toggleViewVisibility={toggleViewVisibility}
        viewOpacities={viewOpacities}
        handleViewOpacityChange={handleViewOpacityChange}
      />
    </div>
  );

}
export default Pipeline;