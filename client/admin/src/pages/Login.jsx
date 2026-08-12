import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { API_BASE } from '../services/apiClient';
import toast from 'react-hot-toast';
import { HiOutlineMail, HiOutlineLockClosed, HiOutlineShieldCheck } from 'react-icons/hi';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error('Please enter email and password');
      return;
    }

    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        toast.error(errData.error || 'Login failed');
        return;
      }

      const data = await res.json();
      setAuth(data.user, data.token);
      toast.success('Signed in');
      navigate('/users');
    } catch (err) {
      toast.error('Login failed. Check your connection.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-bgDark relative overflow-hidden">
      <div className="absolute inset-0 opacity-40 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-indigo-500/30 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-pink-500/20 rounded-full blur-[120px]" />
      </div>

      <div className="relative w-full max-w-md glass p-8 border border-white/10">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 bg-indigo-500 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/40">
            <HiOutlineShieldCheck className="text-white text-2xl" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-white">
              Comedy<span className="text-indigo-400">Admin</span>
            </h1>
            <p className="text-slate-400 text-sm">Sign in to manage users</p>
          </div>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-widest text-slate-400">
              Email
            </span>
            <div className="relative mt-2">
              <HiOutlineMail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="email"
                autoComplete="email"
                placeholder="admin@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-white/5 border border-white/10 rounded-xl pl-12 pr-4 py-3 outline-none focus:border-indigo-500 transition-all w-full text-white placeholder:text-slate-500"
                required
              />
            </div>
          </label>

          <label className="block">
            <span className="text-xs font-bold uppercase tracking-widest text-slate-400">
              Password
            </span>
            <div className="relative mt-2">
              <HiOutlineLockClosed className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-white/5 border border-white/10 rounded-xl pl-12 pr-4 py-3 outline-none focus:border-indigo-500 transition-all w-full text-white placeholder:text-slate-500"
                required
              />
            </div>
          </label>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-3 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white font-bold transition-all shadow-lg shadow-indigo-500/30 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading && (
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            )}
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <p className="text-xs text-slate-500 text-center mt-6">
          Access is restricted to accounts with the <span className="text-indigo-400 font-semibold">admin</span> role.
        </p>
      </div>
    </div>
  );
}
