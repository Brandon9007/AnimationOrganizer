import React, { useEffect } from 'react';
import './VentanaGestionProduccion.css';

function VentanaGestionProduccion() {

    const [assignments, setAssignments] = React.useState([]);
    const [searchText, setSearchText]= React.useState('');
    const [workers, setWorkers] = React.useState([]);
    const [homeworks, setHomeworks] = React.useState([]);


    const loadAssignments = () => {
        fetch("http://localhost:8000/groups_tasks")
        .then(response =>{
            if(!response.ok)
                {
                   throw new Error("Error en la respuesta del servidor");
                }
            return response.json();
        })
        .then (data => {
            setAssignments(data.data);
        })
        .catch (error => {
            console.error("Error al cargar asignaciones:", error)
        }); 

    };

    useEffect(() => {
        loadAssignments();
    }, []);
    
    const [newAssignment, setNewAssignment] = React.useState(
        {
            group_tasks_name: '',
            task_pk: '',
            user_pk: '',
            is_active: true
        }
    );
      //Cargar trabajadores
    useEffect(() => {
        fetch("http://localhost:8000/users")
            .then (response => {
                if(!response.ok)
                {
                    throw new Error("Error en la respuesta del servidor");
                }
                return response.json();
            })
            .then (data => {
                setWorkers(data.data);
            })
            .catch (error => {
                console.error("Error al cargar trabajadores:", error);
            });
    }, []);

    //Cargar tareas
    useEffect(() => {
        fetch("http://localhost:8000/tasks")
            .then (response => {
                if(!response.ok)
                {
                    throw new Error("Error en la respuesta del servidor");
                }
                return response.json();
            })
            .then (data => {
                setHomeworks(data.data);
            })
            .catch (error => {
                console.error("Error al cargar trabajadores:", error)
            })

    },[]);

    const addTask = () => {
        if(!newAssignment.task_pk || !newAssignment.user_pk || !newAssignment.group_tasks_name) {
            alert('Por favor, complete todos los campos antes de agregar la tarea.');
            return;
        }

        const assignmentData = {
            group_tasks_name: newAssignment.group_tasks_name,
            task_pk: parseInt(newAssignment.task_pk),
            user_pk: parseInt(newAssignment.user_pk),
            is_active: newAssignment.is_active
        };

        fetch (
            "http://localhost:8000/groups_tasks",
            {
                method: 'POST',
                headers:  { 'Content-Type': 'application/json' },
                body: JSON.stringify(assignmentData)
                
            }
        )

        .then (response => {
            if(!response.ok)
                {
                   throw new Error("Error en la respuesta del servidor");
                }
            return response.json();
        })

        .then (data => {
            alert("Asignacion creada correctamente");
            loadAssignments();
            setNewAssignment({
            group_tasks_name: '',
            task_pk: '',
            user_pk: '',
            is_active: true
        });

        })

        .catch (error => {
                console.error("Error al guardar:", error)
        });        
    }

    const filteredAssignments = assignments.filter (a =>
        a.group_tasks_name.toLowerCase().includes(searchText.toLowerCase())
    );

    const getWorkerName = (user_pk) => {
        const  worker = workers.find(w => w.user_pk === user_pk)
        return worker ? worker.user_name: 'Sin asignar';
    };

    const getTaskName = (task_pk) => {
        const homework = homeworks.find(h => h.tasks_pk === task_pk)
        return homework ? homework.task_name: 'Sin tarea';
    };

    return (
        <div>
            <h1>Ventana Gestion Produccion</h1>
            <div className="task-form">

                <input
                    type="text"
                    placeholder="Nombre de la asignacion"
                    value={newAssignment.group_tasks_name}
                    onChange={(e) => setNewAssignment({ ...newAssignment, group_tasks_name: e.target.value})}
                />

                <select
                    value={newAssignment.task_pk}
                    onChange={(e) => setNewAssignment({ ...newAssignment, task_pk: e.target.value })}
                >
                    <option value="">Seleccionar tarea</option>

                    {homeworks.map((homework) => (
                        <option key={homework.tasks_pk} value={homework.tasks_pk}>
                            {homework.task_name}
                        </option>
                    ))}
                </select>


                <select
                    value={newAssignment.user_pk}
                    onChange={(e) => setNewAssignment({ ...newAssignment, user_pk: e.target.value })}
                >
                    <option value="">Seleccionar trabajador</option>

                    {workers.map((worker) => (
                        <option key={worker.user_pk} value={worker.user_pk}>
                            {worker.user_name}
                        </option>
                    ))}
                </select>

                
                <button
                    className="save-button"
                    onClick={() => addTask()}
                >
                    Guardar
                </button>
            </div>
            <div className="search-section">
                <input
                    className="search-input"
                    type="text"
                    placeholder="Buscar por nombre de asignacion"
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                />

                <table className="assignments-table">
                    <thead>
                       <tr>
                        <th>Asignacion</th>
                        <th>Tarea</th>
                        <th>Trabajador</th>
                       </tr>
                    </thead>
                    
                    <tbody>
                        {filteredAssignments.map((a) => (
                            <tr key={a.group_tasks_pk}>
                                <td>{a.group_tasks_name}</td>
                                <td>{getTaskName(a.task_pk)}</td>
                                <td>{getWorkerName(a.user_pk)}</td>
                                            
                            </tr>

                        ))
                        }
                    </tbody>
                </table>


            </div>
        </div>
    );
}

export default VentanaGestionProduccion;