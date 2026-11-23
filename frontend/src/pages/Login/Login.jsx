import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import './Login.css';

function Login() {
  const [user, setUser] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    try {
      const formData = new URLSearchParams();
      formData.append('username', user);
      formData.append('password', password);

      const response = await fetch('http://localhost:8000/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Error al iniciar sesión');
      }

      const { access_token, role, username } = await response.json();
      localStorage.setItem('fastapi_token', access_token);
      localStorage.setItem('user_role', role);
      localStorage.setItem('user_name', username || user);
     navigate('/proyectos', { replace: true });

    } catch (error) {
      console.error('ERROR COMPLETO:', error);
      setErrorMsg(error.message || 'Error desconocido');
    }
  };

  return (
    <div className="Login">
      <header className="Login-Header">
        <form onSubmit={handleLogin} className="Login-Form">

          <p className="Login-Title">
            ANIDEP
          </p>

          {errorMsg && (
            <p style={{ color: '#946f97', textAlign: 'center' }}>
              {errorMsg}
            </p>
          )}

          <div>
            <label>User:</label>
            <input
              type="text"
              value={user}
              onChange={(e) => setUser(e.target.value)}
              required
            />
          </div>

          <div>
            <label>Password:</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button type="submit">
            Login
          </button>
        </form>
      </header>
    </div>
  );
}

export default Login;