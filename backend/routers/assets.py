from dataclasses import dataclass
from os import getenv
from pathlib import Path, PureWindowsPath
from typing import Annotated
import urllib.request

from fastapi import APIRouter, Depends, HTTPException, Response
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from model.groups_tasks import GroupTasks
from model.groups_tasks_views import GroupsTasksViews
from model.project import Project
from model.proyectusers import ProjectUsers
from model.proyectviews import ProjectViews
from model.repository import Repository
from model.repository_groups import RepositoryGroups
from model.tasks import Tasks
from model.views import Views
from routers.authentication.jwt_auth_users import User, current_user, get_db


router = APIRouter(prefix="/api", tags=["Assets de tareas"])
BACKEND_DIR = Path(__file__).resolve().parents[1]
DEFAULT_UPLOADS_DIR = BACKEND_DIR / "uploads"
UPLOADS_DIR = Path(getenv("ANIMATIONORGANIZER_ASSETS_DIR") or DEFAULT_UPLOADS_DIR)
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
    ".gif": "image/gif",
    ".pdf": "application/pdf",
    ".mp4": "video/mp4",
    ".webm": "video/webm",
    ".mov": "video/quicktime",
    ".mp3": "audio/mpeg",
    ".wav": "audio/wav",
    ".ogg": "audio/ogg",
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
    query = assigned_tasks(projects, user).order_by(
        projects.c.project_pk, Views.views_pk, Tasks.tasks_pk
    )
    response.headers.update(PRIVATE_HEADERS)
    return {"tasks": [dict(row) for row in db.execute(query).mappings()]}


@dataclass(frozen=True)
class TaskAccess:
    db: Session
    project_id: int
    task_id: int

    def files(self):
        return (
            select(Repository.repository_pk, Repository.file_name, Repository.link)
            .join(RepositoryGroups, RepositoryGroups.repository_fk == Repository.repository_pk)
            .where(
                RepositoryGroups.tasks_fk == self.task_id,
                RepositoryGroups.is_active.is_(True),
                Repository.is_active.is_(True),
                or_(Repository.project_fk == self.project_id, Repository.project_fk.is_(None)),
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
    return TaskAccess(db, proyecto_id, tarea_id)


AuthorizedTask = Annotated[TaskAccess, Depends(task_access)]


def is_remote_url(link: str | None) -> bool:
    return bool(link and link.startswith(("http://", "https://")))


def stored_path(link: str | None):
    if not link or is_remote_url(link):
        return None
    relative = PureWindowsPath(link)
    if relative.drive or relative.root or ".." in relative.parts or ":" in link:
        return None

    try:
        uploads_root = UPLOADS_DIR.resolve()
        path = BACKEND_DIR.joinpath(*relative.parts).resolve()
        return path if path.is_relative_to(uploads_root) and path.is_file() else None
    except (OSError, RuntimeError, ValueError):
        return None


def resolve_display_name(name: str | None, link: str) -> str:
    clean_name = PureWindowsPath(name or "").name
    if clean_name:
        return clean_name
    return PureWindowsPath(link.split("?")[0]).name


def resolve_mime_type(display_name: str, link: str):
    ext = PureWindowsPath(display_name).suffix.lower() or PureWindowsPath(link.split("?")[0]).suffix.lower()
    return PREVIEW_TYPES.get(ext)


@router.get(TASK_ASSETS)
def listar_assets(access: AuthorizedTask, response: Response):
    assets = []
    for asset_id, name, link in access.db.execute(access.files().order_by(Repository.repository_pk)):
        if not link:
            continue
        if is_remote_url(link) or stored_path(link) is not None:
            display_name = resolve_display_name(name, link)
            assets.append({
                "id": asset_id,
                "name": display_name,
                "mime_type": resolve_mime_type(display_name, link),
            })

    response.headers.update(PRIVATE_HEADERS)
    return {"assets": assets}


def find_file(access: TaskAccess, asset_id: int):
    asset = access.db.execute(access.files().where(Repository.repository_pk == asset_id)).first()
    if not asset or not asset.link:
        raise HTTPException(status_code=404, detail="Archivo no disponible.")

    if is_remote_url(asset.link):
        return asset, None

    path = stored_path(asset.link)
    if path is None:
        raise HTTPException(status_code=404, detail="Archivo no disponible.")
    return asset, path


@router.get(TASK_ASSETS + "/{asset_id}/preview")
def visualizar_asset(asset_id: int, access: AuthorizedTask):
    asset, path = find_file(access, asset_id)
    display_name = resolve_display_name(asset.file_name, asset.link)
    media_type = resolve_mime_type(display_name, asset.link)
    if media_type is None:
        raise HTTPException(status_code=415, detail="El archivo solo está disponible para descargar.")

    if is_remote_url(asset.link):
        remote = urllib.request.urlopen(asset.link)
        return StreamingResponse(remote, media_type=media_type, headers=PRIVATE_HEADERS)

    if media_type == "application/pdf":
        try:
            with path.open("rb") as pdf:
                valid_pdf = pdf.read(5) == b"%PDF-"
        except OSError as exc:
            raise HTTPException(status_code=404, detail="Archivo no disponible.") from exc
        if not valid_pdf:
            raise HTTPException(status_code=415, detail="El archivo solo está disponible para descargar.")

    return FileResponse(
        path,
        media_type=media_type,
        filename=display_name,
        content_disposition_type="inline",
        headers=PRIVATE_HEADERS,
    )


@router.get(TASK_ASSETS + "/{asset_id}/download")
def descargar_asset(asset_id: int, access: AuthorizedTask):
    asset, path = find_file(access, asset_id)
    display_name = resolve_display_name(asset.file_name, asset.link)

    if is_remote_url(asset.link):
        remote = urllib.request.urlopen(asset.link)
        return StreamingResponse(
            remote,
            media_type="application/octet-stream",
            headers={
                **PRIVATE_HEADERS,
                "Content-Disposition": f'attachment; filename="{display_name}"',
            },
        )

    return FileResponse(
        path,
        media_type="application/octet-stream",
        filename=display_name,
        headers=PRIVATE_HEADERS,
    )