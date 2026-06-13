'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('password123'); // Preset default to ease testing
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Login failed');
      }

      router.push('/dashboard');
      router.refresh();
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const selectTestUser = (testEmail: string) => {
    setEmail(testEmail);
    setPassword('password123');
  };

  const testUsers = [
    { name: 'Aisha', email: 'aisha@example.com', desc: 'Wants one number summary' },
    { name: 'Rohan', email: 'rohan@example.com', desc: 'No magic numbers, wants drilldown' },
    { name: 'Priya', email: 'priya@example.com', desc: 'USD currency resolver' },
    { name: 'Meera', email: 'meera@example.com', desc: 'Moved out Mar 31. Approves changes' },
    { name: 'Sam', email: 'sam@example.com', desc: 'Moved in Apr 15. Timeline tracker' },
    { name: 'Dev', email: 'dev@example.com', desc: 'USD trip participant' },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-6 relative overflow-hidden">
      {/* Background Gradients */}
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-emerald-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-96 h-96 bg-teal-500/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-md flex flex-col gap-6 z-10">
        {/* Brand */}
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center shadow-lg shadow-teal-500/20 font-black text-slate-950 text-2xl">
            S
          </div>
          <h2 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-emerald-400 to-teal-200 bg-clip-text text-transparent">
            Welcome to Spreetail Shared Expenses
          </h2>
          <p className="text-sm text-slate-400">
            Sign in to start managing flat group expenses
          </p>
        </div>

        {/* Form Container */}
        <div className="bg-slate-900/60 border border-slate-900 backdrop-blur rounded-2xl p-8 shadow-xl">
          <form onSubmit={handleLogin} className="flex flex-col gap-5">
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs p-3 rounded-xl">
                {error}
              </div>
            )}

            <div className="flex flex-col gap-2">
              <label htmlFor="email" className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="aisha@example.com"
                className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-emerald-500 transition-colors placeholder:text-slate-600"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="password" className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-emerald-500 transition-colors placeholder:text-slate-600"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-2 w-full py-3 bg-gradient-to-r from-emerald-400 to-teal-400 hover:brightness-110 text-slate-950 font-bold rounded-xl text-sm transition-all disabled:opacity-50 hover:scale-[1.01] active:scale-[0.99]"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <p className="text-center text-xs text-slate-500 mt-6">
            Don&apos;t have an account?{' '}
            <Link href="/register" className="text-emerald-400 hover:underline">
              Create one
            </Link>
          </p>
        </div>

        {/* Quick Test Login Selector */}
        <div className="bg-slate-900/30 border border-slate-900/60 rounded-2xl p-5 flex flex-col gap-3">
          <div className="text-xs font-bold text-slate-400 tracking-wide uppercase">
            ⚡ Quick Test Logins (Password: password123)
          </div>
          <div className="grid grid-cols-2 gap-2">
            {testUsers.map((u) => (
              <button
                key={u.email}
                onClick={() => selectTestUser(u.email)}
                className={`text-left p-2.5 rounded-xl border text-xs transition-all flex flex-col gap-1 ${
                  email === u.email
                    ? 'border-emerald-500 bg-emerald-500/5'
                    : 'border-slate-800/40 bg-slate-950/40 hover:border-slate-700/60'
                }`}
              >
                <div className="font-semibold text-slate-200">{u.name}</div>
                <div className="text-[10px] text-slate-500 overflow-hidden text-ellipsis whitespace-nowrap">
                  {u.desc}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
