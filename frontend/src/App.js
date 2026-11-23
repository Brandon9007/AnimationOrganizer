import './App.css';
import { Routes, Route } from 'react-router-dom';
import Login from './pages/Login/Login.jsx';
import MainDashboard from './pages/MainDashboard/MainDashboard.jsx';
import Pipeline from './pages/Pipeline/Pipeline.jsx';
import AssetsTrabajador from './pages/Repositorio/AssetsTrabajador.jsx';
import Repositorio from './pages/Repositorio/Repositorio.jsx';
import Cronograma from './pages/Cronograma/Cronograma.jsx';
import MainLayout from './layouts/MainLayout.jsx';
import VentanaGestionProduccion from './pages/VentanaGestionProduccion/VentanaGestionProduccion.jsx';
import GestionUsuarios from './pages/Usuarios/Usuarios.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import Proyectos from './pages/Proyectos/Proyectos.jsx';
import Usuarios from './pages/Usuarios/Usuarios.jsx';



function App() {
  return (
    <div className="App">
      <Routes>
        <Route path="/" element={<Login />} />

        <Route element={<ProtectedRoute />}>
          {/* Rutas protegidas pro  el protected route */}
          <Route element={<MainLayout />}>
            <Route path="/dashboard" element={<MainDashboard />} />
            <Route path="/pipeline" element={<Pipeline />} />
            <Route path="/repositorio" element={<Repositorio />} />
            <Route path="/mis-assets" element={<AssetsTrabajador />} />
            <Route path="/cronograma" element={<Cronograma />} />
            <Route path="/proyectos" element={<Proyectos />} />

            {/* Rutas de admim*/}
            <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
              <Route path="/produccion" element={<VentanaGestionProduccion />} />
              <Route path="/gestion-usuarios" element={<GestionUsuarios />} />
              <Route path="/proyectos" element={<Proyectos />} />
              <Route path="/usuarios" element={<Usuarios />} />

            </Route>

          </Route>
        </Route>
      </Routes>
    </div>
  );
}

export default App;