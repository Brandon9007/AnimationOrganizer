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



// URL de tu Backend
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
      style={{ width: '100%', height: '100%', objectFit: 'contain' }}
      muted={false}
    />
  );
}



function Pipeline({ userRole = 'admin', projectName = 'Proyecto X' }) {
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

  // Reiniciar el reproductor cuando se cambia de vista
  useEffect(() => {
    setGlobalProgressMs(0);
    setIsPlaying(false);
  }, [activeTimelineViewId]);

  // Lista de tareas ordenadas activas para la línea de tiempo
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
    return null; // Si esta view es más corta que la seleccionada, no muestra nada al terminar
  };


  // Calcular métricas de la línea de tiempo
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

    // Manejar el final de la secuencia
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

  // Variables booleanas para identificar el tipo de clip actual
  const hasMedia = !!currentTask?.file_path;
  //const isImageMedia = hasMedia && currentTask.file_path.match(/\.(jpeg|jpg|gif|png)$/i);
  const isVideoMedia = hasMedia && currentTask.file_path.match(/\.(mp4|webm|ogg|mov)$/i);

  // --- MOTOR DEL REPRODUCTOR VIRTUAL GLOBAL ---
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

  // Sincronizar video nativo con el tiempo local
  useEffect(() => {
    if (currentTask && isVideoMedia && videoRef.current) {
      const targetTime = localTaskProgressMs / 1000;

      // Si el video está muy desfasado (por un seek o cambio de clip), actualizarlo
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
      setGlobalProgressMs(0); // Reiniciar si terminó
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
      // Calcula duración total visible para proporción de resize
      const visibleDur = Math.max(totalDurationMs / 1000, 300);
      const deltaSecs = (deltaX / dragRef.current.timelineWidth) * visibleDur;

      // MINIMUM DURATION = 2 SECONDS
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
      tasks_duration: taskForm.is_estatic ? "00:00:01" : "00:01:00", // Start static tasks at 2 sec min
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

  const handleAddComment = async (taskId, text, userRole) => {
    const commentData = { comments_description: text, created_by: userRole || 'admin', tasks_fk: taskId };
    try {
      const response = await fetch(`${API_BASE_URL}/comments`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(commentData)
      });
      if (response.ok) { fetchTaskComments(taskId); }
    } catch (error) { console.error('Error posting comment:', error); }
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

      {/* Modales... */}
      {isModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0, 0, 0, 0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999 }}>
          <div style={{ background: '#2c303a', padding: '25px', borderRadius: '8px', width: '400px', color: 'white', boxShadow: '0 4px 15px rgba(0,0,0,0.3)' }}>
            <h3 style={{ marginTop: 0, marginBottom: '20px', borderBottom: '1px solid #444', paddingBottom: '10px' }}>Crear Nueva Tarea</h3>
            <label style={{ display: 'block', marginBottom: '5px' }}>Nombre de la tarea:</label>
            <input type="text" value={taskForm.task_name} onChange={(e) => setTaskForm({ ...taskForm, task_name: e.target.value })} style={{ width: '100%', padding: '8px', marginBottom: '15px', borderRadius: '4px', border: '1px solid #555', background: '#1e2128', color: 'white' }} />
            <label style={{ display: 'block', marginBottom: '5px' }}>Descripción:</label>
            <textarea value={taskForm.task_description} onChange={(e) => setTaskForm({ ...taskForm, task_description: e.target.value })} style={{ width: '100%', padding: '8px', marginBottom: '15px', borderRadius: '4px', border: '1px solid #555', background: '#1e2128', color: 'white', minHeight: '80px' }} />
            <label style={{ display: 'block', marginBottom: '5px' }}>Fecha de Entrega (Due Date):</label>
            <input type="date" value={taskForm.task_due_date} onChange={(e) => setTaskForm({ ...taskForm, task_due_date: e.target.value })} style={{ width: '100%', padding: '8px', marginBottom: '20px', borderRadius: '4px', border: '1px solid #555', background: '#1e2128', color: 'white' }} />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button onClick={closeTaskModal} style={{ padding: '8px 15px', background: '#555', border: 'none', color: 'white', borderRadius: '4px', cursor: 'pointer' }}>Cancelar</button>
              <button onClick={handleCreateTask} style={{ padding: '8px 15px', background: '#4a90e2', border: 'none', color: 'white', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>Guardar Tarea</button>
            </div>
          </div>
        </div>
      )}

      {editTaskForm && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0, 0, 0, 0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999 }}>
          <div style={{ background: '#2c303a', padding: '25px', borderRadius: '8px', width: '400px', color: 'white', boxShadow: '0 4px 15px rgba(0,0,0,0.3)' }}>
            <h3 style={{ marginTop: 0, marginBottom: '20px', borderBottom: '1px solid #444', paddingBottom: '10px' }}>Actualizar Tarea</h3>
            <label style={{ display: 'block', marginBottom: '5px' }}>Nombre:</label>
            <input type="text" value={editTaskForm.task_name} onChange={(e) => setEditTaskForm({ ...editTaskForm, task_name: e.target.value })} style={{ width: '100%', padding: '8px', marginBottom: '15px', borderRadius: '4px', border: '1px solid #555', background: '#1e2128', color: 'white' }} />
            <label style={{ display: 'block', marginBottom: '5px' }}>Descripción:</label>
            <textarea value={editTaskForm.task_description} onChange={(e) => setEditTaskForm({ ...editTaskForm, task_description: e.target.value })} style={{ width: '100%', padding: '8px', marginBottom: '15px', borderRadius: '4px', border: '1px solid #555', background: '#1e2128', color: 'white', minHeight: '80px' }} />
            <label style={{ display: 'block', marginBottom: '5px' }}>Estatus:</label>
            <select value={editTaskForm.task_status} onChange={(e) => setEditTaskForm({ ...editTaskForm, task_status: e.target.value })} style={{ width: '100%', padding: '8px', marginBottom: '15px', borderRadius: '4px', border: '1px solid #555', background: '#1e2128', color: 'white' }}>
              <option value="Pendiente">Pendiente</option>
              <option value="En Progreso">En Progreso</option>
              <option value="Completado">Completado</option>
              <option value="Cancelado">Cancelado</option>
            </select>
            <label style={{ display: 'block', marginBottom: '5px' }}>Due Date (Fecha Límite):</label>
            <input type="date" value={editTaskForm.task_due_date || ''} onChange={(e) => setEditTaskForm({ ...editTaskForm, task_due_date: e.target.value })} style={{ width: '100%', padding: '8px', marginBottom: '20px', borderRadius: '4px', border: '1px solid #555', background: '#1e2128', color: 'white' }} />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button onClick={closeEditTaskModal} style={{ padding: '8px 15px', background: '#555', border: 'none', color: 'white', borderRadius: '4px', cursor: 'pointer' }}>Cancelar</button>
              <button onClick={handleSaveUpdatedTask} style={{ padding: '8px 15px', background: '#4caf50', border: 'none', color: 'white', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>Guardar Cambios</button>
            </div>
          </div>
        </div>
      )}

      <div className="project-header"><h2>{projectName}</h2></div>

      <div className="video-container">

        {/* REPRODUCTOR MULTIMEDIA SECUENCIAL */}
        <div className="video-screen" style={{ backgroundColor: '#000', position: 'relative', overflow: 'hidden' }}>
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
                  style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    opacity: opacityVal,
                    zIndex: views.length - idx, // La primera view en tu lista se dibuja arriba
                    pointerEvents: 'none'
                  }}
                >
                  {isImg ? (
                    <img
                      src={`${API_BASE_URL}/${task.file_path}`}
                      style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }}
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
            <div className="no-content-message" style={{ color: 'white', textAlign: 'center', width: '100%', paddingTop: '20%' }}>
              Selecciona una vista con tareas para previsualizar
            </div>
          )}
        </div>



        <div className="video-controls-centered" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: '15px', padding: '10px 0' }}>
          <button onClick={handleRewind} className="control-btn" title="Rebobinar">◀◀</button>
          <button onClick={togglePlay} className="control-btn play-main-btn">{isPlaying ? '⏸' : '▶'}</button>
          <button onClick={handleFastForward} className="control-btn" title="Adelantar">▶▶</button>

          {activeTimelineViewId && (
            <span style={{ color: '#aaa', fontSize: '14px', marginLeft: '20px' }}>
              <strong>{formatDuration(globalProgressMs / 1000)} / {formatDuration(totalDurationMs / 1000)}</strong>
            </span>
          )}

          {activeTimelineViewId && (
            <Box sx={{ width: '200px', display: 'flex', alignItems: 'center', gap: 2, marginLeft: '20px' }}>
              <Slider
                size="small" value={timelineScale} min={0.05} max={2} step={0.01} onChange={(e, newValue) => setTimelineScale(newValue)}
                aria-label="Timeline Zoom" valueLabelDisplay="auto" valueLabelFormat={(value) => `${Math.round(value * 100)}%`}
                sx={{ color: '#4a90e2' }}
              />
            </Box>
          )}
        </div>

        {/* TIMELINE VISUAL */}
        <div className="timeline-task-tracks" style={{ display: 'flex', flexDirection: 'row', width: '100%', height: '100px', backgroundColor: '#111', marginBottom: '5px', overflowX: 'auto', overflowY: 'hidden', position: 'relative' }}>
          <div className="timeline-inner-track" style={{ display: 'flex', flexDirection: 'row', height: '100%', minWidth: `${Math.max((totalDurationMs / 1000) * 5, 800) * timelineScale}px`, position: 'relative', transition: 'min-width 0.2s ease-out' }}>
            {activeTimelineViewId ? (
              activeTasks.map((task, index) => {
                const durationInSecs = parseDuration(task.tasks_duration);
                const isCurrentlyPlaying = index === currentTaskIndex;

                const isVideoFile = task.file_path && task.file_path.match(/\.(mp4|webm|ogg|mov)$/i);
                const isImgFile = task.file_path && task.file_path.match(/\.(jpeg|jpg|gif|png)$/i);
                const canResize = !task.is_estatic && !isVideoFile;

                const rawFileName = task.file_path ? task.file_path.split('/').pop() : 'Vacío';

                // Calcular ancho proporcional al tiempo total
                const widthPercent = totalDurationMs > 0 ? ((durationInSecs * 1000) / totalDurationMs) * 100 : 0;

                return (
                  <div
                    key={task.tasks_pk}
                    title={`${task.task_name} (${task.tasks_duration})`}
                    draggable={!task.is_estatic}
                    onDragStart={(e) => {
                      if (task.is_estatic) e.preventDefault();
                      else onDragStartTask(e, task.tasks_pk);
                    }}
                    onDragOver={onDragOverTask}
                    onDrop={(e) => onDropTask(e, task.tasks_pk)}
                    style={{
                      width: `${widthPercent}%`, minWidth: '30px', height: '100%',
                      backgroundColor: task.is_estatic ? '#555' : (isVideoFile ? '#9b59b6' : '#2196F3'),
                      borderRight: '1px solid #000', borderLeft: '1px solid #000',
                      border: isCurrentlyPlaying ? '3px solid #ffeb3b' : '1px solid #000',
                      position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '12px', fontWeight: 'bold', color: 'white', whiteSpace: 'nowrap', overflow: 'hidden', userSelect: 'none', cursor: task.is_estatic ? 'not-allowed' : 'grab', flexShrink: 0
                    }}>

                    {isImgFile && (
                      <img src={`${API_BASE_URL}/${task.file_path}`} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.4, zIndex: 0 }} alt="thumb" />
                    )}

                    <span style={{ zIndex: 1, display: 'flex', alignItems: 'center', gap: '5px', padding: '0 5px' }}>
                      {task.is_estatic && <span>🔒</span>}
                      {isVideoFile && <span>🎬</span>}
                      <span style={{ textOverflow: 'ellipsis', overflow: 'hidden' }}>{rawFileName}</span>
                    </span>

                    {canResize && (
                      <div onMouseDown={(e) => handleDragStart(e, task)} style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '8px', backgroundColor: 'rgba(255, 255, 255, 0.6)', cursor: 'ew-resize', zIndex: 2 }} />
                    )}
                  </div>
                );
              })
            ) : (<div style={{ color: '#555', fontSize: '12px', width: '100%', textAlign: 'center', lineHeight: '40px' }}>Selecciona una vista para ver su pipeline</div>)}
          </div>
        </div>

        <div className="video-controls-bar" style={{ padding: '10px', width: '100%' }}>
          <div className="progress-bar-container" style={{ width: '100%' }}>
            <input
              type="range" min="0" max="100"
              value={totalDurationMs > 0 ? (globalProgressMs / totalDurationMs) * 100 : 0}
              onChange={handleProgressChange}
              className="progress-bar" style={{ width: '100%', cursor: 'pointer' }}
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