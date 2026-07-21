import { useEffect, useState } from 'react';
import api from '../../api/axiosInstance';
import toast from 'react-hot-toast';
import { useReportEngine } from '../../context/ReportEngineContext';

export default function Dashboard() {
  const { engine } = useReportEngine();
  const [data, setData]     = useState({ totalClients:0, totalModules:0, totalReports:0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!engine) return;
    Promise.resolve()
      .then(() => setLoading(true))
      .then(() => api.get('/admin/dashboard'))
      .then(r => setData(r.data.data))
      .catch(() => toast.error('Failed to load dashboard'))
      .finally(() => setLoading(false));
  }, [engine]);

  const cards = [
    { label:'Total Modules',  value: data.totalModules,  color:'#1976d2', icon:'📁' },
    { label:'Total Reports',  value: data.totalReports,  color:'#388e3c', icon:'📄' },
    { label:'Total Clients',  value: data.totalClients,  color:'#f57c00', icon:'👥' },
  ];

  return (
    <div style={s.page}>
      <h2 style={s.heading}>Dashboard</h2>
      {loading ? <p>Loading…</p> : (
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
  page:    { padding:'32px' },
  heading: { fontSize:'22px', fontWeight:700, marginBottom:'24px', color:'#1a1a2e' },
  grid:    { display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:'20px' },
  card:    { background:'#fff', borderRadius:'10px', padding:'24px', boxShadow:'0 2px 12px rgba(0,0,0,0.08)', textAlign:'center' },
  icon:    { fontSize:'32px', marginBottom:'8px' },
  val:     { fontSize:'40px', fontWeight:800, margin:'4px 0' },
  lbl:     { color:'#666', fontSize:'14px', fontWeight:500 },
};
