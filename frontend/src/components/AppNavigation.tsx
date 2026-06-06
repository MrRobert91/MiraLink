import { NavLink } from "react-router-dom";

type AppNavigationProps = {
  onHome?: () => void;
};

export function AppNavigation({ onHome }: AppNavigationProps) {
  return (
    <header className="app-navigation">
      <NavLink className="brand-link" to="/" aria-label="MiraLink" onClick={onHome}>
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
