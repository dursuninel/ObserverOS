import { NavLink, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const routes = [
  { to: '/colony', key: 'navigation.colony' },
  { to: '/protocols', key: 'navigation.protocols' },
  { to: '/debugger', key: 'navigation.debugger' },
] as const;

export function AppLayout() {
  const { t } = useTranslation();

  return (
    <div className="app-shell">
      <header className="app-header">
        <span className="app-title">{t('app.title')}</span>
        <nav aria-label={t('navigation.primaryLabel')} className="app-navigation">
          {routes.map((route) => (
            <NavLink
              className={({ isActive }) => (isActive ? 'active' : undefined)}
              key={route.to}
              to={route.to}
            >
              {t(route.key)}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
}

