import React from 'react';
import { createRoot } from 'react-dom/client';
import { act as legacyAct } from 'react-dom/test-utils';
import { MemoryRouter } from 'react-router-dom';
import App from './App';

const act = React.act || legacyAct;

test('redirects to login when opening Mis assets without a session', async () => {
  localStorage.removeItem('fastapi_token');
  global.IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  try {
    await act(async () => root.render(
      <MemoryRouter initialEntries={['/mis-assets']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <App />
      </MemoryRouter>
    ));
    expect(container.querySelector('button[type="submit"]').textContent.trim()).toBe('Login');
  } finally {
    await act(async () => root.unmount());
    container.remove();
    delete global.IS_REACT_ACT_ENVIRONMENT;
  }
});
