from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional
from datetime import date

from model.user import User
from sqlalchemy.orm import Session
from database.database import SessionLocal

from routers.authentication.jwt_auth_users import require_admin, crypt

router = APIRouter()

class UserCreate(BaseModel):
    user_name: str
    user_email: str
    user_password: str
    user_status: str = "Activo"
    user_created_at: Optional[date] = None
    user_updated_at: Optional[date] = None
    is_active: bool = True
    role_pk: int = 2  

class UserUpdate(BaseModel):
    user_name: str
    user_email: str
    user_status: str = "Activo"
    user_updated_at: Optional[date] = None
    is_active: bool = True
    role_pk: int

async def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# GET 
@router.get("/users", dependencies=[Depends(require_admin)])
async def obtener_users(db: Session = Depends(get_db)):
    users = db.query(User).all()
    data = [
        {
            "user_pk": u.user_pk,
            "user_name": u.user_name,
            "user_email": u.user_email,
            "user_status": u.user_status,
            "user_created_at": u.user_created_at,
            "user_updated_at": u.user_updated_at,
            "is_active": u.is_active,
            "role_pk": u.role_pk,
        }
        for u in users
    ]
    return {
        "mensaje": "Conexión a la base de datos exitosa",
        "total_part": len(data),
        "data": data
    }

# POST 
@router.post("/users", dependencies=[Depends(require_admin)])
def create_user(user_data: UserCreate, db: Session = Depends(get_db)):
    if db.query(User).filter(User.user_email == user_data.user_email).first():
        raise HTTPException(status_code=400, detail="El correo electrónico ya está registrado")

    if db.query(User).filter(User.user_name == user_data.user_name).first():
        raise HTTPException(status_code=400, detail="El nombre de usuario ya está en uso")

    if user_data.role_pk not in (1, 2):
        raise HTTPException(status_code=400, detail="Rol inválido (debe ser 1 para Admin o 2 para User)")

    today = date.today()
    new_user = User(
        user_name=user_data.user_name.strip(),
        user_password=crypt.hash(user_data.user_password),
        user_email=user_data.user_email.strip(),
        user_status=user_data.user_status,
        user_created_at=user_data.user_created_at or today,
        user_updated_at=user_data.user_updated_at or today,
        is_active=user_data.is_active,
        role_pk=user_data.role_pk
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return {
        "message": "Usuario creado correctamente",
        "data": {
            "user_pk": new_user.user_pk,
            "user_name": new_user.user_name,
            "user_email": new_user.user_email,
            "user_status": new_user.user_status,
            "is_active": new_user.is_active,
            "role_pk": new_user.role_pk,
        }
    }

# PUT 
@router.put("/users/{user_id}", dependencies=[Depends(require_admin)])
def update_user(user_id: int, user_data: UserUpdate, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.user_pk == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    user.user_name = user_data.user_name.strip()
    user.user_email = user_data.user_email.strip()
    if user_data.user_password and user_data.user_password.strip():
        user.user_password = crypt.hash(user_data.user_password)
    user.user_status = user_data.user_status
    user.user_updated_at = user_data.user_updated_at or date.today()
    user.is_active = user_data.is_active
    user.role_pk = user_data.role_pk

    db.commit()
    db.refresh(user)

    return {"message": "Usuario actualizado", "data": user}

# DELETE Admin
@router.delete("/users/{user_pk}", dependencies=[Depends(require_admin)])
async def borrar_user(user_pk: int, db: Session = Depends(get_db)):
    user_actual = db.query(User).filter(User.user_pk == user_pk).first()
    if not user_actual:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    user_actual.is_active = False
    user_actual.user_status = "Inactivo"
    db.commit()

    return {"mensaje": f"Usuario con ID {user_pk} desactivado correctamente"}