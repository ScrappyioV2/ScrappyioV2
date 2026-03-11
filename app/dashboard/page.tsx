'use client';

import { useAuth } from '@/lib/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabaseClient';
import {
  LogOut, ShieldCheck, LayoutDashboard, Users,
  UserCheck, UserX, Shield, Eye, Save,
  ChevronRight, Loader2, ToggleLeft, ToggleRight,
  Activity, AlertTriangle, UserPlus
} from 'lucide-react';

import CreateUserModal from '@/components/CreateUserModal';

const MARKETPLACE_PERMISSIONS = [
  { key: 'usa-selling', label: 'USA Selling' },
  { key: 'india-selling', label: 'India Selling' },
  { key: 'uk-selling', label: 'UK Selling' },
  { key: 'uae-selling', label: 'UAE Selling' },
  { key: 'flipkart', label: 'Flipkart' },
  { key: 'jio-mart', label: 'JioMart' },
  { key: 'manage-sellers', label: 'Manage Sellers' },
];

const PAGE_PERMISSIONS = [
  { key: 'view-brand-checking', label: 'Brand Checking' },
  { key: 'view-validation', label: 'Validation' },
  { key: 'view-listing-errors', label: 'Listing Errors' },
  { key: 'view-purchases', label: 'Purchases' },
  { key: 'view-tracking', label: 'Tracking' },
  { key: 'view-reorder', label: 'Reorder' },
  { key: 'view-restock', label: 'Restock' },        // ← ADD THIS
  { key: 'admin-access', label: 'Admin Approvals' },
];

const ROLE_OPTIONS = [
  'admin', 'validation', 'purchase', 'brand-checking',
  'listing-error', 'tracking', 'restock', 'reorder', 'viewer'
];
const formatRole = (role: string) => {
  const map: Record<string, string> = {
    'brand-checking': 'BRAND CHECKING',
    'listing-error': 'LISTING ERROR',
  };
  return map[role] || role.toUpperCase();
};

type UserRoleRow = {
  id: string;
  user_id: string;
  email: string;
  full_name: string | null;
  role: string;
  allowed_pages: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export default function DashboardPage() {
  const { user, userRole, logout, loading } = useAuth();
  const router = useRouter();

  const [users, setUsers] = useState<UserRoleRow[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserRoleRow | null>(null);
  const [editedPages, setEditedPages] = useState<string[]>([]);
  const [editedRole, setEditedRole] = useState<string>('viewer');
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [todayStats, setTodayStats] = useState<Record<string, number>>({});
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
      return;
    }
    if (!loading && user && userRole) {
      if (userRole.role !== 'admin') {
        const firstPage = userRole.allowed_pages.find(p => p !== 'dashboard' && p !== '*');
        if (firstPage) router.push(`/dashboard/${firstPage}`);
        else router.push('/unauthorized');
      }
    }
  }, [user, userRole, loading, router]);

  const fetchUsers = useCallback(async () => {
    const { data } = await supabase
      .from('user_roles')
      .select('*')
      .order('created_at', { ascending: true });
    if (data) setUsers(data);
    setLoadingUsers(false);
  }, []);

  const fetchTodayStats = useCallback(async () => {
    const { data } = await supabase
      .from('user_daily_summary')
      .select('user_id, total_actions')
      .eq('summary_date', selectedDate);

    if (data) {
      const counts: Record<string, number> = {};
      data.forEach((row: any) => {
        counts[row.user_id] = (counts[row.user_id] || 0) + row.total_actions;
      });
      setTodayStats(counts);
    }
  }, [selectedDate]);

  useEffect(() => {
    if (user && userRole?.role === 'admin') {
      fetchUsers();
      fetchTodayStats();
    }
  }, [user, userRole, fetchUsers, fetchTodayStats]);

  const handleSelectUser = (u: UserRoleRow) => {
    setSelectedUser(u);
    setEditedPages([...u.allowed_pages]);
    setEditedRole(u.role);
    setSaveSuccess(false);
  };

  const togglePermission = (key: string) => {
    setEditedPages(prev =>
      prev.includes(key) ? prev.filter(p => p !== key) : [...prev, key]
    );
    setSaveSuccess(false);
  };

  const handleSave = async () => {
    if (!selectedUser) return;

    const isCurrentUser = selectedUser.user_id === user?.id;
    if (isCurrentUser && editedRole !== 'admin') {
      alert("You cannot remove your own admin access.");
      setEditedRole('admin');
      return;
    }

    setSaving(true);

    const { error } = await supabase
      .from('user_roles')
      .update({
        allowed_pages: editedPages,
        role: editedRole,
        updated_at: new Date().toISOString(),
      })
      .eq('id', selectedUser.id);

    if (error) {
      console.error('Save permissions error:', error);
      alert('Failed to save: ' + error.message);
    } else {
      const updated = { ...selectedUser, allowed_pages: editedPages, role: editedRole };
      setUsers((prev) => prev.map((u) => (u.id === selectedUser.id ? updated : u)));
      setSelectedUser(updated);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    }

    setSaving(false);
  };

  const toggleActive = async (u: UserRoleRow) => {
    if (u.user_id === user?.id) return;
    const newStatus = !u.is_active;
    const { error } = await supabase
      .from('user_roles')
      .update({ is_active: newStatus, updated_at: new Date().toISOString() })
      .eq('id', u.id);

    if (!error) {
      setUsers((prev) => prev.map((usr) => usr.id === u.id ? { ...usr, is_active: newStatus } : usr));
      if (selectedUser?.id === u.id) {
        setSelectedUser((prev) => prev ? { ...prev, is_active: newStatus } : null);
      }
    }
  };

  const handleDeleteUser = async (u: UserRoleRow) => {
    if (u.user_id === user?.id) {
      alert("You cannot delete your own account.");
      return;
    }
    if (!confirm(`Permanently delete ${u.full_name || u.email}? This cannot be undone.`)) return;

    try {
      const res = await fetch('/api/admin/create-user', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: u.user_id }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(data.error || 'Delete failed');
      }
      setUsers((prev) => prev.filter((usr) => usr.id !== u.id));
      if (selectedUser?.id === u.id) setSelectedUser(null);
    } catch (err: any) {
      alert('Failed to delete user: ' + err.message);
    }
  };

  if (loading) {
    return (
      <div className="h-full bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-indigo-400 animate-spin" />
      </div>
    );
  }

  if (!user || !userRole || userRole.role !== 'admin') return null;

  const activeUsers = users.filter(u => u.is_active).length;
  const isCurrentUser = selectedUser?.user_id === user?.id;
  const hasChanges = selectedUser && (
    JSON.stringify([...editedPages].sort()) !== JSON.stringify([...selectedUser.allowed_pages].sort()) ||
    editedRole !== selectedUser.role
  );

  // ✅ NEW — helper for date-aware label
  const isToday = selectedDate === new Date().toISOString().split('T')[0];

  return (
    <div className="h-full bg-slate-950 text-slate-200 p-4 lg:p-6 font-sans flex flex-col overflow-hidden">

      {/* === HEADER === */}
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800/60 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-indigo-500/10 rounded-lg border border-indigo-500/20">
            <LayoutDashboard className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Admin Command Center</h1>
            <p className="text-xs text-slate-400">
              Welcome back, <span className="text-slate-200 font-medium">{userRole.full_name || user.email}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex gap-2">
            <span className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono flex items-center gap-1.5">
              <Users className="w-3 h-3 text-indigo-400" />
              {users.length} Users
            </span>
            <span className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono flex items-center gap-1.5">
              <UserCheck className="w-3 h-3 text-emerald-400" />
              {activeUsers} Active
            </span>
          </div>

          <span className="px-3 py-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-bold flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5" />
            ADMIN
          </span>

          <button
            onClick={logout}
            className="px-3 py-1.5 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-lg hover:bg-rose-500 hover:text-white transition-all text-xs flex items-center gap-1.5 font-medium"
          >
            <LogOut className="w-3.5 h-3.5" />
            Logout
          </button>
        </div>
      </div>

      {/* === MAIN CONTENT === */}
      <div className="flex-1 grid grid-cols-1 xl:grid-cols-3 gap-4 min-h-0">

        {/* LEFT: User Cards */}
        <div className="xl:col-span-1 flex flex-col min-h-0">
          <div className="flex items-center justify-between mb-3 shrink-0">
            <h2 className="text-sm font-bold text-slate-300 flex items-center gap-2">
              <Users className="w-4 h-4 text-indigo-400" />
              Team Members
            </h2>
            <button
              onClick={() => setShowCreateUser(true)}
              className="px-2.5 py-1.5 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-lg hover:bg-indigo-500 hover:text-white transition-all text-[10px] flex items-center gap-1.5 font-bold"
            >
              <UserPlus className="w-3 h-3" />
              Add User
            </button>
          </div>

          {/* ✅ NEW — Date Picker */}
          <div className="flex items-center gap-2 mb-3 px-1 shrink-0">
            <button
              onClick={() => {
                const d = new Date(selectedDate);
                d.setDate(d.getDate() - 1);
                setSelectedDate(d.toISOString().split('T')[0]);
              }}
              className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors text-xs"
            >
              ←
            </button>
            <input
              type="date"
              value={selectedDate}
              max={new Date().toISOString().split('T')[0]}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="flex-1 px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-indigo-500/50 [color-scheme:dark]"
            />
            <button
              onClick={() => {
                const d = new Date(selectedDate);
                d.setDate(d.getDate() + 1);
                const todayStr = new Date().toISOString().split('T')[0];
                const next = d.toISOString().split('T')[0];
                if (next <= todayStr) setSelectedDate(next);
              }}
              className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors text-xs"
            >
              →
            </button>
            {!isToday && (
              <button
                onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])}
                className="px-2 py-1.5 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-lg text-[10px] font-bold hover:bg-indigo-500/20 transition-colors"
              >
                Today
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {loadingUsers ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
              </div>
            ) : users.length === 0 ? (
              <div className="text-center py-12 text-slate-600 text-sm">No users found</div>
            ) : (
              users.map(u => (
                <div
                  key={u.id}
                  onClick={() => handleSelectUser(u)}
                  className={`p-3 rounded-xl border cursor-pointer transition-all ${selectedUser?.id === u.id
                    ? 'bg-indigo-500/10 border-indigo-500/30'
                    : 'bg-slate-900/40 border-slate-800 hover:border-slate-700'
                    }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${u.is_active ? 'bg-indigo-500/20 text-indigo-400' : 'bg-slate-800 text-slate-500'
                        }`}>
                        {(u.full_name || u.email).charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white">{u.full_name || u.email.split('@')[0]}</p>
                        <p className="text-[10px] text-slate-500">{u.email}</p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${u.role === 'admin' ? 'bg-amber-500/10 text-amber-400'
                        : u.role === 'validation' ? 'bg-purple-500/10 text-purple-400'
                          : u.role === 'purchase' ? 'bg-emerald-500/10 text-emerald-400'
                            : u.role === 'brand-checking' ? 'bg-blue-500/10 text-blue-400'
                              : u.role === 'listing-error' ? 'bg-rose-500/10 text-rose-400'
                                : u.role === 'tracking' ? 'bg-cyan-500/10 text-cyan-400'
                                  : u.role === 'reorder' ? 'bg-orange-500/10 text-orange-400'
                                    : 'bg-slate-800 text-slate-400'
                        }`}>
                        {formatRole(u.role)}
                      </span>
                      <div className="flex items-center gap-1">
                        <span className={`w-1.5 h-1.5 rounded-full ${u.is_active ? 'bg-emerald-500' : 'bg-slate-600'}`} />
                        <span className="text-[9px] text-slate-500">{u.is_active ? 'Active' : 'Inactive'}</span>
                      </div>
                    </div>
                  </div>

                  {/* ✅ NEW — Date-aware actions label */}
                  {(todayStats[u.user_id] || 0) > 0 && (
                    <div className="mt-2 pt-2 border-t border-slate-800/50">
                      <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                        <Activity className="w-3 h-3" />
                        {todayStats[u.user_id]} actions
                        {isToday
                          ? ' today'
                          : ` on ${new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`
                        }
                      </span>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* RIGHT: Permission Panel */}
        <div className="xl:col-span-2 min-h-0">
          <AnimatePresence mode="wait">
            {selectedUser ? (
              <motion.div
                key={selectedUser.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="h-full flex flex-col bg-slate-900/40 border border-slate-800 rounded-xl overflow-hidden"
              >
                {/* User Header */}
                <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${selectedUser.is_active ? 'bg-indigo-500/20 text-indigo-400' : 'bg-slate-800 text-slate-500'
                      }`}>
                      {(selectedUser.full_name || selectedUser.email).charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-white">
                        {selectedUser.full_name || selectedUser.email.split('@')[0]}
                        {isCurrentUser && <span className="text-[10px] text-indigo-400 ml-2">(You)</span>}
                      </h3>
                      <p className="text-xs text-slate-400">{selectedUser.email}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {!isCurrentUser && (
                      <>
                        <button
                          onClick={() => toggleActive(selectedUser)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${selectedUser.is_active
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-rose-500/10 hover:text-rose-400 hover:border-rose-500/20'
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-emerald-500/10 hover:text-emerald-400 hover:border-emerald-500/20'
                            }`}
                        >
                          {selectedUser.is_active ? (
                            <><UserCheck className="w-3 h-3" /> Active</>
                          ) : (
                            <><UserX className="w-3 h-3" /> Inactive</>
                          )}
                        </button>
                        <button
                          onClick={() => handleDeleteUser(selectedUser)}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500 hover:text-white"
                        >
                          <UserX className="w-3 h-3" /> Delete
                        </button>
                      </>
                    )}

                    <select
                      value={editedRole}
                      onChange={(e) => { setEditedRole(e.target.value); setSaveSuccess(false); }}
                      disabled={isCurrentUser}
                      className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {ROLE_OPTIONS.map(r => (
                        <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Permission Toggles */}
                <div className="flex-1 overflow-y-auto p-5">
                  {isCurrentUser && editedRole === 'admin' && (
                    <div className="mb-4 px-3 py-2 bg-amber-500/5 border border-amber-500/20 rounded-lg flex items-center gap-2 text-xs text-amber-400">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      Admin role bypasses all permissions. Toggles below only apply to non-admin roles.
                    </div>
                  )}

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* Marketplace Access */}
                    <div>
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                        <Shield className="w-3.5 h-3.5 text-indigo-400" />
                        Marketplace Access
                      </h4>
                      <div className="space-y-1.5">
                        {MARKETPLACE_PERMISSIONS.map(p => (
                          <button
                            key={p.key}
                            onClick={() => togglePermission(p.key)}
                            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-all ${editedPages.includes(p.key)
                              ? 'bg-indigo-500/10 border border-indigo-500/20 text-indigo-300'
                              : 'bg-slate-950/50 border border-slate-800/50 text-slate-500 hover:text-slate-300'
                              }`}
                          >
                            <span>{p.label}</span>
                            {editedPages.includes(p.key)
                              ? <ToggleRight className="w-5 h-5 text-indigo-400" />
                              : <ToggleLeft className="w-5 h-5 text-slate-600" />
                            }
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Page Access */}
                    <div>
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                        <Eye className="w-3.5 h-3.5 text-purple-400" />
                        Page Access
                      </h4>
                      <div className="space-y-1.5">
                        {PAGE_PERMISSIONS.map(p => (
                          <button
                            key={p.key}
                            onClick={() => togglePermission(p.key)}
                            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-all ${editedPages.includes(p.key)
                              ? 'bg-purple-500/10 border border-purple-500/20 text-purple-300'
                              : 'bg-slate-950/50 border border-slate-800/50 text-slate-500 hover:text-slate-300'
                              }`}
                          >
                            <span>{p.label}</span>
                            {editedPages.includes(p.key)
                              ? <ToggleRight className="w-5 h-5 text-purple-400" />
                              : <ToggleLeft className="w-5 h-5 text-slate-600" />
                            }
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="px-5 py-3 border-t border-slate-800 flex items-center justify-between shrink-0">
                  <button
                    onClick={() => router.push(`/dashboard/user-activity/${selectedUser.user_id}`)}
                    className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1.5 font-medium transition-colors"
                  >
                    <Activity className="w-3.5 h-3.5" />
                    View Full Activity
                    <ChevronRight className="w-3 h-3" />
                  </button>

                  <button
                    onClick={handleSave}
                    disabled={!hasChanges || saving}
                    className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${saveSuccess
                      ? 'bg-emerald-500 text-white'
                      : hasChanges
                        ? 'bg-indigo-500 text-white hover:bg-indigo-600'
                        : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                      }`}
                  >
                    {saving ? (
                      <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving...</>
                    ) : saveSuccess ? (
                      <><ShieldCheck className="w-3.5 h-3.5" /> Saved!</>
                    ) : (
                      <><Save className="w-3.5 h-3.5" /> Save Permissions</>
                    )}
                  </button>
                </div>
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="h-full flex flex-col items-center justify-center text-slate-600"
              >
                <Users className="w-12 h-12 mb-3 opacity-30" />
                <p className="text-sm font-medium">Select a team member</p>
                <p className="text-xs mt-1">Click on a user to manage permissions and view activity</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <CreateUserModal
        open={showCreateUser}
        onClose={() => setShowCreateUser(false)}
        onSuccess={() => fetchUsers()}
      />
    </div>
  );
}
