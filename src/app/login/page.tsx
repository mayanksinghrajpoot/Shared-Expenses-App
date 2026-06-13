'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import ThemeToggle from '@/components/ThemeToggle';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('password123'); // Preset default to ease testing
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setMounted(true);
  }, []);

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
    { name: 'Aisha', email: 'aisha@example.com', desc: 'One number summary' },
    { name: 'Rohan', email: 'rohan@example.com', desc: 'Ledger drilldown' },
    { name: 'Priya', email: 'priya@example.com', desc: 'USD currency resolver' },
    { name: 'Meera', email: 'meera@example.com', desc: 'Moved out Mar 31' },
    { name: 'Sam', email: 'sam@example.com', desc: 'Moved in Apr 15' },
    { name: 'Dev', email: 'dev@example.com', desc: 'USD participant' },
  ];

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 flex flex-col justify-center items-center p-6 relative overflow-hidden transition-colors duration-300">
      {/* Background Gradients */}
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-emerald-500/10 dark:bg-emerald-500/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-96 h-96 bg-teal-500/10 dark:bg-teal-500/5 rounded-full blur-[120px] pointer-events-none" />

      {/* Floating Theme Toggle in top corner */}
      <div className="absolute top-6 right-6 z-20">
        <ThemeToggle />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="w-full max-w-md flex flex-col gap-6 z-10"
      >
        {/* Brand */}
        <div className="flex flex-col items-center gap-2 text-center">
          <motion.div 
            whileHover={{ scale: 1.05, rotate: 5 }}
            whileTap={{ scale: 0.95 }}
            className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20 font-black text-slate-950 text-2xl"
          >
            S
          </motion.div>
          <h2 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-emerald-600 to-teal-500 dark:from-emerald-400 dark:to-teal-200 bg-clip-text text-transparent">
            Welcome to Spreetail Shared Expenses
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Sign in to start managing flat group expenses
          </p>
        </div>

        {/* Form Container */}
        <div className="bg-white/80 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-900 backdrop-blur rounded-2xl p-8 shadow-xl dark:shadow-2xl">
          <form onSubmit={handleLogin} className="flex flex-col gap-5">
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs p-3 rounded-xl">
                {error}
              </div>
            )}

            <div className="flex flex-col gap-2">
              <label htmlFor="email" className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="aisha@example.com"
                className="bg-slate-100/60 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-emerald-500 dark:focus:border-emerald-500 focus:bg-white dark:focus:bg-slate-950 text-slate-900 dark:text-slate-100 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="password" className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="bg-slate-100/60 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-emerald-500 dark:focus:border-emerald-500 focus:bg-white dark:focus:bg-slate-950 text-slate-900 dark:text-slate-100 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600"
              />
            </div>

            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              type="submit"
              disabled={loading}
              className="mt-2 w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-400 hover:brightness-110 text-slate-950 font-bold rounded-xl text-sm transition-all disabled:opacity-50 shadow-md shadow-emerald-500/10"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </motion.button>
          </form>

          <p className="text-center text-xs text-slate-500 mt-6">
            Don&apos;t have an account?{' '}
            <Link href="/register" className="text-emerald-600 dark:text-emerald-400 font-semibold hover:underline">
              Create one
            </Link>
          </p>
        </div>

        {/* Quick Test Login Selector */}
        <div className="bg-white/60 dark:bg-slate-900/30 border border-slate-200/60 dark:border-slate-900/60 rounded-2xl p-5 flex flex-col gap-3 shadow-sm">
          <div className="text-xs font-bold text-slate-500 dark:text-slate-400 tracking-wide uppercase">
            ⚡ Quick Test Logins (Password: password123)
          </div>
          <div className="grid grid-cols-2 gap-2">
            {testUsers.map((u) => (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                key={u.email}
                onClick={() => selectTestUser(u.email)}
                className={`text-left p-2.5 rounded-xl border text-xs transition-all flex flex-col gap-1 ${
                  email === u.email
                    ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-500/5 text-emerald-700 dark:text-emerald-400'
                    : 'border-slate-200 dark:border-slate-800/40 bg-white/50 dark:bg-slate-950/40 hover:border-slate-300 dark:hover:border-slate-700/60 text-slate-750 dark:text-slate-300'
                }`}
              >
                <div className="font-semibold">{u.name}</div>
                <div className="text-[10px] text-slate-500 dark:text-slate-500 overflow-hidden text-ellipsis whitespace-nowrap">
                  {u.desc}
                </div>
              </motion.button>
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
