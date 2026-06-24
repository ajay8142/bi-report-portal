import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/axiosInstance';
import toast from 'react-hot-toast';

const schema = yup.object({
  email:    yup.string().email('Invalid email').required('Email is required'),
  password: yup.string().min(6, 'Min 6 characters').required('Password is required'),
});

export default function Login() {
  const { login } = useAuth();
  const navigate  = useNavigate();
  const [loading, setLoading] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm({ resolver: yupResolver(schema) });

  const onSubmit = async (data) => {
    setLoading(true);
    try {
      const res = await api.post('/auth/login', data);
      login(res.data.token, res.data.user);
      toast.success('Welcome back!');
      navigate(res.data.user.role === 'ADMIN' ? '/admin/dashboard' : '/client/generate');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={s.page}>
      <div style={s.card}>
        <div style={s.logo}>📊</div>
        <h2 style={s.title}>Profinch Reporting Tool</h2>
        <p style={s.sub}>Sign in to continue</p>
        <form onSubmit={handleSubmit(onSubmit)}>
          <div style={s.field}>
            <label style={s.label}>Email</label>
            <input style={s.input} type="email" placeholder="you@company.com" {...register('email')} />
            {errors.email && <span style={s.err}>{errors.email.message}</span>}
          </div>
          <div style={s.field}>
            <label style={s.label}>Password</label>
            <input style={s.input} type="password" placeholder="••••••••" {...register('password')} />
            {errors.password && <span style={s.err}>{errors.password.message}</span>}
          </div>
          <button style={{ ...s.btn, opacity: loading ? 0.7 : 1 }} type="submit" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}

const s = {
  page:  { minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#f0f2f5' },
  card:  { background:'#fff', padding:'40px', borderRadius:'12px', boxShadow:'0 4px 24px rgba(0,0,0,0.1)', width:'100%', maxWidth:'400px' },
  logo:  { textAlign:'center', fontSize:'40px', marginBottom:'8px' },
  title: { textAlign:'center', margin:'0 0 4px', fontSize:'24px', fontWeight:700, color:'#1a1a2e' },
  sub:   { textAlign:'center', color:'#888', marginBottom:'28px', fontSize:'14px' },
  field: { marginBottom:'16px' },
  label: { display:'block', marginBottom:'6px', fontSize:'13px', fontWeight:600, color:'#333' },
  input: { width:'100%', padding:'10px 12px', border:'1px solid #ddd', borderRadius:'8px', fontSize:'14px', boxSizing:'border-box' },
  err:   { color:'#e53935', fontSize:'12px', marginTop:'4px', display:'block' },
  btn:   { width:'100%', padding:'12px', background:'#1976d2', color:'#fff', border:'none', borderRadius:'8px', fontSize:'15px', fontWeight:600, cursor:'pointer', marginTop:'4px' },
};
