from fastapi import APIRouter, HTTPException, Depends, File, UploadFile
from pydantic import BaseModel
from typing import List, Optional
from datetime import date

import os 
import shutil

from model.user import User
from model.rol import Role
from model.tasks import Tasks
from model.files_tasks import FilesTasks
from model.files_tasks_groups import FilesTasksGroups
from model.files_tasks_type import FilesTasksTypes
from model.groups_tasks_views import GroupsTasksViews
from model.groups_tasks import GroupTasks
from model.permisions import Permissions
from model.permissions_group import PermissionsGroup
from model.views import Views   

from sqlalchemy.orm import Session
from database.database import SessionLocal, engine

router = APIRouter()

class TasksClass(BaseModel):
    tasks_pk: Optional[int] = None
    task_name: str
    task_description: str
    task_status: str
    task_created_at: date
    task_updated_at: date
    task_due_date: date
    tasks_order: int
    tasks_duration:str
    is_estatic:bool
    file_path: Optional[str] = None

    is_active: bool
    start_date: Optional[date] = None  # K
    due_date: Optional[date] = None    # K
    
# Conexion a la base de datos 
async def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Endpoints
#GET
@router.get("/tasks")
def get_tasks(db: Session = Depends(get_db)):
    tasks = db.query(Tasks).all()
    
    result = []
    for task in tasks:
        task_dict = {
            "tasks_pk": task.tasks_pk,
            "task_name": task.task_name,
            "task_description": task.task_description,
            "task_status": task.task_status,
            "task_created_at": task.task_created_at, 
            "task_updated_at": task.task_updated_at,
            "task_due_date": task.task_due_date,
            "is_estatic": task.is_estatic,
            "tasks_duration": task.tasks_duration,
            "tasks_order": task.tasks_order,
            "is_active": task.is_active,
            "file_path": task.file_path, # <-- ESTO FALTABA PARA QUE REACT VEA EL ARCHIVO
            "views_pk": task.group_tasks_views[0].views_pk if task.group_tasks_views else None 
        }
        result.append(task_dict)
        
    return {"data": result}


# POST
@router.post("/tasks")
def create_task(
    task_data: TasksClass,
    db: Session = Depends(get_db)
):
    hoy = date.today()      #Crea las tareas con la fecha de hoy si no mandan fecha de inicio y fecha de entrega -K
    
    if not task_data.start_date:
            task_data.start_date = hoy
    
    if not task_data.due_date:
        if task_data.task_due_date:
            task_data.due_date = task_data.task_due_date
        else:
            from datetime import timedelta
            task_data.due_date = hoy + timedelta(days=7)
    
    if task_data.start_date < hoy:
        raise HTTPException(
            status_code=400,
            detail="La fecha de inicio no puede ser menor a la fecha actual."
        )
    
    if task_data.due_date < task_data.start_date:
        raise HTTPException(
            status_code=400,
            detail="La fecha de entrega no puede ser anterior a la fecha de inicio."
        )
    
    existing_task = db.query(Tasks).filter(
        Tasks.task_name == task_data.task_name
    ).first()

    if existing_task:
        raise HTTPException(
            status_code=400,
            detail="Task name already exists"
        )

    new_task = Tasks(
        task_name=task_data.task_name,
        task_description=task_data.task_description,
        task_status=task_data.task_status,
        task_created_at=task_data.task_created_at,
        task_updated_at=task_data.task_updated_at,
        task_due_date=task_data.task_due_date,
        tasks_order = task_data.tasks_order,
        tasks_duration = task_data.tasks_duration,
        is_estatic = task_data.is_estatic,
        is_active=task_data.is_active,
        start_date=task_data.start_date,    #K
        due_date=task_data.due_date         #K
    )

    db.add(new_task)
    db.commit()
    db.refresh(new_task)

    return {
        "message": "Task created successfully",
        "data": new_task
    }

# PUT
@router.put("/tasks/{task_id}")
def update_task(
    task_id: int,
    task_data: TasksClass,
    db: Session = Depends(get_db)
):
    task_actual = db.query(Tasks).filter(
        Tasks.tasks_pk == task_id
    ).first()

    if not task_actual:
        raise HTTPException(
            status_code=404,
            detail="Task not found"
        )

    task_actual.task_name = task_data.task_name
    task_actual.task_description = task_data.task_description
    task_actual.task_status = task_data.task_status
    task_actual.task_created_at = task_data.task_created_at
    task_actual.task_updated_at = task_data.task_updated_at
    task_actual.task_due_date = task_data.task_due_date
    task_actual.tasks_order = task_data.tasks_order
    task_actual.tasks_duration = task_data.tasks_duration
    task_actual.is_estatic = task_data.is_estatic
    task_actual.is_active = task_data.is_active

    db.commit()
    db.refresh(task_actual)

    return {
        "message": "Task updated",
        "data": task_actual
    }

# DELETE
@router.delete("/tasks/{tasks_pk}")
async def borrar_task(tasks_pk: int, db: Session = Depends(get_db)):
    task_actual = db.query(Tasks).filter(
        Tasks.tasks_pk == tasks_pk
    ).first() 

    if not task_actual:
        raise HTTPException(status_code=404, detail="Task no encontrado")

    task_actual.is_active = False

    for relacion in task_actual.group_tasks_views:
        relacion.is_active = False

    db.commit()
    
    return {"mensaje": f"Task con ID {tasks_pk} desactivado correctamente"}

#Importante para los archivos multimedia 
#POST 
@router.post("/tasks/{task_id}/upload")
async def upload_task_file(task_id: int, file: UploadFile = File(...), db: Session = Depends(get_db)):
    task = db.query(Tasks).filter(Tasks.tasks_pk == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    # Guardar el archivo localmente
    file_location = f"uploads/{task_id}_{file.filename}"
    with open(file_location, "wb+") as file_object:
        shutil.copyfileobj(file.file, file_object)

    # Actualizar la base de datos
    task.file_path = file_location
    db.commit()
    db.refresh(task)

    return {"message": "Archivo subido correctamente", "file_path": file_location}

#ESTO ES PARA EL CRONOGRAMA -K
@router.get("/cronograma")
def obtener_datos_cronograma(db: Session = Depends(get_db)):
    # Hacemos un JOIN entre Tasks, GroupTasks y Users
    resultados = (
        db.query(Tasks, User.user_pk, User.user_name)
        .join(GroupTasks, Tasks.tasks_pk == GroupTasks.task_pk, isouter=True)
        .join(User, GroupTasks.user_pk == User.user_pk, isouter=True)
        .filter(Tasks.is_active == True)
        .all()
    )

    # Formateamos la respuesta para que el frontend la consuma fácilmente
    cronograma_data = []
    for task, user_pk, user_name in resultados:
        cronograma_data.append({
            "task_id": task.tasks_pk,
            "task_name": task.task_name,
            "status": task.task_status,
            "start_date": task.start_date or task.task_created_at,
            "due_date": task.task_due_date or task.due_date,
            "assigned_user_id": user_pk,
            "assigned_user": user_name or "Sin asignar"
        })

    return cronograma_data

# PARA ASIGNAR USUARIOS A LAS TASKS EN CRONOGRAMA -K
class AsignacionUsuario(BaseModel):
    user_pk: Optional[int] = None

# Traer usuarios activos para llenar el dropdown del modal
@router.get("/cronograma/usuarios")
def obtener_usuarios_cronograma(db: Session = Depends(get_db)):
    usuarios = db.query(User).all()
    return [
        {"user_pk": u.user_pk, "user_name": u.user_name}
        for u in usuarios
    ]

# Asignar un usuario a una tarea en GroupTasks
@router.put("/cronograma/{task_id}/asignar")
def asignar_usuario_tarea(
    task_id: int,
    data: AsignacionUsuario,
    db: Session = Depends(get_db)
):
    asignacion = db.query(GroupTasks).filter(GroupTasks.task_pk == task_id).first()

    # Si mandan none, quitamos la asignación
    if data.user_pk is None:
        if asignacion:
            db.delete(asignacion)
            db.commit()
        return {"message": "Usuario desasignado correctamente"}

    # Si ya tenía a alguien asignado, lo actualizamos, si no, creamos el registro
    if asignacion:
        asignacion.user_pk = data.user_pk
    else:
        nueva_asignacion = GroupTasks(
            task_pk=task_id,
            user_pk=data.user_pk,
            group_tasks_name="Asignación"
        )
        db.add(nueva_asignacion)

    db.commit()
    return {"message": "Usuario asignado correctamente"}