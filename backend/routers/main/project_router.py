from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional
from datetime import date

from sqlalchemy.orm import Session
from database.database import SessionLocal
from model.project import Project
from model.proyectusers import ProjectUsers
from model.proyectviews import ProjectViews
from model.views import Views

from routers.authentication.jwt_auth_users import (
    require_admin,
    current_user,
    is_admin,
    User as AuthUser,
)

router = APIRouter()

class ProjectCreate(BaseModel):
    project_name: str
    project_description: Optional[str] = ""
    start_date: Optional[date] = None
    is_active: bool = True
    user_ids: List[int] = []  

class ProjectUpdate(BaseModel):
    project_name: str
    project_description: Optional[str] = ""
    start_date: Optional[date] = None
    is_active: bool = True

class ProjectUsersSync(BaseModel):
    user_ids: List[int]

async def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

#Get proyect por rol
@router.get("/projects/my-projects")
def get_my_projects(
    user: AuthUser = Depends(current_user),
    db: Session = Depends(get_db)
):
    if is_admin(user, db):
        projects = db.query(Project).filter(Project.is_active == True).all()
    else:
        projects = (
            db.query(Project)
            .join(ProjectUsers, Project.project_pk == ProjectUsers.project_fk)
            .filter(
                ProjectUsers.user_fk == user.users_pk,
                ProjectUsers.is_active == True,
                Project.is_active == True
            )
            .all()
        )

    return {
        "total": len(projects),
        "data": projects
    }


# Get de ids de user
@router.get("/projects/{project_id}/users", dependencies=[Depends(require_admin)])
def get_project_users(project_id: int, db: Session = Depends(get_db)):
    links = (
        db.query(ProjectUsers)
        .filter(
            ProjectUsers.project_fk == project_id,
            ProjectUsers.is_active == True
        )
        .all()
    )
    return {
        "project_id": project_id,
        "user_ids": [link.user_fk for link in links]
    }


# POST admin
@router.post("/projects", dependencies=[Depends(require_admin)])
def create_project(
    project_data: ProjectCreate,
    user: AuthUser = Depends(current_user),
    db: Session = Depends(get_db)
):
    existing_project = db.query(Project).filter(
        Project.project_name == project_data.project_name
    ).first()

    if existing_project:
        raise HTTPException(status_code=400, detail="Ya existe un proyecto con ese nombre")

    new_project = Project(
        project_name=project_data.project_name,
        project_description=project_data.project_description,
        start_date=project_data.start_date or date.today(),
        is_active=project_data.is_active
    )

    db.add(new_project)
    db.flush()

    unique_user_ids = set(project_data.user_ids)
    unique_user_ids.add(user.users_pk)

    for uid in unique_user_ids:
        db.add(ProjectUsers(
            project_fk=new_project.project_pk,
            user_fk=uid,
            is_active=True
        ))

    db.commit()
    db.refresh(new_project)

    return {
        "message": "Proyecto creado y usuarios asignados correctamente",
        "data": new_project
    }

# Get project activo
@router.get("/projects/{project_id}/views")
def get_project_views(project_id: int, db: Session = Depends(get_db)):
    project = db.query(Project).filter(
        Project.project_pk == project_id,
        Project.is_active == True
    ).first()

    if not project:
        raise HTTPException(
            status_code=404,
            detail="El proyecto no existe o ha sido deshabilitado."
        )

    views = (
        db.query(Views)
        .join(ProjectViews, Views.views_pk == ProjectViews.view_fk)
        .filter(
            ProjectViews.project_fk == project_id,
            ProjectViews.is_active == True,
            Views.is_active == True
        )
        .order_by(Views.views_order)
        .all()
    )

    return {
        "project_id": project_id,
        "total": len(views),
        "data": views
    }

#PUT Admin
@router.put("/projects/{project_id}", dependencies=[Depends(require_admin)])
def update_project(
    project_id: int,
    project_data: ProjectUpdate,
    db: Session = Depends(get_db)
):
    project_actual = db.query(Project).filter(
        Project.project_pk == project_id
    ).first()

    if not project_actual:
        raise HTTPException(
            status_code=404,
            detail="Project not found"
        )

    project_actual.project_name = project_data.project_name
    project_actual.project_description = project_data.project_description
    if project_data.start_date is not None:
        project_actual.start_date = project_data.start_date
    project_actual.is_active = project_data.is_active

    db.commit()
    db.refresh(project_actual)

    return {
        "message": "Project updated",
        "data": project_actual
    }

#PUT
@router.put("/projects/{project_id}/users", dependencies=[Depends(require_admin)])
def sync_project_users(
    project_id: int,
    payload: ProjectUsersSync,
    db: Session = Depends(get_db)
):
    project = db.query(Project).filter(Project.project_pk == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado")

    target_ids = set(payload.user_ids)
    existing_links = db.query(ProjectUsers).filter(
        ProjectUsers.project_fk == project_id
    ).all()

    existing_map = {link.user_fk: link for link in existing_links}

    for uid, link in existing_map.items():
        link.is_active = uid in target_ids

    for uid in target_ids:
        if uid not in existing_map:
            db.add(ProjectUsers(
                project_fk=project_id,
                user_fk=uid,
                is_active=True
            ))

    db.commit()
    return {
        "message": "Equipo del proyecto actualizado correctamente",
        "user_ids": list(target_ids)
    }

#Delete
@router.delete("/projects/{project_pk}", dependencies=[Depends(require_admin)])
async def borrar_project(project_pk: int, db: Session = Depends(get_db)):
    project_actual = db.query(Project).filter(
        Project.project_pk == project_pk
    ).first()

    if not project_actual:
        raise HTTPException(status_code=404, detail="Project no encontrado")

    project_actual.is_active = False
    db.commit()

    return {"mensaje": f"Project con ID {project_pk} desactivado correctamente"}