import { useState, useEffect } from 'react';
import api from '../../api/axiosInstance';
import toast from 'react-hot-toast';
import { useReportEngine } from '../../context/ReportEngineContext';
import { useLanguage } from '../../context/LanguageContext';

export default function AssignReports() {
  const { engine } = useReportEngine();
  const { t } = useLanguage();
  const [clients,      setClients]      = useState([]);
  const [selectedClient, setSelectedClient] = useState(null);
  const [modules,      setModules]      = useState([]);
  const [activeModule, setActiveModule] = useState(null);
  const [reports,      setReports]      = useState([]);
  const [assignments,  setAssignments]  = useState({});
  const [roles,        setRoles]        = useState([]);
  const [loading,      setLoading]      = useState(false);

  useEffect(() => {
    if (!engine) return;
    // A previously selected client may belong to the edition we just switched
    // away from — drop the drill-down state and go back to the client list.
    Promise.resolve()
      .then(() => { setSelectedClient(null); setActiveModule(null); setReports([]); })
      .then(() => api.get('/admin/clients'))
      .then(r => setClients(r.data.data))
      .catch(() => toast.error(t('toast_load_clients_failed')));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-run on edition switch
  }, [engine]);

  const selectClient = async (client) => {
    setSelectedClient(client);
    setActiveModule(null);
    setReports([]);
    setLoading(true);
    try {
      const [modRes, assignRes, roleRes] = await Promise.all([
        api.get('/admin/modules'),
        api.get(`/admin/assignments/${client.USER_ID}`),
        api.get(`/admin/roles/${client.USER_ID}`),
      ]);
      setModules(modRes.data.data);
      // Build assignment map: reportPath -> { isEnabled, userRole, printFlag, generateFlag }
      const map = {};
      assignRes.data.data.forEach(a => {
        map[a.REPORT_PATH] = {
          isEnabled:    a.IS_ENABLED === 1,
          userRole:     a.USER_ROLE || '',
          printFlag:    a.PRINT_FLAG === 'Y',
          generateFlag: a.GENERATE_FLAG === 'Y',
        };
      });
      setAssignments(map);
      setRoles(roleRes.data.data);
    } catch { toast.error(t('toast_load_data_failed')); }
    finally  { setLoading(false); }
  };

  const loadReports = async (mod) => {
    setActiveModule(mod);
    setLoading(true);
    try {
      const res = await api.get('/admin/modules/reports', { params: { path: mod.absolutePath } });
      setReports(res.data.data);
    } catch { toast.error(t('toast_load_reports_failed')); }
    finally  { setLoading(false); }
  };

  const toggle = async (report, enabled) => {
    const userRole = assignments[report.absolutePath]?.userRole || '';
    if (enabled && !userRole) return toast.error(t('toast_select_role_first'));
    try {
      await api.post('/admin/assignments', {
        clientId:   selectedClient.USER_ID,
        moduleName: activeModule.displayName,
        modulePath: activeModule.absolutePath,
        reportName: report.displayName,
        reportPath: report.absolutePath,
        isEnabled:  enabled,
        userRole,
      });
      setAssignments(prev => ({
        ...prev,
        [report.absolutePath]: {
          ...prev[report.absolutePath],
          isEnabled: enabled,
          userRole,
          ...(enabled ? {} : { printFlag: false, generateFlag: false }),
        },
      }));
      toast.success(enabled ? t('toast_report_enabled') : t('toast_report_disabled'));
    } catch (err) { toast.error(err.response?.data?.message || t('toast_toggle_failed')); }
  };

  const changeRole = (report, userRole) => {
    setAssignments(prev => ({ ...prev, [report.absolutePath]: { ...prev[report.absolutePath], userRole } }));
  };

  const toggleFlag = async (report, flag, value) => {
    const key = flag === 'PRINT' ? 'printFlag' : 'generateFlag';
    try {
      await api.put('/admin/assignments/flag', {
        clientId:   selectedClient.USER_ID,
        moduleName: activeModule.displayName,
        modulePath: activeModule.absolutePath,
        reportName: report.displayName,
        reportPath: report.absolutePath,
        flag,
        value,
      });
      setAssignments(prev => ({ ...prev, [report.absolutePath]: { ...prev[report.absolutePath], [key]: value } }));
      if (flag === 'PRINT') toast.success(value ? t('toast_print_enabled') : t('toast_print_disabled'));
      else toast.success(value ? t('toast_generate_enabled') : t('toast_generate_disabled'));
    } catch (err) { toast.error(err.response?.data?.message || t('toast_toggle_failed')); }
  };

  const disableAll = async () => {
    if (!window.confirm(t('confirm_disable_all'))) return;
    try {
      await api.put(`/admin/assignments/${selectedClient.USER_ID}/disable-all`);
      setAssignments(prev => Object.fromEntries(Object.entries(prev).map(([k, v]) => [k, { ...v, isEnabled: false, printFlag: false, generateFlag: false }])));
      toast.success(t('toast_all_reports_disabled'));
    } catch { toast.error(t('toast_failed_generic')); }
  };

  return (
    <div style={s.page}>
      <h2 style={s.heading}>{t('heading_assign_reports')}</h2>

      {/* Step 1: Select Client */}
      {!selectedClient ? (
        <>
          <p style={s.sub}>{t('sub_select_user_assignments')}</p>
          <div style={s.tableWrap}>
            <table style={s.table}>
              <thead>
                <tr>
                  <th style={{ ...s.th, ...s.thNum }}>{t('col_sno')}</th>
                  <th style={{ ...s.th }}>{t('col_user_name')}</th>
                  <th style={{ ...s.th }}>{t('col_email')}</th>
                </tr>
              </thead>
              <tbody>
                {clients.length === 0 ? (
                  <tr><td colSpan={3} style={s.empty}>{t('empty_no_users')}</td></tr>
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
            <button style={s.backBtn} onClick={() => { setSelectedClient(null); setActiveModule(null); setReports([]); }}>← {t('back')}</button>
            <div style={s.clientInfo}>
              <strong>{selectedClient.NAME}</strong> — {selectedClient.EMAIL}
            </div>
            <button style={s.disableAllBtn} onClick={disableAll}>🚫 {t('disable_all_reports')}</button>
          </div>

          {/* Breadcrumb */}
          <div style={s.breadcrumb}>
            <span style={activeModule ? s.crumbLink : s.crumbCurrent} onClick={() => { setActiveModule(null); setReports([]); }}>
              📁 {t('modules')}
            </span>
            {activeModule && (
              <>
                <span style={s.sep}> › </span>
                <span style={s.crumbCurrent}>📂 {activeModule.displayName}</span>
              </>
            )}
          </div>

          {loading && <p style={s.loading}>{t('loading')}</p>}

          {/* Modules */}
          {!activeModule && !loading && (
            <div style={s.tableWrap}>
              <table style={s.table}>
                <thead>
                  <tr>
                    <th style={{ ...s.th, ...s.thNum }}>{t('col_sno')}</th>
                    <th style={{ ...s.th }}>{t('col_module_name')}</th>
                  </tr>
                </thead>
                <tbody>
                  {modules.length === 0 ? (
                    <tr><td colSpan={2} style={s.empty}>{t('empty_no_modules')}</td></tr>
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
                    <th style={{ ...s.th, ...s.thNum }}>{t('col_sno')}</th>
                    <th style={{ ...s.th }}>{t('col_report_name')}</th>
                    <th style={{ ...s.th}}>{t('col_role')}</th>
                    <th style={{ ...s.th, textAlign:'center' }}>{t('col_print')}</th>
                    <th style={{ ...s.th, textAlign:'center' }}>{t('col_generate')}</th>
                    <th style={{ ...s.th}}>{t('col_assigned')}</th>
                  </tr>
                </thead>
                <tbody>
                  {reports.length === 0
                    ? <tr><td colSpan={6} style={s.empty}>{t('empty_no_reports_in_module')}</td></tr>
                    : reports.map((r, i) => {
                        const entry        = assignments[r.absolutePath] || {};
                        const enabled      = !!entry.isEnabled;
                        const role         = entry.userRole || '';
                        const printFlag    = !!entry.printFlag;
                        const generateFlag = !!entry.generateFlag;
                        return (
                          <tr key={r.absolutePath} style={i % 2 === 0 ? s.rowEven : s.rowOdd}>
                            <td style={{ ...s.td, ...s.tdNum }}>{i + 1}</td>
                            <td style={s.td}>📄 {r.displayName}</td>
                            <td style={s.td}>
                              <select
                                style={s.roleSelect}
                                value={role}
                                onChange={e => changeRole(r, e.target.value)}
                              >
                                <option value="">{t('select_role_placeholder')}</option>
                                {roles.map(roleId => (
                                  <option key={roleId} value={roleId}>{roleId}</option>
                                ))}
                              </select>
                            </td>
                            <td style={{ ...s.td, textAlign:'center' }}>
                              <label style={{ ...s.toggleWrap, opacity: enabled ? 1 : 0.5, cursor: enabled ? 'pointer' : 'not-allowed' }}>
                                <input type="checkbox" style={{ display:'none' }} checked={printFlag} disabled={!enabled}
                                  onChange={e => toggleFlag(r, 'PRINT', e.target.checked)} />
                                <span style={{ ...s.toggleTrack, background: printFlag ? '#1976d2' : '#ccc' }}>
                                  <span style={{ ...s.toggleThumb, left: printFlag ? '20px' : '2px' }} />
                                </span>
                              </label>
                            </td>
                            <td style={{ ...s.td, textAlign:'center' }}>
                              <label style={{ ...s.toggleWrap, opacity: enabled ? 1 : 0.5, cursor: enabled ? 'pointer' : 'not-allowed' }}>
                                <input type="checkbox" style={{ display:'none' }} checked={generateFlag} disabled={!enabled}
                                  onChange={e => toggleFlag(r, 'GENERATE', e.target.checked)} />
                                <span style={{ ...s.toggleTrack, background: generateFlag ? '#1976d2' : '#ccc' }}>
                                  <span style={{ ...s.toggleThumb, left: generateFlag ? '20px' : '2px' }} />
                                </span>
                              </label>
                            </td>
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
  roleSelect:   { padding:'6px 10px', border:'1px solid #ddd', borderRadius:'6px', fontSize:'13px', minWidth:'120px' },
  toggleWrap:   { cursor:'pointer', display:'inline-block' },
  toggleTrack:  { display:'inline-block', width:'44px', height:'24px', borderRadius:'12px', position:'relative', transition:'background 0.2s' },
  toggleThumb:  { position:'absolute', top:'2px', width:'20px', height:'20px', borderRadius:'50%', background:'#fff', boxShadow:'0 1px 4px rgba(0,0,0,0.2)', transition:'left 0.2s' },
};
