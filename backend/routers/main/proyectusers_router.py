from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List

from model.proyectusers import ProjectUsers

from sqlalchemy.orm import Session
from database.database import SessionLocal, engine

from routers.authentication.jwt_auth_users import require_admin

router = APIRouter()

class ProjectUsersClass(BaseModel):
    project_users_pk: int
    is_active: bool
    project_fk: int
    user_fk: int
    
# Conexion a la base de datos 
async def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Endpoints
# GET
@router.get("/project_users")
async def obtener_project_users(db: Session = Depends(get_db)):
    project_users = db.query(ProjectUsers).all()

    return {
        "mensaje": "Conexión a la base de datos exitosa", 
        "total_part": len(project_users),
        "data": project_users
    }

# POST
@router.post("/project_users", dependencies=[Depends(require_admin)])
def create_project_user(
    project_user_data: ProjectUsersClass,
    db: Session = Depends(get_db)
):
    existing_project_user = db.query(ProjectUsers).filter(
        ProjectUsers.project_users_pk == project_user_data.project_users_pk
    ).first()

    if existing_project_user:
        raise HTTPException(
            status_code=400,
            detail="Project User ID already exists"
        )

    new_project_user = ProjectUsers(
        project_users_pk=project_user_data.project_users_pk,
        is_active=project_user_data.is_active,
        project_fk=project_user_data.project_fk,
        user_fk=project_user_data.user_fk
    )

    db.add(new_project_user)
    db.commit()
    db.refresh(new_project_user)

    return {
        "message": "Project User created successfully",
        "data": new_project_user
    }

# POST BULK
@router.post("/project_users/bulk", dependencies=[Depends(require_admin)])
def create_project_users_bulk(
    project_users_list: List[ProjectUsersClass],
    db: Session = Depends(get_db)
):
    project_users_to_insert = [
        ProjectUsers(
            project_users_pk=item.project_users_pk,
            is_active=item.is_active,
            project_fk=item.project_fk,
            user_fk=item.user_fk
        )
        for item in project_users_list
    ]

    db.add_all(project_users_to_insert)
    db.commit()

    return {
        "message": f"{len(project_users_to_insert)} project users inserted"
    }

# PUT
@router.put("/project_users/{project_user_id}", dependencies=[Depends(require_admin)])
def update_project_user(
    project_user_id: int,
    project_user_data: ProjectUsersClass,
    db: Session = Depends(get_db)
):
    project_user_actual = db.query(ProjectUsers).filter(
        ProjectUsers.project_users_pk == project_user_id
    ).first()

    if not project_user_actual:
        raise HTTPException(
            status_code=404,
            detail="Project User not found"
        )

    project_user_actual.is_active = project_user_data.is_active
    project_user_actual.project_fk = project_user_data.project_fk
    project_user_actual.user_fk = project_user_data.user_fk

    db.commit()
    db.refresh(project_user_actual)

    return {
        "message": "Project User updated",
        "data": project_user_actual
    }

# DELETE
@router.delete("/project_users/{project_users_pk}", dependencies=[Depends(require_admin)])
async def borrar_project_user(project_users_pk: int, db: Session = Depends(get_db)):
    project_user_actual = db.query(ProjectUsers).filter(
        ProjectUsers.project_users_pk == project_users_pk
    ).first() 

    if not project_user_actual:
        raise HTTPException(status_code=404, detail="Project User no encontrado")

    project_user_actual.is_active = False
    db.commit()
    
    return {"mensaje": f"Project User con ID {project_users_pk} desactivado correctamente"}