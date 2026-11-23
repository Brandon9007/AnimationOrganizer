#FastApi
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from pathlib import Path
import os

#Middleware
from fastapi.middleware.cors import CORSMiddleware

#SQL
from database.database import SessionLocal



#Routers
from routers import assets
from routers.authentication.jwt_auth_users import router as login_router
from routers.main.user_router import router as users_router
from routers.main.rol_router import router as rol_router
from routers.main.views_router import router as views_router
from routers.main.permisions_router import router as permissions_router
from routers.main.tasks_router import router as tasks_router
from routers.main.permissions_groups_router import router as permissions_group_router
from routers.main.group_tasks_views_router import router as groups_tasks_views_router
from routers.main.group_tasks_router import router as group_tasks_router
from routers.main.files_tasks_type_router import router as files_tasks_type_router
from routers.main.files_tasks_router import router as files_tasks_router
from routers.main.files_tasks_groups_router import router as files_tasks_groups_router
from routers.main.repository_router import router as repository_router
from routers.main.repository_groups_router import router as repository_groups_router
from routers.main.comments_router import router as comments_router
from routers.main.project_router import router as project_router
from routers.main.proyectusers_router import router as project_users_router
from routers.main.proyectviews_router import router as project_views_router


#main
app = FastAPI(
    title="AnimationOrganizer API",
    description="API para la gestión de proyectos, tareas y assets.",
    version="1.0.0",
)

class PublicUploads(StaticFiles):
    def lookup_path(self, path):
        full_path, stat_result = super().lookup_path(path)
        if stat_result and Path(full_path).resolve().is_relative_to(assets.ASSETS_DIR.resolve()):
            return "", None
        return full_path, stat_result


#Carpeta uploads
os.makedirs("uploads", exist_ok=True)
app.mount("/uploads", PublicUploads(directory="uploads"), name="uploads")


#middleware
#Rutas del frontend que se permiten para hacer peticiones al backend
origins = [
    "http://localhost:3000",
   
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],       
    allow_headers=["*"],      
)

#Invocaione de los Routers
app.include_router(login_router)
app.include_router(users_router)
app.include_router(rol_router)
app.include_router(views_router)
app.include_router(permissions_router)
app.include_router(tasks_router)
app.include_router(permissions_group_router)
app.include_router(groups_tasks_views_router)
app.include_router(group_tasks_router)
app.include_router(files_tasks_type_router)
app.include_router(files_tasks_router)
app.include_router(files_tasks_groups_router)
app.include_router(repository_router)
app.include_router(repository_groups_router)
app.include_router(comments_router)
app.include_router(project_router)
app.include_router(project_users_router)
app.include_router(project_views_router)
app.include_router(assets.router)

#Funcion de Sesion de la base de datos 
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@app.get("/", tags=["General"])
def inicio():
    return {"message": "AnimationOrganizer API funcionando correctamente", "status": "online"}
