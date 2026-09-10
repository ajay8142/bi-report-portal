import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import api from '../../api/axiosInstance';
import toast from 'react-hot-toast';
import profinchLogo from '../../assets/profinchlogo.png';

// No user is logged in yet on this screen, so there's no assigned language to
// read — it always renders in the LanguageProvider's default (English).
const schema = yup.object({
  user_name: yup.string().trim().required('Username is required'),
  password:  yup.string().min(6, 'Min 6 characters').required('Password is required'),
});

export default function Login() {
  const { login } = useAuth();
  const { t } = useLanguage();
  const navigate  = useNavigate();
  const [loading, setLoading] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm({ resolver: yupResolver(schema) });

  const onSubmit = async (data) => {
    setLoading(true);
    try {
      const res = await api.post('/auth/login', data);
      login(res.data.token, res.data.user);
      toast.success(t('toast_welcome_back'));
      navigate(res.data.user.role === 'ADMIN' ? '/admin/dashboard' : '/client/generate');
    } catch (err) {
      toast.error(err.response?.data?.message || t('toast_login_failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={s.page}>
      <div style={s.card}>
        <div style={s.logoWrap}>
          <img src={profinchLogo} alt="Profinch" style={s.logo} />
          <h2 style={s.title}>{t('app_name')}</h2>
        </div>

        <form onSubmit={handleSubmit(onSubmit)}>
          <div style={s.field}>
            <label style={s.label}>{t('field_username')}</label>
            <input style={s.input} type="text" placeholder={t('placeholder_username')} {...register('user_name')} />
            {errors.user_name && <span style={s.err}>{errors.user_name.message}</span>}
          </div>
          <div style={s.field}>
            <label style={s.label}>{t('field_password')}</label>
            <input style={s.input} type="password" placeholder="••••••••" {...register('password')} />
            {errors.password && <span style={s.err}>{errors.password.message}</span>}
          </div>
          <button style={{ ...s.btn, opacity: loading ? 0.7 : 1 }} type="submit" disabled={loading}>
            {loading ? t('signing_in') : t('sign_in')}
          </button>
        </form>
      </div>
    </div>
  );
}

const s = {
  page:  {
    minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center',
    background:`
      radial-gradient(ellipse at 15% 20%,  rgba(21,101,192,0.75)  0%, transparent 45%),
      radial-gradient(ellipse at 70% 10%,  rgba(198,40,40,0.65)   0%, transparent 45%),
      radial-gradient(ellipse at 85% 80%,  rgba(106,27,154,0.75)  0%, transparent 45%),
      #0a0f1e
    `.replace(/\s+/g,' '),
  },
  card:  { background:'rgba(255,255,255,0.95)', padding:'40px', borderRadius:'16px', boxShadow:'0 8px 40px rgba(0,0,0,0.4)', width:'100%', maxWidth:'400px', backdropFilter:'blur(8px)' },
  logoWrap: { textAlign:'center', marginBottom:'16px' },
  logo:     { height:'56px', objectFit:'contain' },
  title:    { margin:'10px 0 0', fontSize:'22px', fontWeight:700, color:'#1a1a2e' },
  sub:   { textAlign:'center', color:'#888', marginBottom:'28px', fontSize:'14px' },
  field: { marginBottom:'16px' },
  label: { display:'block', marginBottom:'6px', fontSize:'13px', fontWeight:600, color:'#333' },
  input: { width:'100%', padding:'10px 12px', border:'1px solid #ddd', borderRadius:'8px', fontSize:'14px', boxSizing:'border-box' },
  err:   { color:'#e53935', fontSize:'12px', marginTop:'4px', display:'block' },
  btn:   { width:'100%', padding:'12px', background:'#1976d2', color:'#fff', border:'none', borderRadius:'8px', fontSize:'15px', fontWeight:600, cursor:'pointer', marginTop:'4px' },
};
