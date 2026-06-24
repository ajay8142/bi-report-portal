import { useState, useEffect } from 'react';
import api from '../../api/axiosInstance';
import toast from 'react-hot-toast';

export default function UserAccess() {
  const [users,        setUsers]        = useState([]);
  const [selected,     setSelected]     = useState(null);
  const [accessData,   setAccessData]   = useState(null);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingAC,    setLoadingAC]    = useState(false);
  const [newType,      setNewType]      = useState('');
  const [addingType,   setAddingType]   = useState(false);
  const [newValues,    setNewValues]    = useState({});

  const fetchUsers = async () => {
    try {
      const res = await api.get('/admin/access-control/users');
      setUsers(res.data.data);
    } catch {
      toast.error('Failed to load users');
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  const fetchAccess = async (userId) => {
    setLoadingAC(true);
    setAccessData(null);
    try {
      const res = await api.get(`/admin/access-control/${userId}`);
      setAccessData(res.data.data || {});
    } catch {
      toast.error('Failed to load access control');
      setAccessData({});
    } finally {
      setLoadingAC(false);
    }
  };

  const handleManage = (user) => {
    if (selected?.USER_ID === user.USER_ID) {
      setSelected(null);
      setAccessData(null);
      return;
    }
    setSelected(user);
    setNewType('');
    setNewValues({});
    fetchAccess(user.USER_ID);
  };

  const refresh = async () => {
    await fetchAccess(selected.USER_ID);
    fetchUsers();
  };

  const handleAddType = async () => {
    if (!newType.trim()) return toast.error('Type name is required');
    setAddingType(true);
    try {
      await api.post(`/admin/access-control/${selected.USER_ID}/types`, { type: newType.trim() });
      toast.success('Access type added');
      setNewType('');
      await refresh();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add type');
    } finally {
      setAddingType(false);
    }
  };

  const handleDeleteType = async (type) => {
    if (!window.confirm(`Delete "${type}" and all its values?`)) return;
    try {
      await api.delete(`/admin/access-control/${selected.USER_ID}/types/${type}`);
      toast.success('Access type removed');
      await refresh();
    } catch {
      toast.error('Failed to remove type');
    }
  };

  const handleAddValue = async (type) => {
    const val = (newValues[type] || '').trim();
    if (!val) return toast.error('Value is required');
    try {
      await api.post(`/admin/access-control/${selected.USER_ID}/values`, { type, value: val });
      toast.success('Value added');
      setNewValues(prev => ({ ...prev, [type]: '' }));
      await refresh();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add value');
    }
  };

  const handleDeleteValue = async (type, value) => {
    try {
      await api.delete(`/admin/access-control/${selected.USER_ID}/values`, {
        data: { type, value },
      });
      toast.success('Value removed');
      await refresh();
    } catch {
      toast.error('Failed to remove value');
    }
  };

  return (
    <div style={s.page}>
      <h2 style={s.heading}>User Access Control</h2>

      {/* ── Users Table ─────────────────────────────────────────── */}
      <div style={s.tableWrap}>
        <table style={s.table}>
          <thead>
            <tr>
              <th style={{ ...s.th, ...s.thNum }}>S No.</th>
              <th style={s.th}>Name</th>
              <th style={s.th}>Email</th>
              <th style={{ ...s.th, textAlign: 'center' }}>Status</th>
              <th style={{ ...s.th, textAlign: 'center' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {loadingUsers ? (
              <tr><td colSpan={5} style={s.emptyCell}>Loading…</td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan={5} style={s.emptyCell}>No users found.</td></tr>
            ) : users.map((u, i) => (
              <tr
                key={u.USER_ID}
                style={{
                  ...(i % 2 === 0 ? s.rowEven : s.rowOdd),
                  ...(selected?.USER_ID === u.USER_ID ? s.rowSelected : {}),
                }}
              >
                <td style={{ ...s.td, ...s.tdNum }}>{i + 1}</td>
                <td style={{ ...s.td, fontWeight: 600 }}>{u.NAME}</td>
                <td style={s.td}>{u.EMAIL}</td>
                <td style={{ ...s.td, textAlign: 'center' }}>
                  <span style={u.HAS_ACCESS ? s.badgeBlue : s.badgeGray}>
                    {u.HAS_ACCESS ? 'Configured' : 'No Config'}
                  </span>
                </td>
                <td style={{ ...s.td, textAlign: 'center' }}>
                  <button
                    style={selected?.USER_ID === u.USER_ID ? s.manageBtnActive : s.manageBtn}
                    onClick={() => handleManage(u)}
                  >
                    {selected?.USER_ID === u.USER_ID ? 'Close ▲' : 'Manage ▼'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Access Control Section ───────────────────────────────── */}
      {selected && (
        <div style={s.acSection}>
          <div style={s.acHeader}>
            <span style={s.acTitle}>
              Access Control — <strong>{selected.NAME}</strong>
            </span>
            <div style={s.addTypeRow}>
              <input
                style={s.typeInput}
                placeholder="New access type (e.g. BRANCH_CODE, CURRENCY)"
                value={newType}
                onChange={e => setNewType(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddType()}
              />
              <button style={s.primaryBtn} onClick={handleAddType} disabled={addingType}>
                {addingType ? 'Adding…' : '+ Add Type'}
              </button>
            </div>
          </div>

          {loadingAC ? (
            <p style={s.hint}>Loading access control…</p>
          ) : (
            <div style={s.tableWrap}>
              <table style={s.table}>
                <thead>
                  <tr>
                    <th style={{ ...s.th, ...s.thNum }}>S No.</th>
                    <th style={s.th}>Access Type</th>
                    <th style={s.th}>Values</th>
                    <th style={s.th}>Add Value</th>
                    <th style={{ ...s.th, textAlign: 'center' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {!accessData || Object.keys(accessData).length === 0 ? (
                    <tr>
                      <td colSpan={5} style={s.emptyCell}>
                        No access types configured. Add one using the form above.
                      </td>
                    </tr>
                  ) : Object.entries(accessData).map(([type, values], i) => (
                    <tr key={type} style={i % 2 === 0 ? s.rowEven : s.rowOdd}>
                      <td style={{ ...s.td, ...s.tdNum }}>{i + 1}</td>
                      <td style={{ ...s.td, fontWeight: 700 }}>{type}</td>
                      <td style={s.td}>
                        <div style={s.chipsWrap}>
                          {values.length === 0 ? (
                            <span style={s.noValues}>—</span>
                          ) : values.map(val => (
                            <span key={val} style={s.chip}>
                              {val}
                              <button
                                style={s.chipDel}
                                onClick={() => handleDeleteValue(type, val)}
                                title="Remove"
                              >✕</button>
                            </span>
                          ))}
                        </div>
                      </td>
                      <td style={s.td}>
                        <div style={s.addValueRow}>
                          <input
                            style={s.valueInput}
                            placeholder="New value…"
                            value={newValues[type] || ''}
                            onChange={e => setNewValues(p => ({ ...p, [type]: e.target.value }))}
                            onKeyDown={e => e.key === 'Enter' && handleAddValue(type)}
                          />
                          <button style={s.addValueBtn} onClick={() => handleAddValue(type)}>
                            + Add
                          </button>
                        </div>
                      </td>
                      <td style={{ ...s.td, textAlign: 'center' }}>
                        <button style={s.deleteTypeBtn} onClick={() => handleDeleteType(type)}>
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const s = {
  page:          { padding: '32px' },
  heading:       { fontSize: 22, fontWeight: 700, color: '#1a1a2e', marginBottom: 20, textAlign: 'center' },

  tableWrap:     { overflowX: 'auto' },
  table:         { width: '100%', borderCollapse: 'collapse', background: '#fff', borderRadius: 10,
                   overflow: 'hidden', boxShadow: '0 2px 10px rgba(0,0,0,0.08)' },
  th:            { padding: '12px 16px', background: '#1976d2', color: '#fff', textAlign: 'left',
                   fontSize: 13, fontWeight: 600 },
  thNum:         { width: 70, textAlign: 'center' },
  td:            { padding: '12px 16px', fontSize: 13, color: '#333', verticalAlign: 'middle', textAlign: 'left' },
  tdNum:         { width: 70, textAlign: 'center', color: '#aaa', fontWeight: 600 },
  rowEven:       { background: '#fff' },
  rowOdd:        { background: '#f9fafb' },
  rowSelected:   { background: '#e3f2fd' },
  emptyCell:     { padding: '28px', textAlign: 'left', color: '#aaa', fontSize: 13 },

  badgeBlue:     { display: 'inline-block', fontSize: 11, fontWeight: 700, padding: '3px 10px',
                   borderRadius: 10, background: '#1976d2', color: '#fff' },
  badgeGray:     { display: 'inline-block', fontSize: 11, fontWeight: 700, padding: '3px 10px',
                   borderRadius: 10, background: '#e0e0e0', color: '#666' },

  manageBtn:     { padding: '5px 14px', background: '#f0f4ff', color: '#1976d2',
                   border: '1px solid #c5cae9', borderRadius: 6, cursor: 'pointer',
                   fontSize: 12, fontWeight: 600 },
  manageBtnActive:{ padding: '5px 14px', background: '#1976d2', color: '#fff',
                    border: '1px solid #1976d2', borderRadius: 6, cursor: 'pointer',
                    fontSize: 12, fontWeight: 600 },

  /* Access control section */
  acSection:     { marginTop: 24 },
  acHeader:      { display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                   flexWrap: 'wrap', gap: 12, marginBottom: 12 },
  acTitle:       { fontSize: 15, color: '#1a1a2e' },
  addTypeRow:    { display: 'flex', gap: 10 },
  typeInput:     { padding: '8px 12px', border: '1px solid #ddd', borderRadius: 8,
                   fontSize: 13, outline: 'none', minWidth: 300 },
  primaryBtn:    { padding: '8px 18px', background: '#1976d2', color: '#fff', border: 'none',
                   borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13,
                   whiteSpace: 'nowrap' },

  chipsWrap:     { display: 'flex', flexWrap: 'wrap', gap: 6 },
  chip:          { display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px',
                   background: '#e3f2fd', color: '#1565c0', borderRadius: 20,
                   fontSize: 12, fontWeight: 600 },
  chipDel:       { background: 'none', border: 'none', cursor: 'pointer', color: '#1565c0',
                   fontSize: 11, lineHeight: 1, padding: 0 },
  noValues:      { fontSize: 12, color: '#bbb', fontStyle: 'italic' },

  addValueRow:   { display: 'flex', gap: 8 },
  valueInput:    { flex: 1, minWidth: 100, padding: '6px 10px', border: '1px solid #ddd',
                   borderRadius: 6, fontSize: 12, outline: 'none' },
  addValueBtn:   { padding: '6px 12px', background: '#e8f5e9', color: '#2e7d32',
                   border: '1px solid #c8e6c9', borderRadius: 6, cursor: 'pointer',
                   fontWeight: 700, fontSize: 12, whiteSpace: 'nowrap' },
  deleteTypeBtn: { padding: '4px 12px', background: '#fce4ec', color: '#c62828', border: 'none',
                   borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600 },

  hint:          { color: '#aaa', fontSize: 13, padding: '16px', textAlign: 'center' },
};
