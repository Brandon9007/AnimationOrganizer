import React from 'react';
import TasksSection from './TasksSection';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Slider from '@mui/material/Slider';

function ViewsSection({
  views,
  assetContexts,
  assetError,
  writeError,
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

  viewVisibility,
  toggleViewVisibility,
  viewOpacities,
  handleViewOpacityChange,
  currentUsername
}) {
  const isAdmin = (currentUserRole || '').toLowerCase() === 'admin';

  return (
    <div className="views-section-container">
      <div className="views-header-row">
        <div>
          <span className="pipe-eyebrow">CAPAS Y SECUENCIAS</span>
          <h3>Vistas del Proyecto</h3>
        </div>

        {isAdmin && (
          <div className="views-header-left">
            <input
              type="text"
              className="view-name-input"
              placeholder={`Nombre (ej. view_${viewCounter})`}
              value={newViewNameInput}
              onChange={(e) => setNewViewNameInput(e.target.value)}
            />
            <button
              onClick={handleCreateView}
              className="add-view-button"
              title="Agregar vista"
            >
              ＋ Nueva vista
            </button>
          </div>
        )}
      </div>

      {assetError && (
        <p className="pipe-alert" role="alert">
          {assetError}
        </p>
      )}
      {writeError && (
        <p className="pipe-alert" role="alert">
          {writeError}
        </p>
      )}

      <div className="views-content-area">
        {views.length === 0 ? (
          <p className="empty-views-text">No hay vistas agregadas todavía en este proyecto.</p>
        ) : (
          views.map((view) => {
            const isActive = activeTimelineViewId === view.views_pk;
            const isVisible = viewVisibility[view.views_pk] !== false;
            const opacity = viewOpacities[view.views_pk] ?? 100;

            return (
              <div
                key={view.views_pk}
                className={`view-item-card ${isActive ? 'is-active' : ''} ${
                  !isVisible ? 'is-hidden-layer' : ''
                }`}
                draggable={isAdmin && !view.assetsOnly}
                onDragStart={(e) => onDragStartView(e, view.views_pk)}
                onDragOver={onDragOverView}
                onDrop={(e) => onDropView(e, view.views_pk)}
                onClick={() => setActiveTimelineViewId(view.views_pk)}
              >
                <div className="view-item-header">
                  <div className="view-title-group">
                    <button
                      type="button"
                      className="view-eye-btn"
                      title={
                        isVisible
                          ? 'Ocultar vista en reproductor'
                          : 'Mostrar vista en reproductor'
                      }
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleViewVisibility(view.views_pk);
                      }}
                    >
                      {isVisible ? '👁️' : '🚫'}
                    </button>
                    <h4>{view.views_name}</h4>
                    {isActive && <span className="view-active-badge">● En timeline</span>}
                  </div>

                  {isAdmin && !view.assetsOnly && (
                    <div className="view-actions">
                      <button
                        type="button"
                        className="view-action-btn update-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleUpdateView(view.views_pk, view.views_order);
                        }}
                      >
                        ✎ Renombrar
                      </button>
                      <button
                        type="button"
                        className="view-action-btn delete-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteView(view.views_pk);
                        }}
                      >
                        🗑 Eliminar
                      </button>
                    </div>
                  )}
                </div>

                {/* SLIDER DE TRANSPARENCIA (OPACIDAD) */}
                <Box
                  sx={{ width: '100%', padding: '2px 6px' }}
                  onClick={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  <Stack spacing={2} direction="row" sx={{ alignItems: 'center' }}>
                    <span className="view-opacity-label">Opacidad: {opacity}%</span>
                    <Slider
                      size="small"
                      aria-label="Opacidad de vista"
                      value={opacity}
                      min={0}
                      max={100}
                      disabled={!isVisible}
                      onChange={(e, newValue) => handleViewOpacityChange(view.views_pk, newValue)}
                      sx={{ color: '#8b68e8' }}
                    />
                  </Stack>
                </Box>

                <div className="task-dropdown-container">
                  <button
                    type="button"
                    className="task-dropdown-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleTaskDropdown(view.views_pk);
                    }}
                  >
                    <span>Tareas de la vista</span>
                    <span>{openDropdownViewId === view.views_pk ? '▲' : '▼'}</span>
                  </button>

                  {openDropdownViewId === view.views_pk && (
                    <div onClick={(e) => e.stopPropagation()}>
                      <TasksSection
                        viewId={view.views_pk}
                        assetContexts={assetContexts.filter(
                          (context) => context.views_pk === view.views_pk
                        )}
                        canManage={isAdmin && !view.assetsOnly}
                        isAdmin={isAdmin}
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
                        currentUsername={currentUsername}
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