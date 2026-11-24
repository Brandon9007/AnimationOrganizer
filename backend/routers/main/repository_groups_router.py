from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional
import os

from model.repository_groups import RepositoryGroups
from model.repository import Repository
from model.tasks import Tasks
from sqlalchemy.orm import Session
from database.database import SessionLocal
from routers.authentication.jwt_auth_users import require_admin

router = APIRouter()

class RepositoryGroupsClass(BaseModel):
    repository_groups_pk: Optional[int] = None
    repository_groups_name: str
    tasks_fk: int
    repository_fk: int
    is_active: bool = True

class RepositoryTaskSync(BaseModel):
    task_ids: List[int]

async def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# GET general
@router.get("/repository_groups")
async def obtener_repository_groups(db: Session = Depends(get_db)):
    repository_groups = (
        db.query(RepositoryGroups)
        .filter(RepositoryGroups.is_active == True)
        .all()
    )
    return {
        "mensaje": "Conexión a la base de datos exitosa",
        "total_part": len(repository_groups),
        "data": repository_groups
    }

# Obtener IDs de tareas enlazadas a un archivo del repositorio
@router.get("/repositories/{repository_id}/tasks")
def get_repository_tasks(repository_id: int, db: Session = Depends(get_db)):
    links = (
        db.query(RepositoryGroups)
        .filter(
            RepositoryGroups.repository_fk == repository_id,
            RepositoryGroups.is_active == True
        )
        .all()
    )
    return {
        "repository_id": repository_id,
        "task_ids": [link.tasks_fk for link in links]
    }

# Sincronizar (enlazar o desenlazar) tareas de un archivo del repositorio
@router.put("/repositories/{repository_id}/tasks", dependencies=[Depends(require_admin)])
def sync_repository_tasks(
    repository_id: int,
    payload: RepositoryTaskSync,
    db: Session = Depends(get_db)
):
    repo = db.query(Repository).filter(
        Repository.repository_pk == repository_id,
        Repository.is_active == True
    ).first()
    if not repo:
        raise HTTPException(status_code=404, detail="Archivo no encontrado en el repositorio")

    target_task_ids = set(payload.task_ids)
    tasks_map = {
        t.tasks_pk: t
        for t in db.query(Tasks).filter(Tasks.tasks_pk.in_(target_task_ids)).all()
    }

    existing_links = db.query(RepositoryGroups).filter(
        RepositoryGroups.repository_fk == repository_id
    ).all()
    existing_map = {link.tasks_fk: link for link in existing_links}

    repo_label = repo.file_name or os.path.basename(repo.link or f"asset_{repository_id}")

    # Actualizar enlaces existentes (activar los seleccionados, desactivar los desmarcados)
    for task_id, link in existing_map.items():
        if task_id in target_task_ids:
            link.is_active = True
            task_obj = tasks_map.get(task_id)
            if task_obj:
                link.repository_groups_name = f"{repo_label} - {task_obj.task_name}"
        else:
            link.is_active = False

    # Crear nuevos enlaces
    for task_id in target_task_ids:
        if task_id not in existing_map and task_id in tasks_map:
            task_obj = tasks_map[task_id]
            db.add(RepositoryGroups(
                repository_groups_name=f"{repo_label} - {task_obj.task_name}",
                tasks_fk=task_id,
                repository_fk=repository_id,
                is_active=True
            ))

    db.commit()
    return {
        "message": "Enlaces con tareas actualizados correctamente",
        "repository_id": repository_id,
        "task_ids": list(target_task_ids)
    }

# Obtener todos los assets del repositorio vinculados a una tarea específica
@router.get("/tasks/{task_id}/repository-assets")
def get_task_repository_assets(task_id: int, db: Session = Depends(get_db)):
    items = (
        db.query(Repository)
        .join(RepositoryGroups, Repository.repository_pk == RepositoryGroups.repository_fk)
        .filter(
            RepositoryGroups.tasks_fk == task_id,
            RepositoryGroups.is_active == True,
            Repository.is_active == True
        )
        .all()
    )
    return {
        "task_id": task_id,
        "total": len(items),
        "data": items
    }

# POST individual
@router.post("/repository_groups", dependencies=[Depends(require_admin)])
def create_repository_group(
    group_data: RepositoryGroupsClass,
    db: Session = Depends(get_db)
):
    new_group = RepositoryGroups(
        repository_groups_name=group_data.repository_groups_name,
        tasks_fk=group_data.tasks_fk,
        repository_fk=group_data.repository_fk,
        is_active=group_data.is_active
    )
    db.add(new_group)
    db.commit()
    db.refresh(new_group)

    return {
        "message": "Repository group created successfully",
        "data": new_group
    }

# DELETE
@router.delete("/repository_groups/{group_pk}", dependencies=[Depends(require_admin)])
async def borrar_repository_group(group_pk: int, db: Session = Depends(get_db)):
    group_actual = db.query(RepositoryGroups).filter(
        RepositoryGroups.repository_groups_pk == group_pk
    ).first()

    if not group_actual:
        raise HTTPException(status_code=404, detail="Repository group no encontrado")

    group_actual.is_active = False
    db.commit()
    return {"mensaje": f"Repository group con ID {group_pk} desactivado correctamente"}