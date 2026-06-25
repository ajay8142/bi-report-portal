import { Outlet, NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import profinchLogo from '../assets/profinchlogo.png';

const navItems = [
  { to: '/admin/dashboard',    icon: '📊', label: 'Dashboard'      },
  { to: '/admin/view-reports', icon: '📁', label: 'View Reports'   },
  { to: '/admin/clients',      icon: '👥', label: 'Users'          },
  { to: '/admin/assign',       icon: '🔗', label: 'Assign Reports' },
  { to: '/admin/user-access',  icon: '🔐', label: 'User Access'    },
];

// ─── Admin Layout ─────────────────────────────────────────────────────────────
export default function AdminLayout() {
  const { user, logout } = useAuth();

  return (
    <div style={s.shell}>
      <header style={s.topbar}>
        <img src={profinchLogo} alt="Profinch" style={s.logo} />

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
          <span style={s.userName}>{user?.name}</span>
          <button style={s.logoutBtn} onClick={logout}>Logout</button>
        </div>
      </header>

      <main style={s.main}>
        <Outlet />
      </main>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = {
  shell:      { display:'flex', flexDirection:'column', minHeight:'100vh', fontFamily:'Inter,sans-serif' },

  topbar:     { display:'flex', alignItems:'center', gap:'8px',
                background:'#1a1a2e', padding:'0 24px', height:'56px', flexShrink:0,
                borderBottom:'1px solid #2a2a4e' },
  logo:       { height:'36px', marginRight:'16px', objectFit:'contain' },

  nav:        { display:'flex', alignItems:'center', gap:'4px', flex:1 },
  link:       { display:'flex', alignItems:'center', gap:'7px', padding:'7px 12px',
                borderRadius:'8px', color:'#aab', textDecoration:'none', fontSize:'13px',
                fontWeight:500, whiteSpace:'nowrap', border:'none', background:'transparent', cursor:'pointer' },
  linkActive: { background:'#1976d2', color:'#fff' },

  topbarRight:{ display:'flex', alignItems:'center', gap:'12px', marginLeft:'auto' },

  userName:   { color:'#ccc', fontSize:'13px', fontWeight:600, whiteSpace:'nowrap' },
  logoutBtn:  { padding:'6px 16px', background:'#c62828', color:'#fff', border:'none',
                borderRadius:'6px', cursor:'pointer', fontWeight:600, fontSize:'13px' },

  main:       { flex:1, background:'#f0f2f5', overflowY:'auto' },
};
