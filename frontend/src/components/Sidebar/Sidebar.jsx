import React, { useState } from 'react';
import './Sidebar.css';
import { useNavigate } from "react-router-dom";

function Sidebar() {
    const navigate = useNavigate();
    const [open, setOpen] = useState(true);

    const userRole = (localStorage.getItem('user_role') || '').toLowerCase();
    const activeProjectName = localStorage.getItem('active_project_name');

    const handleLogout = () => {
        localStorage.removeItem('fastapi_token');
        localStorage.removeItem('user_role');
        localStorage.removeItem('active_project_id');
        localStorage.removeItem('active_project_name');
        navigate('/', { replace: true });
    };

    return (
        <div className={open ? "SideBar" : "SideBar closed"}>
            <button className="ToggleButton" onClick={() => setOpen(!open)}>
                ☰
            </button>

            {open && (
                <>
                    <div className="SidebarProjectBox">
                        <small style={{ fontSize: '10px', opacity: 0.75, display: 'block' }}>
                            PROYECTO ACTUAL
                        </small>
                        <strong style={{ fontSize: '13px', display: 'block', marginBottom: '8px' }}>
                            {activeProjectName || 'Sin seleccionar'}
                        </strong>

                        <button className="Buttom" onClick={() => navigate("/proyectos")}>
                            ⇄ Cambiar proyecto
                        </button>

                        {userRole === 'admin' && (
                            <button
                                className="Buttom"
                                onClick={() => navigate("/proyectos?crear=true")}
                            >
                                ＋ Nuevo proyecto
                            </button>
                        )}
                    </div>

                    <hr style={{ width: '100%', opacity: 0.2, margin: '8px 0' }} />


                    {userRole === 'admin' && (
                        <>
                            <button className="Buttom" onClick={() => navigate("/produccion")}>
                                Produccion
                            </button>
                            <button className="Buttom" onClick={() => navigate("/usuarios")}>
                                Usuarios
                            </button>
                        </>
                    )}



{/* Agregar al terminar el proeycto Pendeinte  
                    <button className="Buttom" onClick={() => navigate("/dashboard")}>
                        Main Dashboard
                    </button>*/}

                    <button className="Buttom" onClick={() => navigate("/pipeline")}>
                        Pipeline
                    </button>

                    <button className="Buttom" onClick={() => navigate("/cronograma")}>
                        Cronograma
                    </button>

                    {userRole === 'admin' && (
                        <button className="Buttom" onClick={() => navigate("/produccion")}>
                            Produccion
                        </button>
                    )}

                    <button className="Buttom" onClick={() => navigate("/repositorio")}>
                        Repositorio
                    </button>

                    <button className="Buttom" onClick={() => navigate("/mis-assets")}>
                        Mis assets
                    </button>

                    

                    <button className="Buttom" onClick={handleLogout}>
                        Exit
                    </button>
                </>
            )}
        </div>
    );
}

export default Sidebar;