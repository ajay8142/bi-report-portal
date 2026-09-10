import { useEffect, useState } from 'react';
import api from '../../api/axiosInstance';
import toast from 'react-hot-toast';
import { useReportEngine } from '../../context/ReportEngineContext';
import { useLanguage } from '../../context/LanguageContext';

export default function Dashboard() {
  const { engine } = useReportEngine();
  const { t } = useLanguage();
  const [data, setData]     = useState({ totalClients:0, totalModules:0, totalReports:0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!engine) return;
    Promise.resolve()
      .then(() => setLoading(true))
      .then(() => api.get('/admin/dashboard'))
      .then(r => setData(r.data.data))
      .catch(() => toast.error(t('toast_dashboard_failed')))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-run on edition switch
  }, [engine]);

  const cards = [
    { label: t('card_total_modules'), value: data.totalModules,  color:'#1976d2', icon:'📁' },
    { label: t('card_total_reports'), value: data.totalReports,  color:'#388e3c', icon:'📄' },
    { label: t('card_total_clients'), value: data.totalClients,  color:'#f57c00', icon:'👥' },
  ];

  return (
    <div style={s.page}>
      <h2 style={s.heading}>{t('dashboard_heading')}</h2>

      <div style={s.hero}>
        <div style={s.heroText}>
          <h1 style={s.heroTitle}>{t('dashboard_hero_title')}</h1>
          <p style={s.heroSubtitle}>{t('dashboard_hero_subtitle')}</p>
        </div>
      </div>

      {loading ? <p>{t('loading')}</p> : (
        <div style={s.grid}>
          {cards.map(c => (
            <div key={c.label} style={{ ...s.card, borderTop:`4px solid ${c.color}` }}>
              <div style={s.icon}>{c.icon}</div>
              <div style={{ ...s.val, color: c.color }}>{c.value}</div>
              <div style={s.lbl}>{c.label}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const s = {
  page:          { padding:'32px' },
  heading:       { fontSize:'22px', fontWeight:700, marginBottom:'24px', color:'#1a1a2e' },
  hero:          { background:'linear-gradient(135deg,#1976d2 0%,#1a1a2e 100%)', borderRadius:'14px', padding:'32px', marginBottom:'28px', color:'#fff', boxShadow:'0 4px 18px rgba(25,118,210,0.25)', textAlign:'center' },
  heroText:      { maxWidth:'760px', margin:'0 auto' },
  heroTitle:     { fontSize:'26px', fontWeight:800, margin:'0 0 10px' },
  heroSubtitle:  { fontSize:'15px', lineHeight:1.6, margin:0, color:'rgba(255,255,255,0.88)' },
  grid:    { display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:'20px' },
  card:    { background:'#fff', borderRadius:'10px', padding:'24px', boxShadow:'0 2px 12px rgba(0,0,0,0.08)', textAlign:'center' },
  icon:    { fontSize:'32px', marginBottom:'8px' },
  val:     { fontSize:'40px', fontWeight:800, margin:'4px 0' },
  lbl:     { color:'#666', fontSize:'14px', fontWeight:500 },
};
