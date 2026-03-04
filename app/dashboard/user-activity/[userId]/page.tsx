'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import {
  ArrowLeft, RefreshCw, Search, Calendar,
  CheckCircle, XCircle, ArrowRightLeft, Send, RotateCcw, Trash2, FileEdit
} from 'lucide-react';

type ActivityLog = {
  id: string;
  user_id: string;
  email: string | null;
  full_name: string | null;
  action: string;
  marketplace: string;
  page: string;
  table_name: string | null;
  asin: string | null;
  details: any;
  created_at: string;
};

// --- Formatting Helpers ---

const formatTableName = (table: string | null | undefined): string => {
  if (!table) return '';
  return table.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
};

const formatPageName = (page: string): string => {
  const map: Record<string, string> = {
    'brand-checking': 'Brand Checking',
    'admin-validation': 'Admin Validation',
    'validation': 'Validation',
    'purchases': 'Purchases',
    'tracking': 'Tracking',
    'listing-errors': 'Listing Errors',
    'reorder': 'Reorder',
  };
  return map[page] || page.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
};

const getActionDescription = (log: ActivityLog): string => {
  const action = log.action?.toLowerCase() || '';
  const asin = log.asin ? `[${log.asin}]` : '';
  const page = formatPageName(log.page);
  const details = log.details || {};
  const target = formatTableName(details.target);
  const from = formatTableName(details.from);
  const to = formatTableName(details.to);

  switch (action) {
    case 'approved':
    case 'approve':
      return target ? `Approved ${asin} → moved to ${target}` : `Approved ${asin} in ${page}`;
    case 'rejected':
    case 'reject':
      return details.reason ? `Rejected ${asin} — "${details.reason}"` : `Rejected ${asin} in ${page}`;
    case 'move':
      if (from && to) return `Moved ${asin} from ${from} → ${to}`;
      if (to) return `Moved ${asin} → ${to}`;
      return `Moved ${asin} in ${page}`;
    case 'submit':
      return `Submitted ${asin} in ${page}`;
    case 'rollback':
      return `Rolled back ${asin} in ${page}`;
    case 'delete':
      return `Deleted ${asin} from ${page}`;
    case 'edit':
    case 'update':
      const field = details.field || '';
      return field ? `Edited ${field} on ${asin} in ${page}` : `Updated ${asin} in ${page}`;
    default:
      return `${action.charAt(0).toUpperCase() + action.slice(1)} ${asin} in ${page}`;
  }
};

// --- Styling ---

const ACTION_COLORS: Record<string, string> = {
  submit: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
  approved: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  approve: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  rejected: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
  reject: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
  move: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  rollback: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
  delete: 'bg-red-500/20 text-red-300 border-red-500/30',
  edit: 'bg-sky-500/20 text-sky-300 border-sky-500/30',
  update: 'bg-sky-500/20 text-sky-300 border-sky-500/30',
  pass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  fail: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
};

const ACTION_ICONS: Record<string, React.ReactNode> = {
  submit: <Send className="w-3 h-3" />,
  approved: <CheckCircle className="w-3 h-3" />,
  approve: <CheckCircle className="w-3 h-3" />,
  rejected: <XCircle className="w-3 h-3" />,
  reject: <XCircle className="w-3 h-3" />,
  move: <ArrowRightLeft className="w-3 h-3" />,
  rollback: <RotateCcw className="w-3 h-3" />,
  delete: <Trash2 className="w-3 h-3" />,
  edit: <FileEdit className="w-3 h-3" />,
  update: <FileEdit className="w-3 h-3" />,
  pass: <CheckCircle className="w-3 h-3" />,
  fail: <XCircle className="w-3 h-3" />,
};

// --- Quick Date Presets ---
const getDatePresets = () => {
  const today = new Date();
  const fmt = (d: Date) => d.toISOString().split('T')[0];

  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  const weekAgo = new Date(today);
  weekAgo.setDate(today.getDate() - 7);

  const monthAgo = new Date(today);
  monthAgo.setDate(today.getDate() - 30);

  return [
    { label: 'Today', from: fmt(today), to: fmt(today) },
    { label: 'Yesterday', from: fmt(yesterday), to: fmt(yesterday) },
    { label: 'Last 7 days', from: fmt(weekAgo), to: fmt(today) },
    { label: 'Last 30 days', from: fmt(monthAgo), to: fmt(today) },
  ];
};

export default function UserActivityPage() {
  const params = useParams();
  const router = useRouter();
  const userId = params.userId as string;

  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('ALL');
  const [pageFilter, setPageFilter] = useState<string>('ALL');
  const [userName, setUserName] = useState<string>('');
  const [totalCount, setTotalCount] = useState<number>(0);

  // Date range state
  const today = new Date().toISOString().split('T')[0];
  const [dateFrom, setDateFrom] = useState<string>(today);
  const [dateTo, setDateTo] = useState<string>(today);
  const [activePreset, setActivePreset] = useState<string>('Today');

  const fetchLogs = async () => {
    try {
      setLoading(true);

      // Build date range: from start-of-day to end-of-day in UTC
      const startDate = `${dateFrom}T00:00:00.000Z`;
      const endDate = `${dateTo}T23:59:59.999Z`;

      // Get exact total count for this date range
      const { count } = await supabase
        .from('user_activity_log')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('created_at', startDate)
        .lte('created_at', endDate);

      if (count !== null) setTotalCount(count);

      // Fetch rows for this date range
      const { data, error } = await supabase
        .from('user_activity_log')
        .select('*')
        .eq('user_id', userId)
        .gte('created_at', startDate)
        .lte('created_at', endDate)
        .order('created_at', { ascending: false })
        .limit(500);

      if (error) throw error;
      setLogs(data || []);

      if (data && data.length > 0) {
        setUserName(data[0].full_name || data[0].email || '');
      }
    } catch (err) {
      console.error('Error fetching activity logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userId) fetchLogs();
  }, [userId, dateFrom, dateTo]);

  const handlePreset = (preset: { label: string; from: string; to: string }) => {
    setDateFrom(preset.from);
    setDateTo(preset.to);
    setActivePreset(preset.label);
  };

  // When manual date change, clear active preset
  const handleDateFromChange = (val: string) => {
    setDateFrom(val);
    setActivePreset('');
  };
  const handleDateToChange = (val: string) => {
    setDateTo(val);
    setActivePreset('');
  };

  const uniqueActions = [...new Set(logs.map((l) => l.action))];
  const uniquePages = [...new Set(logs.map((l) => l.page))];

  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      !searchQuery ||
      log.asin?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.page?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.table_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.action?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      getActionDescription(log).toLowerCase().includes(searchQuery.toLowerCase());
    const matchesAction = actionFilter === 'ALL' || log.action === actionFilter;
    const matchesPage = pageFilter === 'ALL' || log.page === pageFilter;
    return matchesSearch && matchesAction && matchesPage;
  });

  const groupedByDate = filteredLogs.reduce<Record<string, ActivityLog[]>>((acc, log) => {
    const date = new Date(log.created_at).toLocaleDateString('en-IN', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    if (!acc[date]) acc[date] = [];
    acc[date].push(log);
    return acc;
  }, {});

  const presets = getDatePresets();

  return (
    <div className="h-full flex flex-col bg-slate-950 text-slate-200 overflow-hidden">

      {/* Header */}
      <div className="flex-none px-6 pt-6 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-4 mb-4">
          <button onClick={() => router.back()} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-white">Activity Log</h1>
            <p className="text-sm text-slate-400 mt-0.5">
              {userName || userId}
              {totalCount > 0 && (
                <span className="ml-2 text-slate-500">• {totalCount} actions{activePreset === 'Today' ? ' today' : ` (${activePreset || `${dateFrom} to ${dateTo}`})`}</span>
              )}
            </p>
          </div>
          <button
            onClick={fetchLogs}
            className="ml-auto p-2.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 transition-colors border border-slate-700"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Date Range Picker */}
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          {/* Quick Presets */}
          {presets.map((preset) => (
            <button
              key={preset.label}
              onClick={() => handlePreset(preset)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                activePreset === preset.label
                  ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'
                  : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-slate-300'
              }`}
            >
              {preset.label}
            </button>
          ))}

          {/* Custom Date Range */}
          <div className="flex items-center gap-1.5 ml-auto">
            <Calendar className="w-3.5 h-3.5 text-slate-500" />
            <input
              type="date"
              value={dateFrom}
              max={dateTo}
              onChange={(e) => handleDateFromChange(e.target.value)}
              className="px-2 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-indigo-500/50 [color-scheme:dark]"
            />
            <span className="text-xs text-slate-600">→</span>
            <input
              type="date"
              value={dateTo}
              min={dateFrom}
              max={today}
              onChange={(e) => handleDateToChange(e.target.value)}
              className="px-2 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-indigo-500/50 [color-scheme:dark]"
            />
          </div>
        </div>

        {/* Search & Filters */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search ASIN, action, description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-lg text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50"
            />
          </div>

          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-sm text-slate-300 focus:outline-none focus:border-indigo-500/50"
          >
            <option value="ALL">All Actions</option>
            {uniqueActions.map((a) => (
              <option key={a} value={a}>{a.charAt(0).toUpperCase() + a.slice(1)}</option>
            ))}
          </select>

          <select
            value={pageFilter}
            onChange={(e) => setPageFilter(e.target.value)}
            className="px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-sm text-slate-300 focus:outline-none focus:border-indigo-500/50"
          >
            <option value="ALL">All Pages</option>
            {uniquePages.map((p) => (
              <option key={p} value={p}>{formatPageName(p)}</option>
            ))}
          </select>

          {/* Quick Stats */}
          <div className="ml-auto flex items-center gap-2">
            {uniqueActions.map((action) => (
              <div key={action} className="relative group">
                <span
                  className={`px-2.5 py-1 rounded-full text-xs font-bold border flex items-center gap-1.5 cursor-default ${
                    ACTION_COLORS[action] || 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}
                >
                  {ACTION_ICONS[action] || null}
                  {logs.filter((l) => l.action === action).length}
                </span>
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-200 whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200 z-50">
                  {action.charAt(0).toUpperCase() + action.slice(1)} actions
                  <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Activity Timeline */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-slate-500">Loading activity...</div>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="text-slate-500 mb-2">
                {searchQuery || actionFilter !== 'ALL' || pageFilter !== 'ALL'
                  ? 'No matching activity found'
                  : 'No activity recorded for this period'}
              </div>
              {activePreset !== 'Today' && (
                <button
                  onClick={() => handlePreset(presets[0])}
                  className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                >
                  ← Back to Today
                </button>
              )}
            </div>
          </div>
        ) : (
          Object.entries(groupedByDate).map(([date, dateLogs]) => (
            <div key={date} className="mb-8">
              <div className="sticky top-0 z-10 bg-slate-950/90 backdrop-blur-sm py-2 mb-3">
                <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">
                  {date}
                  <span className="ml-2 text-xs text-slate-600 normal-case">
                    ({dateLogs.length} actions)
                  </span>
                </h3>
              </div>

              <div className="space-y-2">
                {dateLogs.map((log) => (
                  <div
                    key={log.id}
                    className="bg-slate-900/50 border border-slate-800/50 rounded-xl px-5 py-3.5 hover:border-slate-700 transition-colors"
                  >
                    <div className="flex items-start gap-4">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-bold border whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                          ACTION_COLORS[log.action] || 'bg-slate-800 text-slate-400 border-slate-700'
                        }`}
                      >
                        {ACTION_ICONS[log.action] || null}
                        {log.action.toUpperCase()}
                      </span>

                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-200">
                          {getActionDescription(log)}
                        </p>
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          <span className="text-[10px] text-slate-400 px-1.5 py-0.5 bg-slate-800/80 rounded">
                            {formatPageName(log.page)}
                          </span>
                          {log.marketplace && (
                            <span className="text-[10px] text-cyan-400 px-1.5 py-0.5 bg-cyan-500/10 rounded">
                              {log.marketplace.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                            </span>
                          )}
                          {log.details?.funnel && (
                            <span className="text-[10px] text-amber-400 px-1.5 py-0.5 bg-amber-500/10 rounded">
                              Funnel: {log.details.funnel}
                            </span>
                          )}
                          {log.details?.type && (
                            <span className="text-[10px] text-purple-400 px-1.5 py-0.5 bg-purple-500/10 rounded">
                              {log.details.type}
                            </span>
                          )}
                          {log.table_name && (
                            <span className="text-[10px] text-slate-600">
                              {formatTableName(log.table_name)}
                            </span>
                          )}
                        </div>
                      </div>

                      {log.asin && (
                        <span className="text-sm font-mono text-indigo-400 bg-indigo-500/10 px-2.5 py-0.5 rounded-md shrink-0">
                          {log.asin}
                        </span>
                      )}

                      <span className="text-xs text-slate-600 whitespace-nowrap shrink-0">
                        {(() => {
                          const d = new Date(log.created_at);
                          let h = d.getHours();
                          const ampm = h >= 12 ? 'PM' : 'AM';
                          h = h % 12 || 12;
                          const m = String(d.getMinutes()).padStart(2, '0');
                          const s = String(d.getSeconds()).padStart(2, '0');
                          return `${h}:${m}:${s} ${ampm}`;
                        })()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="flex-none border-t border-slate-800 bg-slate-950 px-6 py-3">
        <div className="flex items-center justify-between text-sm text-slate-500">
          <span>Showing {filteredLogs.length} of {totalCount} activity logs</span>
          {totalCount > 500 && (
            <span className="text-xs text-amber-400/60">
              ⚠ Showing latest 500 rows. Narrow the date range to see all.
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
