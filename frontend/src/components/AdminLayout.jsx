import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const navItems = [
  { to: '/admin/dashboard',    icon: '📊', label: 'Dashboard'      },
  { to: '/admin/view-reports', icon: '📁', label: 'View Reports'   },
  { to: '/admin/clients',      icon: '👥', label: 'Clients'        },
  { to: '/admin/assign',       icon: '🔗', label: 'Assign Reports' },
];

export default function AdminLayout() {
  const { user, logout } = useAuth();
  return (
    <div style={s.shell}>
      {/* Sidebar */}
      <aside style={s.sidebar}>
        <div style={s.brand}>📊 BIP Portal</div>
        <div style={s.role}>Admin Panel</div>
        <nav style={s.nav}>
          {navItems.map(n => (
            <NavLink key={n.to} to={n.to} style={({ isActive }) => ({ ...s.link, ...(isActive ? s.linkActive : {}) })}>
              <span style={s.icon}>{n.icon}</span> {n.label}
            </NavLink>
          ))}
        </nav>
        <div style={s.footer}>
          <div style={s.userName}>{user?.name}</div>
          <button style={s.logoutBtn} onClick={logout}>Logout</button>
        </div>
      </aside>
      {/* Main */}
      <main style={s.main}>
        <Outlet />
      </main>
    </div>
  );
}

const s = {
  shell:      { display:'flex', minHeight:'100vh', fontFamily:'Inter,sans-serif' },
  sidebar:    { width:'240px', background:'#1a1a2e', display:'flex', flexDirection:'column', flexShrink:0 },
  brand:      { padding:'24px 20px 8px', fontSize:'18px', fontWeight:800, color:'#fff' },
  role:       { padding:'0 20px 20px', fontSize:'11px', color:'#8888aa', textTransform:'uppercase', letterSpacing:'1px' },
  nav:        { flex:1, padding:'0 12px' },
  link:       { display:'flex', alignItems:'center', gap:'10px', padding:'10px 12px', borderRadius:'8px', color:'#aab', textDecoration:'none', fontSize:'14px', fontWeight:500, marginBottom:'4px' },
  linkActive: { background:'#1976d2', color:'#fff' },
  icon:       { fontSize:'16px' },
  footer:     { padding:'20px', borderTop:'1px solid #2a2a4e' },
  userName:   { color:'#ccc', fontSize:'13px', marginBottom:'10px', fontWeight:600 },
  logoutBtn:  { width:'100%', padding:'8px', background:'#c62828', color:'#fff', border:'none', borderRadius:'6px', cursor:'pointer', fontWeight:600, fontSize:'13px' },
  main:       { flex:1, background:'#f0f2f5', overflowY:'auto' },
};
