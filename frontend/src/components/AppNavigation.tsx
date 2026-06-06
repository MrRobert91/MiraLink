import { NavLink } from "react-router-dom";

export function AppNavigation() {
  return (
    <header className="app-navigation">
      <NavLink className="brand-link" to="/" aria-label="MiraLink">
        <span className="brand-mark" aria-hidden="true">
          <span />
        </span>
        MiraLink
      </NavLink>
      <nav aria-label="Navegación principal">
        <NavLink to="/administracion">Administración</NavLink>
        <NavLink to="/configuracion">Configuración</NavLink>
      </nav>
    </header>
  );
}
