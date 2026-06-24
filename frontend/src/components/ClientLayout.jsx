import { Outlet, NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const navItems = [
  { to: '/client/generate', icon: '📄', label: 'Generate Report' },
  { to: '/client/history',  icon: '🕓', label: 'Report History'  },
];

export default function ClientLayout() {
  const { user, logout } = useAuth();

  return (
    <div style={s.shell}>
      <header style={s.topbar}>
        <div style={s.brandText}>📊 Profinch Reporting Tool</div>

        <nav style={s.nav}>
          {navItems.map(n => (
            <NavLink
              key={n.to}
              to={n.to}
              style={({ isActive }) => ({ ...s.link, ...(isActive ? s.linkActive : {}) })}
            >
              <span>{n.icon}</span> {n.label}
            </NavLink>
          ))}
        </nav>

        <div style={s.topbarRight}>
          <NavLink
            to="/client/profile"
            style={({ isActive }) => ({ ...s.profileLink, ...(isActive ? s.linkActive : {}) })}
          >
            👤 {user?.name}
          </NavLink>
          <button style={s.logoutBtn} onClick={logout}>Logout</button>
        </div>
      </header>

      <main style={s.main}>
        <Outlet />
      </main>
    </div>
  );
}

const s = {
  shell:       { display:'flex', flexDirection:'column', minHeight:'100vh', fontFamily:'Inter,sans-serif' },

  topbar:      { display:'flex', alignItems:'center', gap:'8px',
                 background:'#1a1a2e', padding:'0 24px', height:'56px', flexShrink:0,
                 borderBottom:'1px solid #2a2a4e' },
  brandText:   { fontSize:'17px', fontWeight:800, color:'#fff', marginRight:'16px', whiteSpace:'nowrap' },

  nav:         { display:'flex', alignItems:'center', gap:'4px', flex:1 },
  link:        { display:'flex', alignItems:'center', gap:'7px', padding:'7px 12px',
                 borderRadius:'8px', color:'#aab', textDecoration:'none', fontSize:'13px',
                 fontWeight:500, whiteSpace:'nowrap' },
  linkActive:  { background:'#1976d2', color:'#fff' },

  topbarRight: { display:'flex', alignItems:'center', gap:'12px', marginLeft:'auto' },
  profileLink: { display:'flex', alignItems:'center', gap:'7px', padding:'7px 12px',
                 borderRadius:'8px', color:'#aab', textDecoration:'none', fontSize:'13px',
                 fontWeight:500, whiteSpace:'nowrap' },
  logoutBtn:   { padding:'6px 16px', background:'#c62828', color:'#fff', border:'none',
                 borderRadius:'6px', cursor:'pointer', fontWeight:600, fontSize:'13px' },

  main:        { flex:1, background:'#f0f2f5', overflowY:'auto' },
};
