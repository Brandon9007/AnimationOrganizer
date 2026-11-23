import React from 'react';
import { createRoot } from 'react-dom/client';
import { act as legacyAct } from 'react-dom/test-utils';
import Pipeline from './Pipeline';

const act = React.act || legacyAct;
const assetPath = '/api/projects/7/tasks/12/assets';
const files = [
  { id: 1, name: 'Escena.png', mime_type: 'image/png' },
  { id: 2, name: 'Referencias.pdf', mime_type: 'application/pdf' },
  { id: 3, name: 'Animación.mp4', mime_type: 'video/mp4' },
  { id: 4, name: 'Sonido.mp3', mime_type: 'audio/mpeg' },
  { id: 5, name: 'Proyecto.zip', mime_type: null },
];

function json(data) {
  return { ok: true, json: async () => data };
}

let container;
let root;
let originalFetch;
let originalCreateObjectURL;
let originalRevokeObjectURL;
let anchorClick;

beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  jest.useFakeTimers();
  originalFetch = global.fetch;
  originalCreateObjectURL = URL.createObjectURL;
  originalRevokeObjectURL = URL.revokeObjectURL;
  URL.createObjectURL = jest.fn(() => 'blob:test-asset');
  URL.revokeObjectURL = jest.fn();
  localStorage.setItem('fastapi_token', 'fixture-token');
  localStorage.setItem('user_role', 'admin');

  const dialog = window.HTMLDialogElement.prototype;
  dialog.showModal = function () { this.setAttribute('open', ''); };
  dialog.close = function () { this.dispatchEvent(new Event('close')); };

  anchorClick = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  global.fetch = jest.fn(async (url) => {
    const path = new URL(url).pathname;
    if (path === '/views') return { ok: false, status: 500 };
    if (path === '/tasks') return { ok: false, status: 500 };
    if (path === '/api/me/task-asset-contexts') {
      return json({ tasks: [{
        project_pk: 7, views_pk: 8, views_name: 'Storyboard',
        tasks_pk: 12, task_name: 'Escena asignada',
      }, {
        project_pk: 7, views_pk: 8, views_name: 'Storyboard',
        tasks_pk: 13, task_name: 'Otra tarea',
      }] });
    }
    if (path === assetPath) return json({ assets: files });
    if (path === '/api/projects/7/tasks/13/assets') return json({ assets: [] });

    const file = files.find(asset => path.startsWith(`${assetPath}/${asset.id}/`));
    if (file) {
      return {
        ok: true, blob: async () => new Blob(['fixture'], {
          type: path.endsWith('/preview') ? file.mime_type : 'application/octet-stream',
        }),
      };
    }
    throw new Error(`Unexpected request: ${path}`);
  });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
  jest.restoreAllMocks();
  container.remove();
  localStorage.removeItem('fastapi_token');
  localStorage.removeItem('user_role');
  delete window.HTMLDialogElement.prototype.showModal;
  delete window.HTMLDialogElement.prototype.close;
  URL.createObjectURL = originalCreateObjectURL;
  URL.revokeObjectURL = originalRevokeObjectURL;
  global.fetch = originalFetch;
  delete global.IS_REACT_ACT_ENVIRONMENT;
});

async function openTasks() {
  await act(async () => root.render(<Pipeline />));
  await act(async () => container.querySelector('.task-dropdown-btn').click());
}

function item(name) {
  return [...container.querySelectorAll('.asset-item')].find(element =>
    element.querySelector('.asset-nombre').textContent === name
  );
}

test('shows assets only inside the linked task and downloads using the existing token', async () => {
  await openTasks();
  const [assigned, other] = container.querySelectorAll('.task-item');
  expect(assigned.textContent).toContain('Escena.png');
  expect(other.textContent).toContain('Esta tarea no tiene archivos vinculados.');
  expect(other.textContent).not.toContain('Escena.png');
  expect(item('Proyecto.zip').querySelector('.btn-visualizar')).toBeNull();

  await act(async () => item('Escena.png').querySelector('.btn-descargar').click());
  expect(anchorClick.mock.instances[0].download).toBe('Escena.png');
  expect(global.fetch).toHaveBeenCalledWith(
    expect.stringMatching(/\/api\/projects\/7\/tasks\/12\/assets\/1\/download$/),
    expect.objectContaining({ headers: { Authorization: 'Bearer fixture-token' } }),
  );
});

test('renders image, PDF, video and audio previews without leaving the task', async () => {
  await openTasks();
  for (const [index, tag] of ['img', 'iframe', 'video', 'audio'].entries()) {
    await act(async () => item(files[index].name).querySelector('.btn-visualizar').click());
    expect(container.querySelector(`dialog[open] ${tag}`).getAttribute('src')).toBe('blob:test-asset');
    await act(async () => container.querySelector('dialog button').click());
    expect(container.querySelector('dialog')).toBeNull();
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(index + 1);
  }
  expect(anchorClick).not.toHaveBeenCalled();
});

test('shows a session error in the task when a download is rejected', async () => {
  await openTasks();
  global.fetch.mockResolvedValueOnce({ ok: false, status: 401 });
  await act(async () => item('Escena.png').querySelector('.btn-descargar').click());
  expect(container.querySelector('.assets-tarea [role="alert"]').textContent).toContain('ha expirado');
  expect(anchorClick).not.toHaveBeenCalled();
});

test('sends the JWT when renaming a view and preserves its asset relationship', async () => {
  const view = {
    views_pk: 8, views_name: 'Storyboard', views_order: 1,
    is_active: true,
  };
  const assetsFetch = global.fetch.getMockImplementation();
  global.fetch.mockImplementation((url, options) => {
    const path = new URL(url).pathname;
    if (path === '/views') return Promise.resolve(json({ data: [view] }));
    if (path === '/views/8') return Promise.resolve(json({}));
    return assetsFetch(url, options);
  });
  jest.spyOn(window, 'prompt').mockReturnValue('Nuevo nombre');

  await act(async () => root.render(<Pipeline />));
  await act(async () => container.querySelector('.update-btn').click());
  expect(global.fetch).toHaveBeenCalledWith(
    expect.stringMatching(/\/views\/8$/),
    expect.objectContaining({
      method: 'PUT',
      headers: { Authorization: 'Bearer fixture-token', 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...view, views_name: 'Nuevo nombre' }),
    }),
  );
  expect(container.querySelector('.view-item-header h4').textContent).toBe('Nuevo nombre');
  await act(async () => container.querySelector('.task-dropdown-btn').click());
  expect(item('Escena.png')).toBeDefined();
});

test('keeps the view visible when a write is denied', async () => {
  const assetsFetch = global.fetch.getMockImplementation();
  global.fetch.mockImplementation((url, options) => {
    const path = new URL(url).pathname;
    if (path === '/views') {
      return Promise.resolve(json({ data: [{ views_pk: 8, views_name: 'Storyboard', views_order: 1 }] }));
    }
    if (path === '/views/8') return Promise.resolve({ ok: false, status: 403 });
    return assetsFetch(url, options);
  });
  jest.spyOn(window, 'confirm').mockReturnValue(true);

  await act(async () => root.render(<Pipeline />));
  await act(async () => container.querySelector('.delete-btn').click());
  expect(container.querySelector('.view-item-header h4').textContent).toBe('Storyboard');
  expect(container.querySelector('[role="alert"]').textContent).toContain('requiere un administrador');
});
