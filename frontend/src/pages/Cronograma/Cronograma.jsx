import React, { useState, useEffect } from "react";
import { Gantt } from "gantt-task-react";
import "gantt-task-react/dist/index.css";
import "./Cronograma.css";

/*
Con esto se evita que haya desfase de fechas entre el backend y el frontend
ya que el backend manda la fecha en formato UTC y al parsearla en el frontend se le suma 6 horas
*/
const parseLocalDate = (dateStr) => {
    if (!dateStr) return new Date();
    const [year, month, day] = String(dateStr).split("T")[0].split("-").map(Number);
    return new Date(year, month - 1, day);
};
export default function Cronograma() {
  const [tasks, setTasks] = useState([]);
  const [selectedTask, setSelectedTask] = useState(null);
  const [users, setUsers] = useState([]);               //Esto es para el select de usuarios
  const [selectedUserId, setSelectedUserId] = useState("");
  const [isSaving, setIsSaving] = useState(false);



const fetchCronograma = async () => {
      try {
        const response = await fetch("http://localhost:8000/cronograma");
        if (!response.ok) throw new Error(`Error HTTP: ${response.status}`);
        const data = await response.json();

        const today = new Date();
        today.setHours(0, 0, 0, 0); // Normalizamos la fecha actual a las 00:00:00 para comparar solo días

        const formattedTasks = data.map((t) => {
          const dueDate = parseLocalDate(t.due_date);
          let startDate = parseLocalDate(t.start_date);

/*
Si una tarea se crea con una fecha de entrega anterior a su fecha de inicio
(ej. tareas atrasadas), igualamos el inicio al fin para evitar barras invertidas
--------------------ESTO FUE SOLO PARA PRUEBAS----------------------------
*/
          if (startDate > dueDate) {
            startDate = new Date(dueDate);
          }

//En caso de que el inicio y el fin sean el mismo día, se ajusta la hora del fin a las 23:59:59 para que la barra de progreso se vea completa
          const safeEndDate = new Date(dueDate);
          if (startDate.getTime() === safeEndDate.getTime()) {
            safeEndDate.setHours(23, 59, 59, 999);
          }

          // Definimos colores y progreso por defecto
          let bgColor = "#9ca3af";
          let progColor = "#6b7280";
          let taskProgress = 0;
          const currentStatus = t.status ? t.status.trim().toLowerCase() : "";

          if (currentStatus === "completado" || currentStatus === "completada") {
            bgColor = "#22c55e";
            progColor = "#16a34a";
            taskProgress = 100;
          } else if (currentStatus === "cancelado" || currentStatus === "cancelada") {
            bgColor = "#ef4444";
            progColor = "#b91c1c";
            taskProgress = 0;
          } else if (currentStatus === "en proceso" || currentStatus === "en progreso") {
            bgColor = dueDate < today ? "#f97316" : "#3b82f6";
            progColor = dueDate < today ? "#ea580c" : "#2563eb";
            taskProgress = 50;
          } else {
            // Aplica para "pendiente" o cualquier otro estado no reconocido
            bgColor = dueDate < today ? "#f97316" : "#9ca3af";
            progColor = dueDate < today ? "#ea580c" : "#6b7280";
            taskProgress = 0;
          }

          const isOverdue =
            dueDate < today &&
            currentStatus !== "completado" &&
            currentStatus !== "completada" &&
            currentStatus !== "cancelado" &&
            currentStatus !== "cancelada";

          const statusLabel = isOverdue
            ? `${t.status || "Pendiente"} (Atrasada)`
            : t.status || "Pendiente";

          return {
            start: startDate,
            end: safeEndDate,
            name: `${t.task_name} (${t.assigned_user})`,
            id: t.task_id.toString(),
            type: "task",
            progress: taskProgress,
            status: statusLabel,
            assignedUserId: t.assigned_user_id,
            isDisabled: false,
            styles: {
              backgroundColor: bgColor,
              progressColor: progColor,
            },
          };
        });

        setTasks(formattedTasks);
      } catch (error) {
        console.error("Error al cargar el cronograma:", error);
      }
    };
useEffect(() => {
  fetchCronograma();
  fetch("http://localhost:8000/cronograma/usuarios")
      .then((res) => {
        if (!res.ok) throw new Error(`Error HTTP: ${res.status}`);
        return res.json();
      })
      .then((data) => setUsers(data))
      .catch((err) => console.error("Error al cargar usuarios:", err));
  }, []);

  const handleAsignarUsuario = async () => {
    if (!selectedTask) return;
    setIsSaving(true);
    try {
      const response = await fetch(
        `http://localhost:8000/cronograma/${selectedTask.id}/asignar`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_pk: selectedUserId ? Number(selectedUserId) : null,
          }),
        }
      );

      if (!response.ok) throw new Error(`Error HTTP: ${response.status}`);

      await fetchCronograma(); // Refresca las barras con el nuevo usuario
      setSelectedTask(null);   // Cierra el modal
    } catch (error) {
      console.error("Error al asignar usuario:", error);
      alert("No se pudo guardar la asignación. Revisa la consola.");
    } finally {
      setIsSaving(false);
    }
  };

  if (tasks.length === 0) return <div>Cargando cronograma...</div>;

return (
    <div className="cronograma-container p-4 relative"> 
      <h2 className="text-xl font-bold mb-4">Cronograma de Producción</h2>
      
      <div className="gantt-wrapper">
        <Gantt 
          tasks={tasks} 
          viewMode="Day" 
          locale="es"
          listCellWidth="220px"
          columnWidth={80}      
          rowHeight={50}        
          fontSize={12} 
          onClick={(task) => {
            const fullTask = tasks.find((t) => t.id === task.id) || task;
            setSelectedTask(fullTask);
            setSelectedUserId(
              fullTask.assignedUserId ? String(fullTask.assignedUserId) : "");
        }}
          TooltipContent={() => null} 
        />
      </div>

      {/* Detalles que se muestran cuando hay una tarea seleccionada */}
      {selectedTask && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl w-96 border border-gray-200 relative">
            <h3 className="text-lg font-bold mb-4 border-b border-gray-200 pb-2 text-gray-800">
              Detalles de la Tarea
            </h3>

            <div className="space-y-3 text-sm text-gray-700">
              <p><strong className="text-gray-900">Nombre:</strong> {selectedTask.name}</p>
              <p><strong className="text-gray-900">Estado:</strong> {selectedTask.status}</p>
              <p><strong className="text-gray-900">Inicio:</strong> {selectedTask.start.toLocaleDateString("es-ES")}</p>
              <p><strong className="text-gray-900">Límite:</strong> {selectedTask.end.toLocaleDateString("es-ES")}</p>
              <p>
                <strong className="text-gray-900">Progreso:</strong>{" "}
                <span className="ml-2 inline-block bg-blue-100 text-blue-800 px-2 py-1 rounded-full font-semibold">
                  {selectedTask.progress}%
                </span>
              </p>

              {/* NUEVO: Selector para asignar o cambiar el usuario */}
              <div className="pt-2 border-t border-gray-200">
                <label className="block text-gray-900 font-bold mb-1">
                  Asignar a:
                </label>
                <select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-gray-800 bg-white"
                >
                  <option value="">Sin asignar</option>
                  {users.map((u) => (
                    <option key={u.user_pk} value={u.user_pk}>
                      {u.user_name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* NUEVO: Botón de Guardar asignación junto al de Cerrar */}
            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={handleAsignarUsuario}
                disabled={isSaving}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-500 transition-colors disabled:opacity-50"
              >
                {isSaving ? "Guardando..." : "Guardar asignación"}
              </button>
              <button
                onClick={() => setSelectedTask(null)}
                className="bg-gray-800 text-white px-4 py-2 rounded hover:bg-gray-700 transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}