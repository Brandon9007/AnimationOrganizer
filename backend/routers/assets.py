from dataclasses import dataclass
from os import getenv
from pathlib import Path, PureWindowsPath
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from model.files_tasks import FilesTasks
from model.files_tasks_groups import FilesTasksGroups
from model.groups_tasks import GroupTasks
from model.groups_tasks_views import GroupsTasksViews
from model.project import Project
from model.proyectusers import ProjectUsers
from model.proyectviews import ProjectViews
from model.tasks import Tasks
from model.views import Views
from routers.authentication.jwt_auth_users import User, current_user, get_db


router = APIRouter(prefix="/api", tags=["Assets de tareas"])
DEFAULT_ASSETS_DIR = Path(__file__).resolve().parents[1] / "uploads" / "assets"
ASSETS_DIR = Path(getenv("ANIMATIONORGANIZER_ASSETS_DIR") or DEFAULT_ASSETS_DIR)
TASK_ASSETS = "/projects/{proyecto_id}/tasks/{tarea_id}/assets"
PRIVATE_HEADERS = {
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
}
PREVIEW_TYPES = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".pdf": "application/pdf",
    ".mp4": "video/mp4",
    ".mp3": "audio/mpeg",
}


Database = Annotated[Session, Depends(get_db)]
Worker = Annotated[User, Depends(current_user)]


def worker_projects(db: Session, user: User):
    return (
        select(Project.project_pk, Project.project_name)
        .join(ProjectUsers, ProjectUsers.project_fk == Project.project_pk)
        .where(
            Project.is_active.is_(True),
            ProjectUsers.is_active.is_(True),
            ProjectUsers.user_fk == user.users_pk,
        )
        .subquery()
    )


def assigned_tasks(projects, user: User):
    return (
        select(
            projects.c.project_pk,
            projects.c.project_name,
            Views.views_pk,
            Views.views_name,
            Tasks.tasks_pk,
            Tasks.task_name,
        )
        .select_from(projects)
        .join(ProjectViews, ProjectViews.project_fk == projects.c.project_pk)
        .join(Views, Views.views_pk == ProjectViews.view_fk)
        .join(GroupsTasksViews, GroupsTasksViews.views_pk == Views.views_pk)
        .join(Tasks, Tasks.tasks_pk == GroupsTasksViews.task_pk)
        .join(GroupTasks, GroupTasks.task_pk == Tasks.tasks_pk)
        .where(
            ProjectViews.is_active.is_(True),
            Views.is_active.is_(True),
            GroupsTasksViews.is_active.is_(True),
            Tasks.is_active.is_(True),
            GroupTasks.is_active.is_(True),
            GroupTasks.user_pk == user.users_pk,
        )
        .distinct()
    )


@router.get("/me/task-asset-contexts")
def task_asset_contexts(db: Database, user: Worker, response: Response):
    projects = worker_projects(db, user)
    query = assigned_tasks(projects, user).order_by(projects.c.project_pk, Views.views_pk, Tasks.tasks_pk)
    response.headers.update(PRIVATE_HEADERS)
    return {"tasks": [dict(row) for row in db.execute(query).mappings()]}


@dataclass(frozen=True)
class TaskAccess:
    db: Session
    task_id: int

    def files(self):
        return (
            select(FilesTasks.files_tasks_pk, FilesTasks.files_tasks_name, FilesTasks.link)
            .join(FilesTasksGroups, FilesTasksGroups.file_task_pk == FilesTasks.files_tasks_pk)
            .where(
                FilesTasksGroups.task_pk == self.task_id,
                FilesTasksGroups.is_active.is_(True),
                FilesTasks.is_active.is_(True),
            )
            .distinct()
        )


def task_access(proyecto_id: int, tarea_id: int, db: Database, user: Worker):
    projects = worker_projects(db, user)
    if db.scalar(select(projects.c.project_pk).where(projects.c.project_pk == proyecto_id)) is None:
        raise HTTPException(status_code=403, detail="No tienes acceso a este proyecto.")

    task = assigned_tasks(projects, user).where(
        projects.c.project_pk == proyecto_id, Tasks.tasks_pk == tarea_id
    )
    if db.execute(task).first() is None:
        raise HTTPException(status_code=404, detail="Tarea no disponible.")
    return TaskAccess(db, tarea_id)


AuthorizedTask = Annotated[TaskAccess, Depends(task_access)]


def stored_path(link: str | None):
    if not link:
        return None
    relative = PureWindowsPath(link)
    if relative.drive or relative.root or ".." in relative.parts or ":" in link:
        return None

    try:
        root = ASSETS_DIR.resolve()
        path = root.joinpath(*relative.parts).resolve()
        return path if path.is_relative_to(root) and path.is_file() else None
    except (OSError, RuntimeError, ValueError):
        return None


def file_name(name: str | None, path: Path):
    return PureWindowsPath(name or "").name or path.name


@router.get(TASK_ASSETS)
def listar_assets(access: AuthorizedTask, response: Response):
    assets = []
    for asset_id, name, link in access.db.execute(access.files().order_by(FilesTasks.files_tasks_pk)):
        path = stored_path(link)
        if path is not None:
            assets.append({
                "id": asset_id,
                "name": file_name(name, path),
                "mime_type": PREVIEW_TYPES.get(path.suffix.lower()),
            })

    response.headers.update(PRIVATE_HEADERS)
    return {"assets": assets}


def find_file(access: TaskAccess, asset_id: int):
    asset = access.db.execute(access.files().where(FilesTasks.files_tasks_pk == asset_id)).first()
    path = stored_path(asset.link) if asset else None
    if path is None:
        raise HTTPException(status_code=404, detail="Archivo no disponible.")
    return asset, path


@router.get(TASK_ASSETS + "/{asset_id}/preview")
def visualizar_asset(asset_id: int, access: AuthorizedTask):
    asset, path = find_file(access, asset_id)
    media_type = PREVIEW_TYPES.get(path.suffix.lower())
    if media_type is None:
        raise HTTPException(status_code=415, detail="El archivo solo está disponible para descargar.")

    if media_type == "application/pdf":
        try:
            with path.open("rb") as pdf:
                valid_pdf = pdf.read(5) == b"%PDF-"
        except OSError as exc:
            raise HTTPException(status_code=404, detail="Archivo no disponible.") from exc
        if not valid_pdf:
            raise HTTPException(status_code=415, detail="El archivo solo está disponible para descargar.")

    return FileResponse(
        path, media_type=media_type, filename=file_name(asset.files_tasks_name, path),
        content_disposition_type="inline", headers=PRIVATE_HEADERS,
    )


@router.get(TASK_ASSETS + "/{asset_id}/download")
def descargar_asset(asset_id: int, access: AuthorizedTask):
    asset, path = find_file(access, asset_id)
    return FileResponse(
        path, media_type="application/octet-stream", filename=file_name(asset.files_tasks_name, path),
        headers=PRIVATE_HEADERS,
    )
