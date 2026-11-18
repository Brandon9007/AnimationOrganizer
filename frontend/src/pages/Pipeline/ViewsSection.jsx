import React from 'react';
import TasksSection from './TasksSection';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Slider from '@mui/material/Slider';

function ViewsSection({
  views,
  viewCounter,
  newViewNameInput,
  setNewViewNameInput,
  handleCreateView,
  handleUpdateView,
  handleDeleteView,

  onDragStartView,
  onDragOverView,
  onDropView,

  activeTimelineViewId,
  setActiveTimelineViewId,
  openDropdownViewId,
  toggleTaskDropdown,

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
  fetchTasks,

  // Nuevas props para visibilidad y opacidad
  viewVisibility,
  toggleViewVisibility,
  viewOpacities,
  handleViewOpacityChange
}) {
  return (
    <div className="views-section-container">
      <div className="views-header-left">
        <input
          type="text"
          className="view-name-input"
          placeholder={`view_${viewCounter}`}
          value={newViewNameInput}
          onChange={(e) => setNewViewNameInput(e.target.value)}
        />
        <button onClick={handleCreateView} className="add-view-button" title="Agregar vista">+</button>
      </div>

      <div className="views-content-area">
        {views.length === 0 ? (
          <p className="empty-views-text">No hay vistas agregadas todavia</p>
        ) : (
          views.map((view) => {
            const isActive = activeTimelineViewId === view.views_pk;
            const isVisible = viewVisibility[view.views_pk] !== false;
            const opacity = viewOpacities[view.views_pk] ?? 100;

            return (
              <div
                key={view.views_pk}
                className="view-item-card"
                draggable
                onDragStart={(e) => onDragStartView(e, view.views_pk)}
                onDragOver={onDragOverView}
                onDrop={(e) => onDropView(e, view.views_pk)}
                onClick={() => setActiveTimelineViewId(view.views_pk)}
                style={{
                  cursor: 'pointer',
                  backgroundColor: isActive ? '#3b4554' : '',
                  borderLeft: isActive ? '4px solid #4a90e2' : '4px solid transparent',
                  opacity: isVisible ? 1 : 0.6,
                  transition: 'background-color 0.2s, border-left 0.2s, opacity 0.2s'
                }}
              >
                <div className="view-item-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {/* BOTÓN OJITO */}
                    <button
                      title={isVisible ? 'Ocultar vista en reproductor' : 'Mostrar vista en reproductor'}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleViewVisibility(view.views_pk);
                      }}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '18px',
                        padding: '0 4px'
                      }}
                    >
                      {isVisible ? '👁️' : '🚫'}
                    </button>
                    <h4 style={{ margin: 0 }}>{view.views_name}</h4>
                  </div>

                  <div className="view-actions">
                    <button
                      className="view-action-btn update-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleUpdateView(view.views_pk, view.views_order);
                      }}
                    >
                      PUT
                    </button>
                    <button
                      className="view-action-btn delete-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteView(view.views_pk);
                      }}
                    >
                      DELETE
                    </button>
                  </div>
                </div>

                {/* SLIDER DE TRANSPARENCIA (OPACIDAD) */}
                <Box
                  sx={{ width: '100%', padding: '4px 10px' }}
                  onClick={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()} // Evita activar el Drag & Drop de la tarjeta
                >
                  <Stack spacing={2} direction="row" sx={{ alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', color: '#ccc', whiteSpace: 'nowrap' }}>
                      Opacidad: {opacity}%
                    </span>
                    <Slider
                      size="small"
                      aria-label="Opacidad de vista"
                      value={opacity}
                      min={0}
                      max={100}
                      disabled={!isVisible}
                      onChange={(e, newValue) => handleViewOpacityChange(view.views_pk, newValue)}
                      sx={{ color: '#4a90e2' }}
                    />
                  </Stack>
                </Box>

                <div className="task-dropdown-container">
                  <button
                    className="task-dropdown-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleTaskDropdown(view.views_pk);
                    }}
                  >
                    Opciones de Tareas {openDropdownViewId === view.views_pk ? '▲' : '▼'}
                  </button>

                  {openDropdownViewId === view.views_pk && (
                    <div onClick={(e) => e.stopPropagation()}>
                      <TasksSection
                        viewId={view.views_pk}
                        tasks={tasks}
                        openTaskModal={openTaskModal}
                        openEditTaskModal={openEditTaskModal}
                        handleToggleLock={handleToggleLock}
                        handleDeleteTask={handleDeleteTask}
                        handleToggleStatus={handleToggleStatus}
                        taskComments={taskComments}
                        fetchTaskComments={fetchTaskComments}
                        handleAddComment={handleAddComment}
                        currentUserRole={currentUserRole}
                        fetchTasks={fetchTasks}
                      />
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default ViewsSection;
