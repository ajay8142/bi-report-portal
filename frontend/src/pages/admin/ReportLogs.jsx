import { useState, useEffect } from 'react';
import api from '../../api/axiosInstance';
import toast from 'react-hot-toast';
import { useReportEngine } from '../../context/ReportEngineContext';

function formatDateTime(raw) {
  if (!raw) return '—';
  const d = new Date(raw);
  if (isNaN(d)) return raw;
  return d.toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true,
  });
}

export default function ReportLogs() {
  const { engine } = useReportEngine();
  const [clients,        setClients]        = useState([]);
  const [selectedClient, setSelectedClient]  = useState(null);
  const [rows,           setRows]            = useState([]);
  const [search,         setSearch]          = useState('');
  const [loadingClients, setLoadingClients]  = useState(true);
  const [loadingHistory, setLoadingHistory]  = useState(false);

  useEffect(() => {
    if (!engine) return;
    // A previously selected client may belong to the edition we just switched
    // away from — drop it and go back to the client list.
    Promise.resolve()
      .then(() => { setSelectedClient(null); setRows([]); setLoadingClients(true); })
      .then(() => api.get('/admin/clients'))
      .then(r => setClients(r.data.data))
      .catch(() => toast.error('Failed to load users'))
      .finally(() => setLoadingClients(false));
  }, [engine]);

  const selectClient = async (client) => {
    setSelectedClient(client);
    setSearch('');
    setLoadingHistory(true);
    try {
      const res = await api.get(`/admin/history/${client.USER_ID}`);
      setRows(res.data.data || []);
    } catch { toast.error('Failed to load report history'); }
    finally  { setLoadingHistory(false); }
  };

  const filtered = rows.filter(row => {
    const q    = search.toLowerCase();
    const name = (row.REPORT_NAME || '').toLowerCase();
    const fmt  = (row.FORMAT || '').toLowerCase();
    return name.includes(q) || fmt.includes(q);
  });

  return (
    <div style={s.page}>
      <h2 style={s.heading}>Report Logs</h2>

      {!selectedClient ? (
        <>
          <p style={s.sub}>Select a User to view their report history:</p>
          <div style={s.tableWrap}>
            <table style={s.table}>
              <thead>
                <tr>
                  <th style={{ ...s.th, ...s.thNum }}>S No.</th>
                  <th style={s.th}>User Name</th>
                  <th style={s.th}>Email</th>
                </tr>
              </thead>
              <tbody>
                {loadingClients ? (
                  <tr><td colSpan={3} style={s.empty}>Loading…</td></tr>
                ) : clients.length === 0 ? (
                  <tr><td colSpan={3} style={s.empty}>No Users found</td></tr>
                ) : clients.map((c, i) => (
                  <tr
                    key={c.USER_ID}
                    style={{ ...(i % 2 === 0 ? s.rowEven : s.rowOdd), cursor: 'pointer' }}
                    onClick={() => selectClient(c)}
                    onMouseEnter={e => e.currentTarget.style.background = '#e3f2fd'}
                    onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? '#fff' : '#f9fafb'}
                  >
                    <td style={{ ...s.td, ...s.tdNum }}>{i + 1}</td>
                    <td style={s.td}>👤 {c.NAME}</td>
                    <td style={{ ...s.td, color: '#888' }}>{c.EMAIL}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <>
          <div style={s.clientHeader}>
            <button style={s.backBtn} onClick={() => { setSelectedClient(null); setRows([]); }}>← Back</button>
            <div style={s.clientInfo}>
              <strong>{selectedClient.NAME}</strong> — {selectedClient.EMAIL}
            </div>
          </div>

          <div style={s.toolbar}>
            <input
              style={s.search}
              placeholder="Search by report name or format…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <span style={s.count}>{filtered.length} record{filtered.length !== 1 ? 's' : ''}</span>
          </div>

          {loadingHistory ? (
            <p style={s.msg}>Loading…</p>
          ) : filtered.length === 0 ? (
            <p style={s.msg}>{search ? 'No matching records.' : 'No report history yet.'}</p>
          ) : (
            <div style={s.tableWrap}>
              <table style={s.table}>
                <thead>
                  <tr>
                    {['S No.', 'Report Name', 'Format', 'Action', 'IP Address', 'Date & Time'].map(h => (
                      <th key={h} style={s.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row, i) => (
                    <tr key={row.LOG_ID} style={i % 2 === 0 ? s.rowEven : s.rowOdd}>
                      <td style={{ ...s.td, ...s.tdNum }}>{filtered.length - i}</td>
                      <td style={s.td}>{row.REPORT_NAME || '—'}</td>
                      <td style={s.td}>
                        <span style={{ ...s.badge, ...s.fmtColor(row.FORMAT) }}>
                          {(row.FORMAT || '—').toUpperCase()}
                        </span>
                      </td>
                      <td style={s.td}>
                        <span style={{ ...s.badge, ...(row.ACTION === 'GENERATE' ? s.generateBadge : s.printBadge) }}>
                          {row.ACTION === 'GENERATE' ? '👁 Generate' : '🖨 Print'}
                        </span>
                      </td>
                      <td style={{ ...s.td, ...s.tdIp }}>{row.IP_ADDRESS || '—'}</td>
                      <td style={{ ...s.td, ...s.tdDate }}>{formatDateTime(row.CREATED_AT)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

const FORMAT_COLORS = {
  pdf:  { background: '#fde8e8', color: '#c62828' },
  xlsx: { background: '#e8f5e9', color: '#2e7d32' },
  xls:  { background: '#e8f5e9', color: '#2e7d32' },
  csv:  { background: '#e3f2fd', color: '#1565c0' },
  html: { background: '#fff3e0', color: '#e65100' },
  rtf:  { background: '#f3e5f5', color: '#6a1b9a' },
  xml:  { background: '#e0f2f1', color: '#00695c' },
};

const s = {
  page:         { padding: '32px' },
  heading:      { fontSize: '22px', fontWeight: 700, color: '#1a1a2e', marginBottom: '8px' },
  sub:          { color: '#666', marginBottom: '20px' },
  clientHeader: { display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px', flexWrap: 'wrap' },
  backBtn:      { padding: '8px 16px', background: '#f5f5f5', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 },
  clientInfo:   { flex: 1, color: '#333', fontSize: '14px' },
  toolbar:      { display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' },
  search:       { flex: 1, maxWidth: '340px', padding: '8px 14px', border: '1px solid #ddd', borderRadius: '8px', fontSize: '14px', outline: 'none' },
  count:        { fontSize: '13px', color: '#888' },
  msg:          { color: '#888', fontSize: '14px', marginTop: '20px' },
  tableWrap:    { overflowX: 'auto', background: '#fff', borderRadius: '10px', boxShadow: '0 2px 10px rgba(0,0,0,0.08)' },
  table:        { width: '100%', borderCollapse: 'collapse', background: '#fff', borderRadius: '10px', overflow: 'hidden' },
  th:           { padding: '12px 16px', background: '#1976d2', color: '#fff', textAlign: 'left', fontSize: '13px', fontWeight: 600 },
  thNum:        { width: '70px', textAlign: 'center' },
  td:           { padding: '12px 16px', fontSize: '13px', color: '#333', verticalAlign: 'middle', textAlign: 'left' },
  tdNum:        { width: '70px', textAlign: 'center', color: '#aaa', fontWeight: 600 },
  tdIp:         { whiteSpace: 'nowrap', color: '#888', fontSize: '12px' },
  tdDate:       { whiteSpace: 'nowrap', color: '#555' },
  rowEven:      { background: '#fff' },
  rowOdd:       { background: '#f9fafb' },
  empty:        { padding: '24px', textAlign: 'center', color: '#aaa' },
  badge:        { display: 'inline-block', padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 700 },
  generateBadge:{ background: '#e8f5e9', color: '#2e7d32' },
  printBadge:   { background: '#e3f2fd', color: '#1565c0' },
  fmtColor:     (fmt) => FORMAT_COLORS[(fmt || '').toLowerCase()] || { background: '#f0f0f0', color: '#555' },
};
