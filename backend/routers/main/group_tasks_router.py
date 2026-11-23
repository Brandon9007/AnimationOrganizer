from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional

from model.user import User
from model.tasks import Tasks
from model.groups_tasks import GroupTasks

from sqlalchemy.orm import Session
from database.database import SessionLocal
from routers.authentication.jwt_auth_users import require_admin

router = APIRouter()

class GroupTasksClass(BaseModel):
    groups_tasks_pk: int
    groups_tasks_name: str
    is_active: bool
    tasks_pk: int
    user_pk: int

class GroupTasksCreate(BaseModel):
    group_tasks_name: Optional[str] = None
    is_active: bool = True
    task_pk: int
    user_pk: int

async def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# GET
@router.get("/groups_tasks")
async def obtener_groups_tasks(db: Session = Depends(get_db)):
    groups_tasks = db.query(GroupTasks).filter(GroupTasks.is_active == True).all()

    return {
        "mensaje": "Conexión a la base de datos exitosa",
        "total_part": len(groups_tasks),
        "data": groups_tasks
    }

# POST
@router.post("/groups_tasks", dependencies=[Depends(require_admin)])
def create_group_task(
    data: GroupTasksCreate,
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.user_pk == data.user_pk, User.is_active == True).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado o inactivo")

    task = db.query(Tasks).filter(Tasks.tasks_pk == data.task_pk, Tasks.is_active == True).first()
    if not task:
        raise HTTPException(status_code=404, detail="Tarea no encontrada o inactiva")

    auto_name = (
        data.group_tasks_name.strip()
        if data.group_tasks_name and data.group_tasks_name.strip()
        else f"{user.user_name} - {task.task_name}"
    )

    existing_pair = db.query(GroupTasks).filter(
        GroupTasks.task_pk == data.task_pk,
        GroupTasks.user_pk == data.user_pk
    ).first()

    if existing_pair:
        if existing_pair.is_active:
            raise HTTPException(
                status_code=400,
                detail="Este usuario ya está asignado a esta tarea"
            )
        existing_pair.is_active = True
        existing_pair.group_tasks_name = auto_name
        db.commit()
        db.refresh(existing_pair)
        return {
            "message": "Asignación reactivada correctamente",
            "data": existing_pair
        }

    new_group_task = GroupTasks(
        group_tasks_name=auto_name,
        is_active=True,
        task_pk=data.task_pk,
        user_pk=data.user_pk
    )

    db.add(new_group_task)
    db.commit()
    db.refresh(new_group_task)

    return {
        "message": "Asignación creada correctamente",
        "data": new_group_task
    }

# DELETE 
@router.delete("/groups_tasks/{groups_tasks_pk}", dependencies=[Depends(require_admin)])
async def borrar_group_task(groups_tasks_pk: int, db: Session = Depends(get_db)):
    group_task_actual = db.query(GroupTasks).filter(
        GroupTasks.group_tasks_pk == groups_tasks_pk
    ).first()

    if not group_task_actual:
        raise HTTPException(status_code=404, detail="Asignación no encontrada")

    group_task_actual.is_active = False
    db.commit()

    return {"mensaje": f"Asignación con ID {groups_tasks_pk} eliminada correctamente"}