import { useState, useEffect } from 'react';
import api from '../../api/axiosInstance';
import toast from 'react-hot-toast';

export default function AssignReports() {
  const [clients,      setClients]      = useState([]);
  const [selectedClient, setSelectedClient] = useState(null);
  const [modules,      setModules]      = useState([]);
  const [activeModule, setActiveModule] = useState(null);
  const [reports,      setReports]      = useState([]);
  const [assignments,  setAssignments]  = useState({});
  const [loading,      setLoading]      = useState(false);

  useEffect(() => {
    api.get('/admin/clients').then(r => setClients(r.data.data)).catch(() => toast.error('Failed to load clients'));
  }, []);

  const selectClient = async (client) => {
    setSelectedClient(client);
    setActiveModule(null);
    setReports([]);
    setLoading(true);
    try {
      const [modRes, assignRes] = await Promise.all([
        api.get('/admin/modules'),
        api.get(`/admin/assignments/${client.USER_ID}`),
      ]);
      setModules(modRes.data.data);
      // Build assignment map: reportPath -> isEnabled
      const map = {};
      assignRes.data.data.forEach(a => { map[a.REPORT_PATH] = a.IS_ENABLED === 1; });
      setAssignments(map);
    } catch { toast.error('Failed to load data'); }
    finally  { setLoading(false); }
  };

  const loadReports = async (mod) => {
    setActiveModule(mod);
    setLoading(true);
    try {
      const res = await api.get('/admin/modules/reports', { params: { path: mod.absolutePath } });
      setReports(res.data.data);
    } catch { toast.error('Failed to load reports'); }
    finally  { setLoading(false); }
  };

  const toggle = async (report, enabled) => {
    try {
      await api.post('/admin/assignments', {
        clientId:   selectedClient.USER_ID,
        moduleName: activeModule.displayName,
        modulePath: activeModule.absolutePath,
        reportName: report.displayName,
        reportPath: report.absolutePath,
        isEnabled:  enabled,
      });
      setAssignments(prev => ({ ...prev, [report.absolutePath]: enabled }));
      toast.success(enabled ? 'Report enabled' : 'Report disabled');
    } catch { toast.error('Toggle failed'); }
  };

  const disableAll = async () => {
    if (!window.confirm('Disable ALL reports for this client?')) return;
    try {
      await api.put(`/admin/assignments/${selectedClient.USER_ID}/disable-all`);
      setAssignments(prev => Object.fromEntries(Object.keys(prev).map(k => [k, false])));
      toast.success('All reports disabled');
    } catch { toast.error('Failed'); }
  };

  return (
    <div style={s.page}>
      <h2 style={s.heading}>Assign Reports</h2>

      {/* Step 1: Select Client */}
      {!selectedClient ? (
        <>
          <p style={s.sub}>Select a User to manage their report assignments:</p>
          <div style={s.tableWrap}>
            <table style={s.table}>
              <thead>
                <tr>
                  <th style={{ ...s.th, ...s.thNum }}>S No.</th>
                  <th style={{ ...s.th }}>User Name</th>
                  <th style={{ ...s.th }}>Email</th>
                </tr>
              </thead>
              <tbody>
                {clients.length === 0 ? (
                  <tr><td colSpan={3} style={s.empty}>No Users found</td></tr>
                ) : clients.map((c, i) => (
                  <tr
                    key={c.USER_ID}
                    style={{ ...(i % 2 === 0 ? s.rowEven : s.rowOdd), cursor:'pointer' }}
                    onClick={() => selectClient(c)}
                    onMouseEnter={e => e.currentTarget.style.background = '#e3f2fd'}
                    onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? '#fff' : '#f9fafb'}
                  >
                    <td style={{ ...s.td, ...s.tdNum }}>{i + 1}</td>
                    <td style={s.td}>👤 {c.NAME}</td>
                    <td style={{ ...s.td, color:'#888' }}>{c.EMAIL}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <>
          {/* Header with client info + back + disable all */}
          <div style={s.clientHeader}>
            <button style={s.backBtn} onClick={() => { setSelectedClient(null); setActiveModule(null); setReports([]); }}>← Back</button>
            <div style={s.clientInfo}>
              <strong>{selectedClient.NAME}</strong> — {selectedClient.EMAIL}
            </div>
            <button style={s.disableAllBtn} onClick={disableAll}>🚫 Disable All Reports</button>
          </div>

          {/* Breadcrumb */}
          <div style={s.breadcrumb}>
            <span style={activeModule ? s.crumbLink : s.crumbCurrent} onClick={() => { setActiveModule(null); setReports([]); }}>
              📁 Modules
            </span>
            {activeModule && (
              <>
                <span style={s.sep}> › </span>
                <span style={s.crumbCurrent}>📂 {activeModule.displayName}</span>
              </>
            )}
          </div>

          {loading && <p style={s.loading}>Loading…</p>}

          {/* Modules */}
          {!activeModule && !loading && (
            <div style={s.tableWrap}>
              <table style={s.table}>
                <thead>
                  <tr>
                    <th style={{ ...s.th, ...s.thNum }}>S No.</th>
                    <th style={{ ...s.th }}>Module Name</th>
                    <th style={{ ...s.th }}>Path</th>
                  </tr>
                </thead>
                <tbody>
                  {modules.length === 0 ? (
                    <tr><td colSpan={3} style={s.empty}>No modules found</td></tr>
                  ) : modules.map((mod, i) => (
                    <tr
                      key={mod.absolutePath}
                      style={{ ...(i % 2 === 0 ? s.rowEven : s.rowOdd), cursor:'pointer' }}
                      onClick={() => loadReports(mod)}
                      onMouseEnter={e => e.currentTarget.style.background = '#e3f2fd'}
                      onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? '#fff' : '#f9fafb'}
                    >
                      <td style={{ ...s.td, ...s.tdNum }}>{i + 1}</td>
                      <td style={s.td}>📂 {mod.displayName}</td>
                      <td style={{ ...s.td, color:'#888', fontSize:'12px' }}>{mod.absolutePath}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Reports with toggles */}
          {activeModule && !loading && (
            <div style={s.tableWrap}>
              <table style={s.table}>
                <thead>
                  <tr>
                    <th style={{ ...s.th, ...s.thNum }}>S No.</th>
                    <th style={{ ...s.th }}>Report Name</th>
                    <th style={{ ...s.th}}>Path</th>
                    <th style={{ ...s.th}}>Assigned</th>
                  </tr>
                </thead>
                <tbody>
                  {reports.length === 0
                    ? <tr><td colSpan={4} style={s.empty}>No reports in this module</td></tr>
                    : reports.map((r, i) => {
                        const enabled = !!assignments[r.absolutePath];
                        return (
                          <tr key={r.absolutePath} style={i % 2 === 0 ? s.rowEven : s.rowOdd}>
                            <td style={{ ...s.td, ...s.tdNum }}>{i + 1}</td>
                            <td style={s.td}>📄 {r.displayName}</td>
                            <td style={{ ...s.td, color:'#aaa', fontSize:'12px' }}>{r.absolutePath}</td>
                            <td style={{ ...s.td, textAlign:'center' }}>
                              <label style={s.toggleWrap}>
                                <input type="checkbox" style={{ display:'none' }} checked={enabled}
                                  onChange={e => toggle(r, e.target.checked)} />
                                <span style={{ ...s.toggleTrack, background: enabled ? '#1976d2' : '#ccc' }}>
                                  <span style={{ ...s.toggleThumb, left: enabled ? '20px' : '2px' }} />
                                </span>
                              </label>
                            </td>
                          </tr>
                        );
                      })
                  }
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

const s = {
  page:         { padding:'32px' },
  heading:      { fontSize:'22px', fontWeight:700, color:'#1a1a2e', marginBottom:'8px' },
  sub:          { color:'#666', marginBottom:'20px' },
  clientHeader: { display:'flex', alignItems:'center', gap:'16px', marginBottom:'16px', flexWrap:'wrap' },
  backBtn:      { padding:'8px 16px', background:'#f5f5f5', border:'none', borderRadius:'8px', cursor:'pointer', fontWeight:600 },
  clientInfo:   { flex:1, color:'#333', fontSize:'14px' },
  disableAllBtn:{ padding:'8px 16px', background:'#fce4ec', color:'#c62828', border:'none', borderRadius:'8px', cursor:'pointer', fontWeight:600 },
  breadcrumb:   { marginBottom:'16px', fontSize:'14px' },
  crumbLink:    { cursor:'pointer', color:'#1976d2', fontWeight:600 },
  crumbCurrent: { color:'#333', fontWeight:600 },
  sep:          { margin:'0 6px', color:'#bbb' },
  loading:      { color:'#888' },
  tableWrap:    { overflowX:'auto' },
  table:        { width:'100%', borderCollapse:'collapse', background:'#fff', borderRadius:'10px', overflow:'hidden', boxShadow:'0 2px 10px rgba(0,0,0,0.08)' },
  th:           { padding:'12px 16px', background:'#1976d2', color:'#fff', textAlign:'left', fontSize:'13px', fontWeight:600 },
  thNum:        { width:'70px', textAlign:'center' },
  td:           { padding:'12px 16px', fontSize:'13px', color:'#333', verticalAlign:'middle', textAlign:'left' },
  tdNum:        { width:'70px', textAlign:'center', color:'#aaa', fontWeight:600 },
  rowEven:      { background:'#fff' },
  rowOdd:       { background:'#f9fafb' },
  empty:        { padding:'24px', textAlign:'center', color:'#aaa' },
  toggleWrap:   { cursor:'pointer', display:'inline-block' },
  toggleTrack:  { display:'inline-block', width:'44px', height:'24px', borderRadius:'12px', position:'relative', transition:'background 0.2s' },
  toggleThumb:  { position:'absolute', top:'2px', width:'20px', height:'20px', borderRadius:'50%', background:'#fff', boxShadow:'0 1px 4px rgba(0,0,0,0.2)', transition:'left 0.2s' },
};
