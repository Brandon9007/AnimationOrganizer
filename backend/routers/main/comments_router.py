from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional
from datetime import date

from model.comments import Comments
from sqlalchemy.orm import Session
from database.database import SessionLocal

router = APIRouter()

class CommentsClass(BaseModel):
    comments_pk: Optional[int] = None
    comments_description: str
    comments_created_at: Optional[date] = None
    comments_updated_at: Optional[date] = None
    created_by: str
    tasks_fk: int
    is_active: bool = True

# Conexión a la base de datos
async def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# GET todos los comentarios
@router.get("/comments")
async def obtener_comments(db: Session = Depends(get_db)):
    comments = db.query(Comments).filter(Comments.is_active == True).all()
    return {
        "mensaje": "Conexión a la base de datos exitosa",
        "total_part": len(comments),
        "data": comments
    }

# GET comentarios de una tarea específica (el que llama React)
@router.get("/tasks/{task_id}/comments")
async def obtener_comments_por_tarea(task_id: int, db: Session = Depends(get_db)):
    comments = db.query(Comments).filter(
        Comments.tasks_fk == task_id,
        Comments.is_active == True
    ).all()
    return {"data": comments}

# POST
@router.post("/comments")
def create_comment(
    comment_data: CommentsClass,
    db: Session = Depends(get_db)
):
    today = date.today()
    new_comment = Comments(
        comments_description=comment_data.comments_description,
        comments_created_at=comment_data.comments_created_at or today,
        comments_updated_at=comment_data.comments_updated_at or today,
        created_by=comment_data.created_by,
        tasks_fk=comment_data.tasks_fk,
        is_active=comment_data.is_active
    )

    db.add(new_comment)
    db.commit()
    db.refresh(new_comment)

    return {
        "message": "Comment created successfully",
        "data": new_comment
    }

# POST BULK
@router.post("/comments/bulk")
def create_comments_bulk(
    comments_list: List[CommentsClass],
    db: Session = Depends(get_db)
):
    today = date.today()
    comments_to_insert = [
        Comments(
            comments_description=item.comments_description,
            comments_created_at=item.comments_created_at or today,
            comments_updated_at=item.comments_updated_at or today,
            created_by=item.created_by,
            tasks_fk=item.tasks_fk,
            is_active=item.is_active
        )
        for item in comments_list
    ]

    db.add_all(comments_to_insert)
    db.commit()

    return {"message": f"{len(comments_to_insert)} comments inserted"}

# PUT
@router.put("/comments/{comment_id}")
def update_comment(
    comment_id: int,
    comment_data: CommentsClass,
    db: Session = Depends(get_db)
):
    comment_actual = db.query(Comments).filter(
        Comments.comments_pk == comment_id
    ).first()

    if not comment_actual:
        raise HTTPException(status_code=404, detail="Comment not found")

    comment_actual.comments_description = comment_data.comments_description
    comment_actual.comments_updated_at = comment_data.comments_updated_at or date.today()
    comment_actual.created_by = comment_data.created_by
    comment_actual.tasks_fk = comment_data.tasks_fk
    comment_actual.is_active = comment_data.is_active

    db.commit()
    db.refresh(comment_actual)

    return {"message": "Comment updated", "data": comment_actual}

# DELETE
@router.delete("/comments/{comments_pk}")
async def borrar_comment(comments_pk: int, db: Session = Depends(get_db)):
    comment_actual = db.query(Comments).filter(
        Comments.comments_pk == comments_pk
    ).first()

    if not comment_actual:
        raise HTTPException(status_code=404, detail="Comment no encontrado")

    comment_actual.is_active = False
    db.commit()

    return {"mensaje": f"Comment con ID {comments_pk} desactivado correctamente"}