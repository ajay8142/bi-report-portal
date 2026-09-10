import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import api from '../../api/axiosInstance';
import toast from 'react-hot-toast';

export default function Profile() {
  const { logout, updateUser } = useAuth();
  const { t } = useLanguage();
  const [profile, setProfile] = useState(null);
  const [showPwd, setShowPwd] = useState(false);
  const { register, handleSubmit, reset, formState: { errors } } = useForm();

  useEffect(() => {
    api.get('/client/profile')
      .then(r => {
        setProfile(r.data.data);
        // Keeps the portal's UI/report language in sync if an admin changed it
        // for this user since they last logged in.
        updateUser({ language: r.data.data.language });
      })
      .catch(() => toast.error(t('toast_load_profile_failed')));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount
  }, []);

  const onChangePwd = async (data) => {
    if (data.newPassword !== data.confirmPassword)
      return toast.error(t('toast_passwords_mismatch'));
    try {
      await api.put('/auth/change-password', {
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      });
      toast.success(t('toast_password_updated_success'));
      setShowPwd(false);
      reset();
    } catch (err) {
      toast.error(err.response?.data?.message || t('toast_password_update_failed'));
    }
  };

  if (!profile) return <div style={s.page}><p>{t('loading')}</p></div>;

  return (
    <div style={s.page}>
      <h2 style={s.heading}>{t('heading_my_profile')}</h2>

      <div style={s.card}>
        <div style={s.avatarWrap}>
          <div style={s.avatar}>{profile.NAME?.[0]?.toUpperCase()}</div>
        </div>
        <div style={s.infoGrid}>
          <div style={s.infoItem}>
            <span style={s.infoLabel}>{t('full_name')}</span>
            <span style={s.infoVal}>{profile.NAME}</span>
          </div>
          <div style={s.infoItem}>
            <span style={s.infoLabel}>{t('email')}</span>
            <span style={s.infoVal}>{profile.EMAIL}</span>
          </div>
          <div style={s.infoItem}>
            <span style={s.infoLabel}>{t('role')}</span>
            <span style={{ ...s.badge, background:'#e3f2fd', color:'#1565c0' }}>{profile.ROLE}</span>
          </div>
          <div style={s.infoItem}>
            <span style={s.infoLabel}>{t('report_language')}</span>
            <span style={s.infoVal}>{t(`lang_name_${(profile.language || 'en').toLowerCase()}`)}</span>
          </div>
          <div style={s.infoItem}>
            <span style={s.infoLabel}>{t('member_since')}</span>
            <span style={s.infoVal}>{new Date(profile.CREATED_AT).toLocaleDateString()}</span>
          </div>
        </div>
        <div style={s.actions}>
          <button style={s.pwdBtn} onClick={() => setShowPwd(!showPwd)}>
            {showPwd ? t('cancel') : `🔒 ${t('change_password')}`}
          </button>
          <button style={s.logoutBtn} onClick={logout}>{t('logout')}</button>
        </div>
      </div>

      {showPwd && (
        <div style={s.formCard}>
          <h3 style={s.formTitle}>{t('change_password')}</h3>
          <form onSubmit={handleSubmit(onChangePwd)}>
            <div style={s.formRow}>
              <div style={s.field}>
                <label style={s.label}>{t('current_password')} *</label>
                <input style={s.input} type="password" {...register('currentPassword', { required: t('validation_required') })} />
                {errors.currentPassword && <span style={s.err}>{errors.currentPassword.message}</span>}
              </div>
              <div style={s.field}>
                <label style={s.label}>{t('new_password')} *</label>
                <input style={s.input} type="password" {...register('newPassword', {
                  required: t('validation_required'),
                  pattern: { value: /^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*]).{8,}$/, message: t('validation_password_complexity') }
                })} />
                {errors.newPassword && <span style={s.err}>{errors.newPassword.message}</span>}
              </div>
              <div style={s.field}>
                <label style={s.label}>{t('confirm_password')} *</label>
                <input style={s.input} type="password" {...register('confirmPassword', { required: t('validation_required') })} />
                {errors.confirmPassword && <span style={s.err}>{errors.confirmPassword.message}</span>}
              </div>
            </div>
            <button style={s.submitBtn} type="submit">{t('update_password')}</button>
          </form>
        </div>
      )}
    </div>
  );
}

const s = {
  page:      { padding:'32px', maxWidth:'800px', margin:'0 auto', display:'flex', flexDirection:'column', alignItems:'center' },
  heading:   { fontSize:'22px', fontWeight:700, color:'#1a1a2e', marginBottom:'24px', textAlign:'center', width:'100%' },
  card:      { background:'#fff', borderRadius:'12px', padding:'32px', boxShadow:'0 2px 12px rgba(0,0,0,0.08)', width:'100%' },
  avatarWrap:{ textAlign:'center', marginBottom:'24px' },
  avatar:    { width:'80px', height:'80px', borderRadius:'50%', background:'#1976d2', color:'#fff', display:'inline-flex', alignItems:'center', justifyContent:'center', fontSize:'36px', fontWeight:700 },
  infoGrid:  { display:'grid', gridTemplateColumns:'1fr 1fr', gap:'20px', marginBottom:'24px' },
  infoItem:  { display:'flex', flexDirection:'column', gap:'4px' },
  infoLabel: { fontSize:'12px', color:'#888', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.5px' },
  infoVal:   { fontSize:'16px', color:'#1a1a2e', fontWeight:500 },
  badge:     { display:'inline-block', padding:'4px 12px', borderRadius:'20px', fontSize:'13px', fontWeight:600 },
  actions:   { display:'flex', gap:'12px' },
  pwdBtn:    { padding:'10px 20px', background:'#1976d2', color:'#fff', border:'none', borderRadius:'8px', cursor:'pointer', fontWeight:600 },
  logoutBtn: { padding:'10px 20px', background:'#fce4ec', color:'#c62828', border:'none', borderRadius:'8px', cursor:'pointer', fontWeight:600 },
  formCard:  { background:'#fff', borderRadius:'12px', padding:'28px', boxShadow:'0 2px 12px rgba(0,0,0,0.08)', marginTop:'24px', width:'100%' },
  formTitle: { margin:'0 0 20px', fontSize:'16px', fontWeight:700, color:'#1a1a2e' },
  formRow:   { display:'flex', gap:'16px', flexWrap:'wrap', marginBottom:'16px' },
  field:     { flex:'1', minWidth:'200px' },
  label:     { display:'block', marginBottom:'6px', fontSize:'13px', fontWeight:600, color:'#333' },
  input:     { width:'100%', padding:'10px 12px', border:'1px solid #ddd', borderRadius:'8px', fontSize:'14px', boxSizing:'border-box' },
  err:       { color:'#e53935', fontSize:'12px', marginTop:'4px', display:'block' },
  submitBtn: { padding:'10px 24px', background:'#1976d2', color:'#fff', border:'none', borderRadius:'8px', cursor:'pointer', fontWeight:600 },
};
