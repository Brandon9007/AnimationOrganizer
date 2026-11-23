from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional
from model.proyectviews import ProjectViews

from sqlalchemy.orm import Session
from database.database import SessionLocal, engine

from routers.authentication.jwt_auth_users import require_admin

router = APIRouter()

class ProjectViewsClass(BaseModel):
    project_views_pk: Optional[int] = None
    is_active: bool = True
    project_fk: int
    view_fk: int
    
# Conexion a la base de datos 
async def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Endpointsa
# GET
@router.get("/project_views")
async def obtener_project_views(db: Session = Depends(get_db)):
    project_views = db.query(ProjectViews).all()

    return {
        "mensaje": "Conexión a la base de datos exitosa", 
        "total_part": len(project_views),
        "data": project_views
    }

@router.post("/project_views", dependencies=[Depends(require_admin)])
def create_project_view(
    project_view_data: ProjectViewsClass,
    db: Session = Depends(get_db)
):
    existing_view_link = db.query(ProjectViews).filter(
        ProjectViews.view_fk == project_view_data.view_fk,
        ProjectViews.is_active == True
    ).first()

    if existing_view_link:
        raise HTTPException(
            status_code=400,
            detail="Esta vista ya pertenece a otro proyecto"
        )

    new_project_view = ProjectViews(
        is_active=project_view_data.is_active,
        project_fk=project_view_data.project_fk,
        view_fk=project_view_data.view_fk
    )

    db.add(new_project_view)
    db.commit()
    db.refresh(new_project_view)

    return {
        "message": "Project View created successfully",
        "data": new_project_view
    }

# PUT
@router.put("/project_views/{project_view_id}", dependencies=[Depends(require_admin)])
def update_project_view(
    project_view_id: int,
    project_view_data: ProjectViewsClass,
    db: Session = Depends(get_db)
):
    project_view_actual = db.query(ProjectViews).filter(
        ProjectViews.project_views_pk == project_view_id
    ).first()

    if not project_view_actual:
        raise HTTPException(
            status_code=404,
            detail="Project View not found"
        )

    project_view_actual.is_active = project_view_data.is_active
    project_view_actual.project_fk = project_view_data.project_fk
    project_view_actual.view_fk = project_view_data.view_fk

    db.commit()
    db.refresh(project_view_actual)

    return {
        "message": "Project View updated",
        "data": project_view_actual
    }

# DELETE
@router.delete("/project_views/{project_views_pk}", dependencies=[Depends(require_admin)])
async def borrar_project_view(project_views_pk: int, db: Session = Depends(get_db)):
    project_view_actual = db.query(ProjectViews).filter(
        ProjectViews.project_views_pk == project_views_pk
    ).first() 

    if not project_view_actual:
        raise HTTPException(status_code=404, detail="Project View no encontrado")

    project_view_actual.is_active = False
    db.commit()
    
    return {"mensaje": f"Project View con ID {project_views_pk} desactivado correctamente"}