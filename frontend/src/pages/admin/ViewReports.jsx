import { useState, useEffect } from 'react';
import api from '../../api/axiosInstance';
import toast from 'react-hot-toast';

export default function ViewReports() {
  const [modules,      setModules]      = useState([]);
  const [reports,      setReports]      = useState([]);
  const [activeModule, setActiveModule] = useState(null);
  const [loading,      setLoading]      = useState(true);

  useEffect(() => {
    api.get('/admin/modules')
      .then(res => setModules(res.data.data))
      .catch(() => toast.error('Failed to load modules'))
      .finally(() => setLoading(false));
  }, []);

  const loadReports = async (mod) => {
    setLoading(true);
    setActiveModule(mod);
    try {
      const res = await api.get('/admin/modules/reports', { params: { path: mod.absolutePath } });
      setReports(res.data.data);
    } catch { toast.error('Failed to load reports'); }
    finally  { setLoading(false); }
  };

  return (
    <div style={s.page}>
      <div style={s.header}>
        <h2 style={s.heading}>View Reports</h2>
      </div>

      {/* Breadcrumb */}
      {activeModule && (
        <div style={s.breadcrumb}>
          <span style={s.crumbLink} onClick={() => { setActiveModule(null); setReports([]); }}>
            📁 All Modules
          </span>
          <span style={s.sep}> › </span>
          <span style={s.crumbCurrent}>📂 {activeModule.displayName}</span>
        </div>
      )}

      {loading && <p style={s.loading}>Loading…</p>}

      {/* Modules list */}
      {!activeModule && !loading && modules.length > 0 && (
        <div style={s.tableWrap}>
          <table style={s.table}>
            <thead>
              <tr>
                <th style={{ ...s.th, ...s.thNum }}>S No.</th>
                <th style={s.th}>Module Name</th>
                <th style={s.th}>Path</th>
              </tr>
            </thead>
            <tbody>
              {modules.map((mod, i) => (
                <tr
                  key={mod.absolutePath}
                  style={{ ...(i % 2 === 0 ? s.rowEven : s.rowOdd), cursor: 'pointer' }}
                  onClick={() => loadReports(mod)}
                  onMouseEnter={e => e.currentTarget.style.background = '#e3f2fd'}
                  onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? '#fff' : '#f9fafb'}
                >
                  <td style={{ ...s.td, ...s.tdNum }}>{i + 1}</td>
                  <td style={s.td}>📂 {mod.displayName}</td>
                  <td style={{ ...s.td, ...s.tdPath }}>{mod.absolutePath}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Reports list */}
      {activeModule && !loading && (
        <div style={s.tableWrap}>
          <table style={s.table}>
            <thead>
              <tr>
                <th style={{ ...s.th, ...s.thNum }}>S No.</th>
                <th style={s.th}>Report Name</th>
                <th style={s.th}>Path</th>
              </tr>
            </thead>
            <tbody>
              {reports.length === 0 ? (
                <tr><td colSpan={3} style={s.empty}>No reports found in this module</td></tr>
              ) : reports.map((r, i) => (
                <tr key={r.absolutePath} style={i % 2 === 0 ? s.rowEven : s.rowOdd}>
                  <td style={{ ...s.td, ...s.tdNum }}>{i + 1}</td>
                  <td style={s.td}>📄 {r.displayName}</td>
                  <td style={{ ...s.td, ...s.tdPath }}>{r.absolutePath}</td>
                </tr>
              ))}
            
            </tbody>
          </table>
        </div>
      )}

      {!loading && modules.length === 0 && (
        <div style={s.emptyState}>
          <div style={{ fontSize:'48px' }}>📊</div>
          <p>No modules found.</p>
        </div>
      )}
    </div>
  );
}

const s = {
  page:         { padding:'32px' },
  header:       { display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'24px' },
  heading:      { fontSize:'22px', fontWeight:700, color:'#1a1a2e', margin:0 },
  breadcrumb:   { marginBottom:'20px', fontSize:'14px', color:'#555' },
  crumbLink:    { cursor:'pointer', color:'#1976d2', fontWeight:600 },
  sep:          { margin:'0 6px', color:'#bbb' },
  crumbCurrent: { color:'#333', fontWeight:600 },
  loading:      { color:'#888', padding:'20px 0' },
  grid:         { display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:'16px' },
  card:         { background:'#fff', borderRadius:'10px', padding:'20px', boxShadow:'0 2px 10px rgba(0,0,0,0.08)', cursor:'pointer', textAlign:'center', transition:'transform 0.15s', border:'1px solid #eee' },
  cardIcon:     { fontSize:'32px', marginBottom:'8px' },
  cardName:     { fontWeight:700, fontSize:'14px', color:'#1a1a2e', marginBottom:'4px' },
  cardPath:     { fontSize:'11px', color:'#aaa' },
  tableWrap:    { overflowX:'auto' },
  table:        { width:'100%', borderCollapse:'collapse', background:'#fff', borderRadius:'10px', overflow:'hidden', boxShadow:'0 2px 10px rgba(0,0,0,0.08)' },
  th:           { padding:'12px 16px', background:'#1976d2', color:'#fff', textAlign:'left', fontSize:'13px', fontWeight:600 },
  thNum:        { width:'60px', textAlign:'center' },
  td:           { padding:'12px 16px', fontSize:'13px', color:'#333', verticalAlign:'middle', textAlign:'left' },
  tdNum:        { width:'60px', textAlign:'center', color:'#aaa', fontWeight:600 },
  tdPath:       { color:'#888', fontSize:'12px' },
  rowEven:      { background:'#fff' },
  rowOdd:       { background:'#f9fafb' },
  empty:        { padding:'24px', textAlign:'center', color:'#aaa' },
  emptyState:   { textAlign:'center', padding:'60px 0', color:'#aaa' },
};
