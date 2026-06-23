import { Outlet, NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const navItems = [
  { to: '/client/generate', icon: '📄', label: 'Generate Report' },
  { to: '/client/profile',  icon: '👤', label: 'My Profile'      },
];

export default function ClientLayout() {
  const { user, logout } = useAuth();
  return (
    <div style={s.shell}>
      <aside style={s.sidebar}>
        <div style={s.brand}>📊 BIP Portal</div>
        <div style={s.role}>Client Panel</div>
        <nav style={s.nav}>
          {navItems.map(n => (
            <NavLink key={n.to} to={n.to} style={({ isActive }) => ({ ...s.link, ...(isActive ? s.active : {}) })}>
              <span>{n.icon}</span> {n.label}
            </NavLink>
          ))}
        </nav>
        <div style={s.footer}>
          <div style={s.userName}>{user?.name}</div>
          <button style={s.logoutBtn} onClick={logout}>Logout</button>
        </div>
      </aside>
      <main style={s.main}><Outlet /></main>
    </div>
  );
}

const s = {
  shell:     { display:'flex', minHeight:'100vh', fontFamily:'Inter,sans-serif' },
  sidebar:   { width:'220px', background:'#1a1a2e', display:'flex', flexDirection:'column', flexShrink:0 },
  brand:     { padding:'24px 20px 8px', fontSize:'18px', fontWeight:800, color:'#fff' },
  role:      { padding:'0 20px 20px', fontSize:'11px', color:'#8888aa', textTransform:'uppercase', letterSpacing:'1px' },
  nav:       { flex:1, padding:'0 12px' },
  link:      { display:'flex', alignItems:'center', gap:'10px', padding:'10px 12px', borderRadius:'8px', color:'#aab', textDecoration:'none', fontSize:'14px', fontWeight:500, marginBottom:'4px' },
  active:    { background:'#1976d2', color:'#fff' },
  footer:    { padding:'20px', borderTop:'1px solid #2a2a4e' },
  userName:  { color:'#ccc', fontSize:'13px', marginBottom:'10px', fontWeight:600 },
  logoutBtn: { width:'100%', padding:'8px', background:'#c62828', color:'#fff', border:'none', borderRadius:'6px', cursor:'pointer', fontWeight:600, fontSize:'13px' },
  main:      { flex:1, background:'#f0f2f5', overflowY:'auto' },
};
