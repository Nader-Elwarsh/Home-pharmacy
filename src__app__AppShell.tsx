import { NavLink, Outlet } from 'react-router-dom';
import { NAV_ITEMS } from './navigation';

export function AppShell() {
  return (
    <div className="app-shell">
      <nav className="main-nav" aria-label="التنقل الرئيسي">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
          >
            <span aria-hidden="true" className="nav-icon">
              {item.icon}
            </span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
