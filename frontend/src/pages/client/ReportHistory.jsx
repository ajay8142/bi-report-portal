import { useState, useEffect } from 'react';
import api from '../../api/axiosInstance';
import toast from 'react-hot-toast';

function formatDateTime(raw) {
  if (!raw) return '—';
  const d = new Date(raw);
  if (isNaN(d)) return raw;
  return d.toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true,
  });
}

export default function ReportHistory() {
  const [rows,    setRows]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState('');

  useEffect(() => {
    api.get('/client/history')
      .then(r => setRows(r.data.data || []))
      .catch(() => toast.error('Failed to load report history'))
      .finally(() => setLoading(false));
  }, []);

  const filtered = rows.filter(row => {
    const q    = search.toLowerCase();
    const name = (row.REPORT_NAME || '').toLowerCase();
    const fmt  = (row.FORMAT || '').toLowerCase();
    return name.includes(q) || fmt.includes(q);
  });

  return (
    <div style={s.page}>
      <h2 style={s.heading}>Report History</h2>
      <p style={s.sub}>All reports you have generated, most recent first.</p>

      <div style={s.toolbar}>
        <input
          style={s.search}
          placeholder="Search by report name or format…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <span style={s.count}>{filtered.length} record{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {loading ? (
        <p style={s.msg}>Loading…</p>
      ) : filtered.length === 0 ? (
        <p style={s.msg}>{search ? 'No matching records.' : 'No report history yet.'}</p>
      ) : (
        <div style={s.tableWrap}>
          <table style={s.table}>
            <thead>
              <tr>
                {['S No.', 'Report Name', 'Format', 'Action', 'Date & Time'].map(h => (
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
                    <span style={{ ...s.badge, ...(row.ACTION === 'preview' ? s.previewBadge : s.downloadBadge) }}>
                      {row.ACTION === 'preview' ? '👁 Preview' : '⬇ Download'}
                    </span>
                  </td>
                  <td style={{ ...s.td, ...s.tdDate }}>{formatDateTime(row.CREATED_AT)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
  heading:      { fontSize: '22px', fontWeight: 700, color: '#1a1a2e', marginBottom: '4px' },
  sub:          { fontSize: '13px', color: '#888', marginBottom: '20px' },
  toolbar:      { display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' },
  search:       { flex: 1, maxWidth: '340px', padding: '8px 14px', border: '1px solid #ddd', borderRadius: '8px', fontSize: '14px', outline: 'none' },
  count:        { fontSize: '13px', color: '#888' },
  msg:          { color: '#888', fontSize: '14px', marginTop: '20px' },
  tableWrap:    { background: '#fff', borderRadius: '12px', boxShadow: '0 2px 12px rgba(0,0,0,0.07)', overflow: 'hidden' },
  table:        { width: '100%', borderCollapse: 'collapse', fontSize: '13px' },
  th:           { padding: '12px 16px', textAlign: 'center', background: '#1a1a2e', color: '#fff', fontWeight: 600, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' },
  td:           { padding: '11px 16px', color: '#333', verticalAlign: 'middle' },
  tdNum:        { color: '#aaa', width: '48px', textAlign: 'center' },
  tdDate:       { whiteSpace: 'nowrap', color: '#555' },
  rowEven:      { background: '#fff' },
  rowOdd:       { background: '#f9f9fb' },
  badge:        { display: 'inline-block', padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 700 },
  previewBadge: { background: '#e8f5e9', color: '#2e7d32' },
  downloadBadge:{ background: '#e3f2fd', color: '#1565c0' },
  fmtColor:     (fmt) => FORMAT_COLORS[(fmt || '').toLowerCase()] || { background: '#f0f0f0', color: '#555' },
};
