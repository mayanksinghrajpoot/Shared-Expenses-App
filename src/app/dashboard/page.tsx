'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface User {
  id: string;
  name: string;
  email: string;
}

interface Group {
  id: string;
  name: string;
  description: string;
  defaultCurrency: string;
  createdAt: string;
}

export default function Dashboard() {
  const [user, setUser] = useState<User | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDesc, setNewGroupDesc] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  useEffect(() => {
    // Fetch user details & groups
    const fetchData = async () => {
      try {
        const userRes = await fetch('/api/auth/me');
        if (!userRes.ok) {
          router.push('/login');
          return;
        }
        const userData = await userRes.json();
        setUser(userData.user);

        const groupsRes = await fetch('/api/groups');
        if (groupsRes.ok) {
          const groupsData = await groupsRes.json();
          setGroups(groupsData.groups);
        }
      } catch (err) {
        console.error('Error fetching dashboard data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [router]);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
      router.refresh();
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!newGroupName.trim()) {
      setError('Group name is required');
      return;
    }

    try {
      const res = await fetch('/api/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newGroupName,
          description: newGroupDesc,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create group');

      setGroups([...groups, data.group]);
      setNewGroupName('');
      setNewGroupDesc('');
      setShowCreateModal(false);
    } catch (err: any) {
      setError(err.message || 'Error creating group');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-slate-400">Loading Dashboard...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Header */}
      <header className="border-b border-slate-900 bg-slate-950/80 backdrop-blur sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center font-bold text-slate-950 shadow-md shadow-teal-500/10">
              S
            </div>
            <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-emerald-400 to-teal-200 bg-clip-text text-transparent">
              Spreetail Shared Expenses
            </span>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <div className="text-xs font-semibold text-slate-200">{user?.name}</div>
              <div className="text-[10px] text-slate-500">{user?.email}</div>
            </div>
            <button
              onClick={handleLogout}
              className="text-xs font-semibold px-3.5 py-1.5 border border-slate-800 rounded-lg text-slate-400 hover:text-slate-200 hover:border-slate-700 transition-all active:scale-95"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-10 flex flex-col gap-8">
        {/* Welcome Section */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-100">
              Welcome back, {user?.name}!
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              Select an active flat expense group or create a new one to manage.
            </p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2.5 bg-gradient-to-r from-emerald-400 to-teal-400 text-slate-950 font-bold rounded-xl text-sm hover:brightness-110 shadow-lg shadow-teal-500/10 hover:shadow-teal-500/20 hover:scale-[1.02] transition-all active:scale-[0.98] self-start sm:self-auto"
          >
            + New Group
          </button>
        </div>

        {/* Groups Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {groups.length > 0 ? (
            groups.map((group) => (
              <Link
                key={group.id}
                href={`/groups/${group.id}`}
                className="p-6 rounded-2xl bg-slate-900/40 border border-slate-900 backdrop-blur hover:border-emerald-500/40 hover:bg-slate-900/60 transition-all flex flex-col justify-between min-h-[160px] group shadow-md"
              >
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-lg text-slate-200 group-hover:text-emerald-400 transition-colors">
                      {group.name}
                    </h3>
                    <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                      {group.defaultCurrency}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                    {group.description || 'No description provided.'}
                  </p>
                </div>

                <div className="text-[10px] text-slate-500 mt-4 border-t border-slate-900/60 pt-3 flex items-center justify-between">
                  <span>Created {new Date(group.createdAt).toLocaleDateString()}</span>
                  <span className="text-emerald-400 font-semibold group-hover:translate-x-1 transition-transform">
                    Enter Group →
                  </span>
                </div>
              </Link>
            ))
          ) : (
            <div className="col-span-full py-16 text-center border border-dashed border-slate-800 rounded-2xl bg-slate-900/10 flex flex-col items-center gap-4 justify-center">
              <div className="w-12 h-12 rounded-full bg-slate-900 flex items-center justify-center text-slate-500 font-bold text-lg">
                📁
              </div>
              <div>
                <h3 className="font-bold text-slate-300">No Groups Found</h3>
                <p className="text-xs text-slate-500 mt-1">You are not a member of any shared expense groups yet.</p>
              </div>
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-4 py-2 border border-slate-700 rounded-xl text-xs font-semibold text-slate-300 hover:bg-slate-900 transition-colors"
              >
                Create Your First Group
              </button>
            </div>
          )}
        </div>
      </main>

      {/* Create Group Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 flex flex-col gap-4 animate-scale-up">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-lg text-slate-200">Create New Group</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-500 hover:text-slate-300 transition-colors"
              >
                ✕
              </button>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs p-3 rounded-xl">
                {error}
              </div>
            )}

            <form onSubmit={handleCreateGroup} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-400">Group Name</label>
                <input
                  type="text"
                  required
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  placeholder="e.g. Shared Flat Expenses"
                  className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-500 transition-colors placeholder:text-slate-700"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-400">Description (Optional)</label>
                <textarea
                  value={newGroupDesc}
                  onChange={(e) => setNewGroupDesc(e.target.value)}
                  placeholder="e.g. Split electricity, rent, groceries"
                  rows={3}
                  className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-500 transition-colors placeholder:text-slate-700 resize-none"
                />
              </div>

              <div className="flex justify-end gap-3 mt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 border border-slate-800 hover:bg-slate-950 rounded-xl text-xs font-semibold text-slate-400 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-gradient-to-r from-emerald-400 to-teal-400 hover:brightness-110 text-slate-950 font-bold rounded-xl text-xs transition-all"
                >
                  Create Group
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-slate-900 py-6 text-center text-xs text-slate-500 mt-10">
        <p>© 2026 Spreetail Expenses. Relational SQLite Engine.</p>
      </footer>
    </div>
  );
}
