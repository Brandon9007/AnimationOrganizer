from fastapi import APIRouter, HTTPException, Depends, File, UploadFile, Form
from pydantic import BaseModel
from typing import List, Optional
from datetime import date
import os
import shutil
import uuid

from sqlalchemy import inspect, text
from sqlalchemy.orm import Session
from database.database import SessionLocal, engine
from model.repository import Repository
from model.project import Project
from model.proyectusers import ProjectUsers
from routers.authentication.jwt_auth_users import current_user, is_admin, User as AuthUser

router = APIRouter()

def ensure_repository_columns():
    inspector = inspect(engine)
    if "repository" in inspector.get_table_names():
        existing = {col["name"] for col in inspector.get_columns("repository")}
        with engine.begin() as conn:
            if "project_fk" not in existing:
                conn.execute(text("ALTER TABLE repository ADD COLUMN project_fk INTEGER"))
            if "file_name" not in existing:
                conn.execute(text("ALTER TABLE repository ADD COLUMN file_name VARCHAR"))
            if "file_size" not in existing:
                conn.execute(text("ALTER TABLE repository ADD COLUMN file_size INTEGER DEFAULT 0"))
            if "created_at" not in existing:
                conn.execute(text("ALTER TABLE repository ADD COLUMN created_at DATE"))

ensure_repository_columns()

class RepositoryUpdate(BaseModel):
    repository_description: Optional[str] = None
    is_active: Optional[bool] = None

async def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def verify_project_access(project_id: int, user: AuthUser, db: Session):
    project = db.query(Project).filter(
        Project.project_pk == project_id,
        Project.is_active == True
    ).first()
    if not project:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado o inactivo.")

    if not is_admin(user, db):
        membership = db.query(ProjectUsers).filter(
            ProjectUsers.project_fk == project_id,
            ProjectUsers.user_fk == user.users_pk,
            ProjectUsers.is_active == True
        ).first()
        if not membership:
            raise HTTPException(status_code=403, detail="No tienes acceso a este proyecto.")

# Get archivos por proyectod
@router.get("/repositories/project/{project_id}")
def get_project_repositories(
    project_id: int,
    user: AuthUser = Depends(current_user),
    db: Session = Depends(get_db)
):
    verify_project_access(project_id, user, db)

    items = (
        db.query(Repository)
        .filter(
            Repository.project_fk == project_id,
            Repository.is_active == True
        )
        .order_by(Repository.repository_pk.desc())
        .all()
    )

    result = [
        {
            "repository_pk": item.repository_pk,
            "link": item.link,
            "file_name": item.file_name or os.path.basename(item.link or ""),
            "repository_description": item.repository_description or "",
            "file_size": item.file_size or 0,
            "created_at": str(item.created_at) if item.created_at else str(date.today()),
            "project_fk": item.project_fk,
            "is_active": item.is_active,
        }
        for item in items
    ]

    return {
        "project_id": project_id,
        "total": len(result),
        "data": result
    }

# Post uploads 
@router.post("/repositories/upload")
async def upload_repository_files(
    project_id: int = Form(...),
    description: str = Form(""),
    files: List[UploadFile] = File(...),
    user: AuthUser = Depends(current_user),
    db: Session = Depends(get_db)
):
    verify_project_access(project_id, user, db)

    folder_path = f"uploads/repository/project_{project_id}"
    os.makedirs(folder_path, exist_ok=True)

    created_records = []
    for upload in files:
        safe_name = os.path.basename(upload.filename or "archivo")
        unique_filename = f"{uuid.uuid4().hex[:8]}_{safe_name}"
        file_location = f"{folder_path}/{unique_filename}"

        with open(file_location, "wb+") as buffer:
            shutil.copyfileobj(upload.file, buffer)

        size_bytes = os.path.getsize(file_location)

        repo_item = Repository(
            link=file_location,
            file_name=safe_name,
            repository_description=description or safe_name,
            file_size=size_bytes,
            created_at=date.today(),
            project_fk=project_id,
            is_active=True
        )
        db.add(repo_item)
        created_records.append(repo_item)

    db.commit()
    for rec in created_records:
        db.refresh(rec)

    return {
        "message": f"{len(created_records)} archivo(s) subido(s) correctamente",
        "data": created_records
    }

# PUt descripcion
@router.put("/repositories/{repository_id}")
def update_repository(
    repository_id: int,
    repository_data: RepositoryUpdate,
    user: AuthUser = Depends(current_user),
    db: Session = Depends(get_db)
):
    repo_actual = db.query(Repository).filter(
        Repository.repository_pk == repository_id
    ).first()

    if not repo_actual:
        raise HTTPException(status_code=404, detail="Archivo no encontrado")

    if repository_data.repository_description is not None:
        repo_actual.repository_description = repository_data.repository_description
    if repository_data.is_active is not None:
        repo_actual.is_active = repository_data.is_active

    db.commit()
    db.refresh(repo_actual)
    return {"message": "Archivo actualizado", "data": repo_actual}

#Delte 
@router.delete("/repositories/{repository_pk}")
def borrar_repository(
    repository_pk: int,
    user: AuthUser = Depends(current_user),
    db: Session = Depends(get_db)
):
    repo_actual = db.query(Repository).filter(
        Repository.repository_pk == repository_pk
    ).first()

    if not repo_actual:
        raise HTTPException(status_code=404, detail="Archivo no encontrado")

    if repo_actual.project_fk:
        verify_project_access(repo_actual.project_fk, user, db)

    repo_actual.is_active = False
    db.commit()

    return {"mensaje": f"Archivo con ID {repository_pk} eliminado del repositorio"}