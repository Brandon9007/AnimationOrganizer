# Contexto y Reglas del Proyecto

## Stack Tecnológico
- Backend: Python / FastAPI / SQLAlchemy
- Frontend: React / JavaScript / Material-UI / Tailwind CSS
- Base de datos: SQLite

## Convenciones de Código
- Mantener nombres de variables, funciones y archivos consistentes con el código existente.
- Agregar tipado estricto y manejo limpio de errores sin eliminar lógica de negocio existente.
- Se permite modificar rutas, endpoints, modelos o esquemas de base de datos cuando sea necesario para cumplir tareas solicitadas explícitamente en el prompt, documentando cualquier cambio de esquema o contrato en `NIGHT_REPORT.md`.

## Restricciones
- NO leer ni modificar archivos `.env`, credenciales o llaves privadas.
- NO instalar librerías o paquetes nuevos por tu cuenta.
- Mantener los cambios acotados a los archivos necesarios para las tareas solicitadas.

## Git y Rama de Trabajo
- Trabaja únicamente en la rama `chore/gemini-night-polish` hacia el remoto `origin` (NO toques ni hagas push a `crono`, `peque`, `repo`, `main` ni `integracion-final`).
- Al terminar todas las tareas y validaciones, haz `git add -A`, `git commit` y `git push origin chore/gemini-night-polish`.
- Si `git push` falla por autenticación, red o cualquier motivo, no reintentes en bucle: regístralo en `NIGHT_REPORT.md`.

## Flujo de Validación
- Después de hacer cambios, ejecuta las pruebas o compilaciones disponibles (por ejemplo `pytest` en backend y `npm run build` en frontend) para verificar que no se rompió nada.
- Si encuentras un error o bloqueo que no puedas resolver sin cambiar la arquitectura, déjalo documentado en `NIGHT_REPORT.md` en lugar de forzar una solución.