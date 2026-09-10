import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import api from '../../api/axiosInstance';
import toast from 'react-hot-toast';
import { useReportEngine } from '../../context/ReportEngineContext';
import { useLanguage } from '../../context/LanguageContext';
import { LANGUAGES } from '../../constants/languages';

export default function Clients() {
  const { engine } = useReportEngine();
  const { t } = useLanguage();
  const [clients, setClients]   = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [editId, setEditId]     = useState(null);
  const [showPwdForm, setShowPwdForm] = useState(null);

  const { register, handleSubmit, reset, formState: { errors } } = useForm({ defaultValues: { report_language: 'en' } });
  const { register: regPwd, handleSubmit: handlePwd, reset: resetPwd, formState: { errors: pwdErrors } } = useForm();

  // USER_NAME is stored upper-cased in the DB — mirror that live as the admin types
  // so what's on screen always matches what will actually be saved.
  const userNameField = register('user_name', { required: 'Username is required', minLength: { value: 3, message: 'Min 3 characters' } });

  const fetchClients = async () => {
    try {
      const res = await api.get('/admin/clients');
      setClients(res.data.data);
    } catch { toast.error(t('toast_load_clients_failed')); }
  };

  useEffect(() => { if (engine) Promise.resolve().then(fetchClients); }, [engine]);

  const onSubmit = async (data) => {
    setLoading(true);
    try {
      if (editId) {
        await api.put(`/admin/clients/${editId}`, { name: data.name, user_name: data.user_name, report_language: data.report_language });
        toast.success(t('toast_client_updated'));
      } else {
        await api.post('/admin/clients', data);
        toast.success(t('toast_client_created'));
      }
      reset(); setShowForm(false); setEditId(null);
      fetchClients();
    } catch (err) {
      toast.error(err.response?.data?.message || t('toast_operation_failed'));
    } finally { setLoading(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm(t('confirm_delete_client'))) return;
    try {
      await api.delete(`/admin/clients/${id}`);
      toast.success(t('toast_client_deleted'));
      fetchClients();
    } catch { toast.error(t('toast_delete_failed')); }
  };

  const handleToggleActive = async (client) => {
    try {
      await api.put(`/admin/clients/${client.USER_ID}`, { is_active: client.IS_ACTIVE === 1 ? 0 : 1 });
      toast.success(t('toast_status_updated'));
      fetchClients();
    } catch { toast.error(t('toast_update_failed')); }
  };

  const onChangePwd = async (data) => {
    if (data.newPassword !== data.confirmPassword)
      return toast.error(t('toast_passwords_mismatch'));
    try {
      await api.put('/auth/change-password', { currentPassword: data.currentPassword, newPassword: data.newPassword });
      toast.success(t('toast_password_changed'));
      setShowPwdForm(null); resetPwd();
    } catch (err) { toast.error(err.response?.data?.message || t('toast_failed_generic')); }
  };

  return (
    <div style={s.page}>
      <div style={s.header}>
        <h2 style={s.heading}>{t('heading_user_management')}</h2>
        <button style={s.addBtn} onClick={() => { setShowForm(true); setEditId(null); reset({ report_language: 'en' }); }}>
          + {t('add_user')}
        </button>
      </div>

      {/* Create / Edit Form */}
      {showForm && (
        <div style={s.formCard}>
          <h3 style={s.formTitle}>{editId ? t('form_title_edit_client') : t('form_title_create_client')}</h3>
          <form onSubmit={handleSubmit(onSubmit)}>
            <div style={s.formRow}>
              <div style={s.field}>
                <label style={s.label}>{t('full_name')} *</label>
                <input style={s.input} {...register('name', { required: t('validation_name_required'), minLength: { value: 3, message: t('validation_min3') } })} />
                {errors.name && <span style={s.err}>{errors.name.message}</span>}
              </div>
              <div style={s.field}>
                <label style={s.label}>{t('username')} *</label>
                <input
                  style={s.input}
                  {...userNameField}
                  onChange={e => { e.target.value = e.target.value.toUpperCase(); userNameField.onChange(e); }}
                />
                {errors.user_name && <span style={s.err}>{errors.user_name.message}</span>}
              </div>
              <div style={s.field}>
                <label style={s.label}>{t('report_language')} *</label>
                <select style={s.input} {...register('report_language', { required: true })}>
                  {LANGUAGES.map(l => (
                    <option key={l.code} value={l.code}>{t(`lang_name_${l.code}`)}</option>
                  ))}
                </select>
              </div>
              {!editId && (
                <>
                  <div style={s.field}>
                    <label style={s.label}>{t('email')} *</label>
                    <input style={s.input} type="email" {...register('email', { required: t('validation_email_required'), pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: t('validation_email_invalid') } })} />
                    {errors.email && <span style={s.err}>{errors.email.message}</span>}
                  </div>
                  <div style={s.field}>
                    <label style={s.label}>{t('password')} *</label>
                    <input style={s.input} type="password" {...register('password', {
                      required: t('validation_password_required'),
                      pattern: { value: /^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*]).{8,}$/, message: t('validation_password_complexity') }
                    })} />
                    {errors.password && <span style={s.err}>{errors.password.message}</span>}
                  </div>
                </>
              )}
            </div>
            <div style={s.formActions}>
              <button style={s.submitBtn} type="submit" disabled={loading}>{loading ? t('saving') : t('save')}</button>
              <button style={s.cancelBtn} type="button" onClick={() => { setShowForm(false); reset(); setEditId(null); }}>{t('cancel')}</button>
            </div>
          </form>
        </div>
      )}

      {/* Password Change Form */}
      {showPwdForm && (
        <div style={s.formCard}>
          <h3 style={s.formTitle}>{t('form_title_change_password')}</h3>
          <form onSubmit={handlePwd(onChangePwd)}>
            <div style={s.formRow}>
              <div style={s.field}>
                <label style={s.label}>{t('current_password')} *</label>
                <input style={s.input} type="password" {...regPwd('currentPassword', { required: t('validation_required') })} />
                {pwdErrors.currentPassword && <span style={s.err}>{pwdErrors.currentPassword.message}</span>}
              </div>
              <div style={s.field}>
                <label style={s.label}>{t('new_password')} *</label>
                <input style={s.input} type="password" {...regPwd('newPassword', {
                  required: t('validation_required'),
                  pattern: { value: /^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*]).{8,}$/, message: t('validation_password_complexity') }
                })} />
                {pwdErrors.newPassword && <span style={s.err}>{pwdErrors.newPassword.message}</span>}
              </div>
              <div style={s.field}>
                <label style={s.label}>{t('confirm_password')} *</label>
                <input style={s.input} type="password" {...regPwd('confirmPassword', { required: t('validation_required') })} />
                {pwdErrors.confirmPassword && <span style={s.err}>{pwdErrors.confirmPassword.message}</span>}
              </div>
            </div>
            <div style={s.formActions}>
              <button style={s.submitBtn} type="submit">{t('update_password')}</button>
              <button style={s.cancelBtn} type="button" onClick={() => { setShowPwdForm(null); resetPwd(); }}>{t('cancel')}</button>
            </div>
          </form>
        </div>
      )}

      {/* Clients Table */}
      <div style={s.tableWrap}>
        <table style={s.table}>
          <thead>
            <tr>
              {[t('col_sno'), t('col_name'), t('col_username'), t('col_email'), t('col_report_server'), t('col_report_language'), t('col_status'), t('col_created'), t('col_actions')].map(h => (
                <th key={h} style={s.th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {clients.length === 0 ? (
              <tr><td colSpan={9} style={s.empty}>{t('empty_no_clients')}</td></tr>
            ) : clients.map((c, i) => (
              <tr key={c.USER_ID} style={i % 2 === 0 ? s.rowEven : s.rowOdd}>
                <td style={s.td}>{i + 1}</td>
                <td style={s.td}>{c.NAME}</td>
                <td style={s.td}>{c.USER_NAME}</td>
                <td style={s.td}>{c.EMAIL}</td>
                <td style={s.td}>{c.REPORT_SERVER}</td>
                <td style={s.td}>{t(`lang_name_${(c.REPORT_LANGUAGE || 'en').toLowerCase()}`)}</td>
                <td style={s.td}>
                  <span style={{ ...s.badge, background: c.IS_ACTIVE ? '#e8f5e9' : '#fce4ec', color: c.IS_ACTIVE ? '#2e7d32' : '#c62828' }}>
                    {c.IS_ACTIVE ? t('badge_active') : t('badge_inactive')}
                  </span>
                </td>
                <td style={s.td}>{new Date(c.CREATED_AT).toLocaleDateString()}</td>
                <td style={s.td}>
                  <button style={s.actionBtn} onClick={() => { setEditId(c.USER_ID); reset({ name: c.NAME, user_name: c.USER_NAME, report_language: (c.REPORT_LANGUAGE || 'EN').toLowerCase() }); setShowForm(true); }}>{t('action_edit')}</button>
                  <button style={{ ...s.actionBtn, background: '#fff3e0', color: '#e65100' }} onClick={() => handleToggleActive(c)}>
                    {c.IS_ACTIVE ? t('action_disable') : t('action_enable')}
                  </button>
                  <button style={{ ...s.actionBtn, background: '#e3f2fd', color: '#1565c0' }} onClick={() => setShowPwdForm(c.USER_ID)}>{t('action_pwd')}</button>
                  <button style={{ ...s.actionBtn, background: '#fce4ec', color: '#c62828' }} onClick={() => handleDelete(c.USER_ID)}>{t('action_delete')}</button>
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
  td:          { padding:'12px 16px', fontSize:'13px', color:'#333', textAlign:'left' },
  rowEven:     { background:'#fff' },
  rowOdd:      { background:'#f9fafb' },
  empty:       { padding:'24px', textAlign:'center', color:'#aaa' },
  badge:       { padding:'3px 10px', borderRadius:'12px', fontSize:'12px', fontWeight:600 },
  actionBtn:   { padding:'5px 10px', marginRight:'6px', background:'#e8f5e9', color:'#2e7d32', border:'none', borderRadius:'6px', cursor:'pointer', fontSize:'12px', fontWeight:600 },
};
