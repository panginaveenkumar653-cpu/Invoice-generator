import { Link, NavLink, Outlet, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Clients from './pages/Clients.jsx';
import ClientDetail from './pages/ClientDetail.jsx';
import Invoices from './pages/Invoices.jsx';
import InvoiceForm from './pages/InvoiceForm.jsx';
import InvoiceDetail from './pages/InvoiceDetail.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Settings from './pages/Settings.jsx';
import Home from './pages/Home.jsx';
import { ToastProvider } from './context/ToastContext.jsx';

function PageLayout() {
  const { logout, user } = useAuth();
  const initials = (user?.name || user?.email || 'I')
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link className="brand" to="/dashboard" aria-label="Invoice Generator dashboard">
          <span className="brand-mark">IG</span><span>Invoice <span className="brand-accent">Generator</span></span>
        </Link>
        <div className="sidebar-label">WORKSPACE</div>
        <nav aria-label="Main navigation">
          <NavLink to="/dashboard"><span className="nav-icon" aria-hidden="true">▦</span>Overview</NavLink>
          <NavLink to="/clients"><span className="nav-icon" aria-hidden="true">♙</span>Clients</NavLink>
          <NavLink to="/invoices"><span className="nav-icon" aria-hidden="true">▤</span>Invoices</NavLink>
          <NavLink to="/settings"><span className="nav-icon" aria-hidden="true">⚙</span>Settings</NavLink>
        </nav>
        <div className="sidebar-spacer" />
        <div className="sidebar-note">
          <span className="sidebar-note-icon" aria-hidden="true">↗</span>
          <strong>Keep cash flow clear</strong>
          <span>Create and track every invoice in one place.</span>
          <Link to="/invoices/new">Create an invoice <span aria-hidden="true">→</span></Link>
        </div>
        <div className="sidebar-account">
          <span className="account-avatar" aria-hidden="true">{initials}</span>
          <span className="account-name">{user?.name || 'Your account'}<small>{user?.email}</small></span>
          <button type="button" onClick={logout} aria-label="Log out" title="Log out">↪</button>
        </div>
      </aside>
      <div className="workspace-main">
        <header className="workspace-topbar">
          <div><span className="topbar-kicker">INVOICE GENERATOR</span><span className="topbar-divider">/</span><span>Workspace</span></div>
          <span className="workspace-status"><i /> Workspace active</span>
        </header>
        <main className="page-content"><Outlet /></main>
      </div>
    </div>
  );
}

function NotFoundPage() { return <main className="public-page"><h1>Page not found</h1></main>; }

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<PageLayout />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/clients" element={<Clients />} />
              <Route path="/clients/:id" element={<ClientDetail />} />
              <Route path="/invoices" element={<Invoices />} />
              <Route path="/invoices/new" element={<InvoiceForm />} />
              <Route path="/invoices/:id/edit" element={<InvoiceForm />} />
              <Route path="/invoices/:id" element={<InvoiceDetail />} />
              <Route path="/settings" element={<Settings />} />
            </Route>
          </Route>
          <Route path="/" element={<Home />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </AuthProvider>
    </ToastProvider>
  );
}
