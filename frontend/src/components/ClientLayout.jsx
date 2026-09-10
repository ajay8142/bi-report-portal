import { Outlet, NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import profinchLogo from '../assets/profinchlogo.png';

const navItems = [
  { to: '/client/generate', icon: '📄', key: 'nav_generate_report' },
  { to: '/client/history',  icon: '🕓', key: 'nav_report_history'  },
];

export default function ClientLayout() {
  const { user, logout } = useAuth();
  const { t } = useLanguage();

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
              <span>{n.icon}</span> {t(n.key)}
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
          <button style={s.logoutBtn} onClick={logout}>{t('logout')}</button>
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
  logo:        { height:'36px', marginRight:'16px', objectFit:'contain' },

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
