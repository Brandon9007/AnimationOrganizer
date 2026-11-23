import json
from contextlib import ExitStack
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest import TestCase
from unittest.mock import patch

import jwt
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, update
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from database.database import Base
from main import PublicUploads, app
from model.files_tasks import FilesTasks
from model.files_tasks_groups import FilesTasksGroups
from model.groups_tasks import GroupTasks
from model.groups_tasks_views import GroupsTasksViews
from model.project import Project
from model.proyectusers import ProjectUsers
from model.proyectviews import ProjectViews
from model.rol import Role
from model.tasks import Tasks
from model.user import User
from model.views import Views
from routers import assets
from routers.authentication import jwt_auth_users as auth
from routers.main import (
    comments_router,
    files_tasks_groups_router,
    files_tasks_router,
    group_tasks_router,
    group_tasks_views_router,
    project_router,
    rol_router,
    tasks_router,
    user_router,
    views_router,
)


class TaskAssetsTest(TestCase):
    path = "/api/projects/1/tasks/10/assets"
    secret = "task-assets-test-key-for-testing-only"

    def setUp(self):
        resources = ExitStack()
        self.addCleanup(resources.close)
        folder = Path(resources.enter_context(TemporaryDirectory()))
        root = folder / "assets"
        root.mkdir()
        (root / "image.png").write_bytes(b"test image bytes")
        (root / "reference.pdf").write_bytes(b"%PDF-1.4 test")
        (root / "archive.zip").write_bytes(b"test archive bytes")
        (root / "unsafe.pdf").write_bytes(b"<html>not a PDF</html>")
        (folder / "private.png").write_bytes(b"outside storage")

        engine = create_engine(
            "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
        )
        resources.callback(engine.dispose)
        Base.metadata.create_all(engine)
        self.sessions = sessionmaker(bind=engine)
        self.seed()

        def test_db():
            with self.sessions() as db:
                yield db

        resources.enter_context(patch.object(assets, "ASSETS_DIR", root))
        resources.enter_context(patch.object(auth, "SECRET", self.secret))
        overrides = {
            router.get_db: test_db for router in (
                auth, comments_router, files_tasks_groups_router, files_tasks_router, group_tasks_router,
                group_tasks_views_router, project_router, rol_router, tasks_router,
                user_router, views_router,
            )
        }
        resources.enter_context(patch.dict(app.dependency_overrides, overrides))
        self.client = resources.enter_context(TestClient(app))

        # Also check the project router and the role router's duplicate /users paths.
        additional_routes = FastAPI()
        additional_routes.include_router(project_router.router)
        additional_routes.include_router(rol_router.router)
        additional_routes.dependency_overrides.update(overrides)
        self.additional_client = resources.enter_context(TestClient(additional_routes))

    def seed(self):
        with self.sessions.begin() as db:
            db.add_all([
                Role(role_pk=1, role_name="worker"),
                Role(role_pk=2, role_name="Administrador"),
                Role(role_pk=3, role_name="admin", is_active=False),
            ])
            for user_id, name, role_id in [
                (1, "worker", 1), (2, "other", 1), (3, "manager", 2), (4, "inactive-role", 3),
            ]:
                db.add(User(
                    user_pk=user_id, user_name=name, user_email=f"{name}@example.test",
                    user_password="unused", user_created_at=date(2026, 1, 1),
                    role_pk=role_id, is_active=True,
                ))
            for project_id, task_id, user_id in [(1, 10, 1), (2, 20, 2), (3, 30, 1)]:
                db.add_all([
                    Project(project_pk=project_id, project_name=f"Project {project_id}"),
                    ProjectUsers(project_fk=project_id, user_fk=user_id),
                    ProjectViews(project_fk=project_id, view_fk=project_id),
                    Views(views_pk=project_id, views_name=f"View {project_id}"),
                    GroupsTasksViews(views_pk=project_id, task_pk=task_id),
                    Tasks(tasks_pk=task_id, task_name=f"Task {task_id}"),
                ])
                if task_id != 30:
                    db.add(GroupTasks(task_pk=task_id, user_pk=user_id))

            for asset_id, task_id, name, link in [
                (100, 10, "Diseño.png", "image.png"),
                (101, 20, "another-task.png", "image.png"),
                (102, 10, "reference.pdf", "reference.pdf"),
                (103, 10, "archive.zip", "archive.zip"),
                (104, 10, "missing.png", "missing.png"),
                (105, 10, "outside.png", "../private.png"),
                (106, 10, "unsafe.pdf", "unsafe.pdf"),
            ]:
                db.add(FilesTasks(files_tasks_pk=asset_id, files_tasks_name=name, link=link))
                db.add(FilesTasksGroups(task_pk=task_id, file_task_pk=asset_id))

    def token(self, *, expiry_minutes=30, expires=True, signing_key=None, user="worker"):
        payload = {"sub": user}
        if expires:
            payload["exp"] = datetime.now(timezone.utc) + timedelta(minutes=expiry_minutes)
        return jwt.encode(payload, signing_key or self.secret, algorithm=auth.ALGORITMO)

    def get(self, path, **headers):
        return self.client.get(path, headers={"Authorization": f"Bearer {self.token()}", **headers})

    def test_each_endpoint_requires_an_unexpired_signed_token(self):
        for path in ("/api/me/task-asset-contexts", self.path, self.path + "/100/preview", self.path + "/100/download"):
            with self.subTest(path=path):
                self.assertEqual(self.client.get(path).status_code, 401)
                for token in ("invalid", self.token(expiry_minutes=-1), self.token(expires=False),
                              self.token(signing_key="a-different-signing-key-of-good-length")):
                    self.assertEqual(self.client.get(path, headers={"Authorization": f"Bearer {token}"}).status_code, 401)

    def test_lists_only_assigned_tasks_and_linked_private_files(self):
        contexts = self.get("/api/me/task-asset-contexts")
        self.assertEqual(contexts.status_code, 200)
        self.assertEqual([(task["project_pk"], task["tasks_pk"]) for task in contexts.json()["tasks"]], [(1, 10)])
        response = self.get(self.path)
        self.assertEqual(response.status_code, 200)
        self.assertEqual([file["id"] for file in response.json()["assets"]], [100, 102, 103, 106])
        self.assertNotIn("image.png", json.dumps(response.json()))
        self.assertEqual(response.headers["cache-control"], "private, no-store")

    def test_rejects_other_projects_unassigned_tasks_and_unlinked_files(self):
        for suffix in ("", "/100/preview", "/100/download"):
            with self.subTest(suffix=suffix):
                self.assertEqual(self.get("/api/projects/2/tasks/20/assets" + suffix).status_code, 403)
                self.assertEqual(self.get("/api/projects/1/tasks/20/assets" + suffix).status_code, 404)
                self.assertEqual(self.get("/api/projects/3/tasks/30/assets" + suffix).status_code, 404)
        for asset_id in (101, 104, 105, 999):
            for action in ("download", "preview"):
                with self.subTest(asset_id=asset_id, action=action):
                    self.assertEqual(self.get(f"{self.path}/{asset_id}/{action}").status_code, 404)

    def test_revoking_project_membership_or_view_removes_access(self):
        with self.sessions.begin() as db:
            db.execute(update(ProjectViews).where(ProjectViews.project_fk == 1).values(is_active=False))
        self.assertEqual(self.get(self.path).status_code, 404)
        with self.sessions.begin() as db:
            db.execute(update(ProjectUsers).where(ProjectUsers.project_fk == 1).values(is_active=False))
        self.assertEqual(self.get(self.path).status_code, 403)

    def test_public_uploads_exclude_private_assets(self):
        uploads_dir = assets.ASSETS_DIR.parent
        uploads_app = FastAPI()
        uploads_app.mount("/uploads", PublicUploads(directory=uploads_dir))
        with TestClient(uploads_app) as client:
            self.assertEqual(client.get("/uploads/private.png").status_code, 200)
            self.assertEqual(client.get("/uploads/assets/image.png").status_code, 404)

    def test_pipeline_rename_and_task_chat_preserve_asset_access(self):
        password = "temporary-test-password"
        with self.sessions.begin() as db:
            db.execute(update(User).where(User.user_name == "manager").values(
                user_password=auth.crypt.hash(password)
            ))
        login = self.client.post("/login", data={"username": "manager", "password": password})
        self.assertEqual(login.status_code, 200, login.text)
        self.assertEqual(login.json()["role"], "admin")
        admin_headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
        renamed = self.client.put("/views/1", headers=admin_headers, json={
            "views_pk": 1, "views_name": "Storyboard", "views_order": 1, "is_active": True,
        })
        self.assertEqual(renamed.status_code, 200, renamed.text)
        comment = self.client.post("/comments", headers=admin_headers, json={
            "comments_description": "Revisar la escena", "created_by": "manager", "tasks_fk": 10,
        })
        self.assertEqual(comment.status_code, 200, comment.text)
        comments = self.get("/tasks/10/comments")
        self.assertEqual(comments.json()["data"][0]["comments_description"], "Revisar la escena")
        contexts = self.get("/api/me/task-asset-contexts")
        self.assertEqual(contexts.json()["tasks"][0]["views_name"], "Storyboard")
        self.assertEqual(self.get(self.path + "/100/download").status_code, 200)

    def test_ownership_and_asset_records_can_only_be_modified_by_admins(self):
        registered = (
            "users", "views", "tasks", "groups_tasks_views",
            "groups_tasks", "files_tasks", "files_tasks_groups", "project_users", "project_views",
        )
        for client, resources in (
            (self.client, registered),
            (self.additional_client, ("projects", "users")),
        ):
            for resource in resources:
                for method, path in (
                    ("POST", f"/{resource}"),
                    ("POST", f"/{resource}/bulk"),
                    ("PUT", f"/{resource}/1"),
                    ("DELETE", f"/{resource}/1"),
                ):
                    with self.subTest(method=method, path=path):
                        self.assertEqual(client.request(method, path, json={}).status_code, 401)
                        self.assertEqual(client.request(
                            method, path, json={}, headers={"Authorization": f"Bearer {self.token()}"}
                        ).status_code, 403)

    def test_admin_can_link_assets_and_worker_gets_access_only_after_link(self):
        path = self.path + "/101/download"
        self.assertEqual(self.get(path).status_code, 404)
        payload = {
            "files_tasks_groups_pk": 999,
            "files_tasks_groups_name": "approved-link",
            "is_active": True,
            "task_pk": 10,
            "file_tasks": 101,
        }
        inactive = self.client.post(
            "/files_tasks_groups", json=payload,
            headers={"Authorization": f"Bearer {self.token(user='inactive-role')}"},
        )
        self.assertEqual(inactive.status_code, 403)
        self.assertEqual(self.get(path).status_code, 404)
        admin = self.client.post(
            "/files_tasks_groups", json=payload,
            headers={"Authorization": f"Bearer {self.token(user='manager')}"},
        )
        self.assertEqual(admin.status_code, 200, admin.text)
        self.assertEqual(self.get(path).status_code, 200)
        self.assertEqual(self.get("/api/projects/2/tasks/20/assets/101/download").status_code, 403)

    def test_serves_preview_and_download_with_distinct_headers(self):
        preview = self.get(self.path + "/100/preview", Range="bytes=0-3")
        self.assertEqual(preview.status_code, 206)
        self.assertEqual(preview.content, b"test")
        self.assertEqual(preview.headers["content-type"], "image/png")
        self.assertIn("inline", preview.headers["content-disposition"])
        self.assertEqual(preview.headers["x-content-type-options"], "nosniff")

        pdf = self.get(self.path + "/102/preview")
        self.assertEqual(pdf.status_code, 200)
        self.assertEqual(pdf.headers["content-type"], "application/pdf")
        self.assertEqual(self.get(self.path + "/103/preview").status_code, 415)
        self.assertEqual(self.get(self.path + "/106/preview").status_code, 415)

        download = self.get(self.path + "/100/download")
        self.assertEqual(download.status_code, 200)
        self.assertEqual(download.content, b"test image bytes")
        self.assertEqual(download.headers["content-type"], "application/octet-stream")
        self.assertIn("attachment", download.headers["content-disposition"])
        self.assertIn("Dise%C3%B1o.png", download.headers["content-disposition"])
