import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import api from '../../api/axiosInstance';
import toast from 'react-hot-toast';

export default function Clients() {
  const [clients, setClients]   = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [editId, setEditId]     = useState(null);
  const [showPwdForm, setShowPwdForm] = useState(null);

  const { register, handleSubmit, reset, formState: { errors } } = useForm();
  const { register: regPwd, handleSubmit: handlePwd, reset: resetPwd, formState: { errors: pwdErrors } } = useForm();

  const fetchClients = async () => {
    try {
      const res = await api.get('/admin/clients');
      setClients(res.data.data);
    } catch { toast.error('Failed to load clients'); }
  };

  useEffect(() => { fetchClients(); }, []);

  const onSubmit = async (data) => {
    setLoading(true);
    try {
      if (editId) {
        await api.put(`/admin/clients/${editId}`, { name: data.name });
        toast.success('Client updated');
      } else {
        await api.post('/admin/clients', data);
        toast.success('Client created');
      }
      reset(); setShowForm(false); setEditId(null);
      fetchClients();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Operation failed');
    } finally { setLoading(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this client?')) return;
    try {
      await api.delete(`/admin/clients/${id}`);
      toast.success('Client deleted');
      fetchClients();
    } catch { toast.error('Delete failed'); }
  };

  const handleToggleActive = async (client) => {
    try {
      await api.put(`/admin/clients/${client.USER_ID}`, { is_active: client.IS_ACTIVE === 1 ? 0 : 1 });
      toast.success('Status updated');
      fetchClients();
    } catch { toast.error('Update failed'); }
  };

  const onChangePwd = async (data) => {
    if (data.newPassword !== data.confirmPassword)
      return toast.error('Passwords do not match');
    try {
      await api.put('/auth/change-password', { currentPassword: data.currentPassword, newPassword: data.newPassword });
      toast.success('Password changed');
      setShowPwdForm(null); resetPwd();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
  };

  return (
    <div style={s.page}>
      <div style={s.header}>
        <h2 style={s.heading}>Client Management</h2>
        <button style={s.addBtn} onClick={() => { setShowForm(true); setEditId(null); reset(); }}>
          + Add Client
        </button>
      </div>

      {/* Create / Edit Form */}
      {showForm && (
        <div style={s.formCard}>
          <h3 style={s.formTitle}>{editId ? 'Edit Client' : 'Create New Client'}</h3>
          <form onSubmit={handleSubmit(onSubmit)}>
            <div style={s.formRow}>
              <div style={s.field}>
                <label style={s.label}>Full Name *</label>
                <input style={s.input} {...register('name', { required: 'Name is required', minLength: { value: 3, message: 'Min 3 characters' } })} />
                {errors.name && <span style={s.err}>{errors.name.message}</span>}
              </div>
              {!editId && (
                <>
                  <div style={s.field}>
                    <label style={s.label}>Email *</label>
                    <input style={s.input} type="email" {...register('email', { required: 'Email is required', pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Invalid email' } })} />
                    {errors.email && <span style={s.err}>{errors.email.message}</span>}
                  </div>
                  <div style={s.field}>
                    <label style={s.label}>Password *</label>
                    <input style={s.input} type="password" {...register('password', {
                      required: 'Password is required',
                      pattern: { value: /^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*]).{8,}$/, message: 'Min 8 chars, 1 uppercase, 1 number, 1 special char' }
                    })} />
                    {errors.password && <span style={s.err}>{errors.password.message}</span>}
                  </div>
                </>
              )}
            </div>
            <div style={s.formActions}>
              <button style={s.submitBtn} type="submit" disabled={loading}>{loading ? 'Saving…' : 'Save'}</button>
              <button style={s.cancelBtn} type="button" onClick={() => { setShowForm(false); reset(); setEditId(null); }}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Password Change Form */}
      {showPwdForm && (
        <div style={s.formCard}>
          <h3 style={s.formTitle}>Change Password</h3>
          <form onSubmit={handlePwd(onChangePwd)}>
            <div style={s.formRow}>
              <div style={s.field}>
                <label style={s.label}>Current Password *</label>
                <input style={s.input} type="password" {...regPwd('currentPassword', { required: 'Required' })} />
                {pwdErrors.currentPassword && <span style={s.err}>{pwdErrors.currentPassword.message}</span>}
              </div>
              <div style={s.field}>
                <label style={s.label}>New Password *</label>
                <input style={s.input} type="password" {...regPwd('newPassword', {
                  required: 'Required',
                  pattern: { value: /^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*]).{8,}$/, message: 'Min 8 chars, 1 uppercase, 1 number, 1 special char' }
                })} />
                {pwdErrors.newPassword && <span style={s.err}>{pwdErrors.newPassword.message}</span>}
              </div>
              <div style={s.field}>
                <label style={s.label}>Confirm Password *</label>
                <input style={s.input} type="password" {...regPwd('confirmPassword', { required: 'Required' })} />
                {pwdErrors.confirmPassword && <span style={s.err}>{pwdErrors.confirmPassword.message}</span>}
              </div>
            </div>
            <div style={s.formActions}>
              <button style={s.submitBtn} type="submit">Update Password</button>
              <button style={s.cancelBtn} type="button" onClick={() => { setShowPwdForm(null); resetPwd(); }}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Clients Table */}
      <div style={s.tableWrap}>
        <table style={s.table}>
          <thead>
            <tr>
              {['#','Name','Email','Status','Created','Actions'].map(h => (
                <th key={h} style={s.th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {clients.length === 0 ? (
              <tr><td colSpan={6} style={s.empty}>No clients found</td></tr>
            ) : clients.map((c, i) => (
              <tr key={c.USER_ID} style={i % 2 === 0 ? s.rowEven : s.rowOdd}>
                <td style={s.td}>{i + 1}</td>
                <td style={s.td}>{c.NAME}</td>
                <td style={s.td}>{c.EMAIL}</td>
                <td style={s.td}>
                  <span style={{ ...s.badge, background: c.IS_ACTIVE ? '#e8f5e9' : '#fce4ec', color: c.IS_ACTIVE ? '#2e7d32' : '#c62828' }}>
                    {c.IS_ACTIVE ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td style={s.td}>{new Date(c.CREATED_AT).toLocaleDateString()}</td>
                <td style={s.td}>
                  <button style={s.actionBtn} onClick={() => { setEditId(c.USER_ID); reset({ name: c.NAME }); setShowForm(true); }}>Edit</button>
                  <button style={{ ...s.actionBtn, background: '#fff3e0', color: '#e65100' }} onClick={() => handleToggleActive(c)}>
                    {c.IS_ACTIVE ? 'Disable' : 'Enable'}
                  </button>
                  <button style={{ ...s.actionBtn, background: '#e3f2fd', color: '#1565c0' }} onClick={() => setShowPwdForm(c.USER_ID)}>Pwd</button>
                  <button style={{ ...s.actionBtn, background: '#fce4ec', color: '#c62828' }} onClick={() => handleDelete(c.USER_ID)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const s = {
  page:        { padding:'32px' },
  header:      { display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'24px' },
  heading:     { fontSize:'22px', fontWeight:700, color:'#1a1a2e', margin:0 },
  addBtn:      { padding:'10px 20px', background:'#1976d2', color:'#fff', border:'none', borderRadius:'8px', cursor:'pointer', fontWeight:600 },
  formCard:    { background:'#fff', borderRadius:'10px', padding:'24px', marginBottom:'24px', boxShadow:'0 2px 10px rgba(0,0,0,0.08)' },
  formTitle:   { margin:'0 0 16px', fontSize:'16px', fontWeight:700, color:'#1a1a2e' },
  formRow:     { display:'flex', gap:'16px', flexWrap:'wrap' },
  field:       { flex:'1', minWidth:'200px' },
  label:       { display:'block', marginBottom:'6px', fontSize:'13px', fontWeight:600, color:'#333' },
  input:       { width:'100%', padding:'10px 12px', border:'1px solid #ddd', borderRadius:'8px', fontSize:'14px', boxSizing:'border-box' },
  err:         { color:'#e53935', fontSize:'12px', marginTop:'4px', display:'block' },
  formActions: { marginTop:'16px', display:'flex', gap:'12px' },
  submitBtn:   { padding:'10px 24px', background:'#1976d2', color:'#fff', border:'none', borderRadius:'8px', cursor:'pointer', fontWeight:600 },
  cancelBtn:   { padding:'10px 24px', background:'#f5f5f5', color:'#333', border:'none', borderRadius:'8px', cursor:'pointer', fontWeight:600 },
  tableWrap:   { overflowX:'auto' },
  table:       { width:'100%', borderCollapse:'collapse', background:'#fff', borderRadius:'10px', overflow:'hidden', boxShadow:'0 2px 10px rgba(0,0,0,0.08)' },
  th:          { padding:'12px 16px', background:'#1976d2', color:'#fff', textAlign:'left', fontSize:'13px', fontWeight:600 },
  td:          { padding:'12px 16px', fontSize:'13px', color:'#333' },
  rowEven:     { background:'#fff' },
  rowOdd:      { background:'#f9fafb' },
  empty:       { padding:'24px', textAlign:'center', color:'#aaa' },
  badge:       { padding:'3px 10px', borderRadius:'12px', fontSize:'12px', fontWeight:600 },
  actionBtn:   { padding:'5px 10px', marginRight:'6px', background:'#e8f5e9', color:'#2e7d32', border:'none', borderRadius:'6px', cursor:'pointer', fontSize:'12px', fontWeight:600 },
};
