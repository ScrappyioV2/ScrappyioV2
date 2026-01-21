'use client';

import { useAuth } from '@/lib/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  LogOut, 
  ShieldCheck, 
  Activity, 
  Compass, 
  Lock, 
  LayoutDashboard,
  Cpu,
  Zap
} from 'lucide-react';

export default function DashboardPage() {
  const { user, userRole, logout, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/');
      return;
    }
    
    if (!loading && user && userRole) {
      if (userRole.role !== 'admin') {
        const firstPage = userRole.allowed_pages.find(page => page !== 'dashboard' && page !== '*');
        if (firstPage) router.push(`/dashboard/${firstPage}`);
        else router.push('/unauthorized');
      }
    }
  }, [user, userRole, loading, router]);

  // Loading State (Dark Theme)
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin"></div>
          <p className="text-slate-400 font-mono text-sm tracking-widest animate-pulse">INITIALIZING...</p>
        </div>
      </div>
    );
  }

  if (!user || !userRole || userRole.role !== 'admin') return null;

  // Animations
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    show: { y: 0, opacity: 1 }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-8 font-sans selection:bg-indigo-500/30">
      
      <motion.div 
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="max-w-7xl mx-auto space-y-8"
      >
        {/* === HEADER === */}
        <motion.div variants={itemVariants} className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-8 border-b border-slate-800/60">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-500/10 rounded-xl border border-indigo-500/20 shadow-[0_0_15px_-3px_rgba(99,102,241,0.2)]">
                <LayoutDashboard className="w-6 h-6 text-indigo-400" />
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-white">Admin Command Center</h1>
            </div>
            <p className="text-slate-400 pl-[3.25rem]">
              Welcome back, <span className="text-slate-200 font-medium">{userRole?.full_name || user?.email}</span>
            </p>
          </div>

          <div className="flex items-center gap-4">
            <span className="px-4 py-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-sm font-bold flex items-center gap-2 shadow-sm">
              <ShieldCheck className="w-4 h-4" />
              ADMIN ACCESS GRANTED
            </span>
            
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={logout}
              className="px-4 py-2 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-lg hover:bg-rose-500 hover:text-white transition-all duration-300 flex items-center gap-2 font-medium"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </motion.button>
          </div>
        </motion.div>

        {/* === INFO CARDS === */}
        <motion.div variants={containerVariants} className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Card 1: System Access */}
          <motion.div variants={itemVariants} className="group relative bg-slate-900/50 border border-slate-800 p-6 rounded-2xl hover:bg-slate-900/80 hover:border-indigo-500/30 transition-all duration-300 overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <Cpu className="w-24 h-24 text-indigo-500 transform rotate-12" />
            </div>
            <div className="relative z-10">
              <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center mb-4 border border-blue-500/20 group-hover:scale-110 transition-transform">
                <ShieldCheck className="w-5 h-5 text-blue-400" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">System Privileges</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                You have unrestricted root access to all scraper modules, seller databases, and validation workflows.
              </p>
            </div>
          </motion.div>

          {/* Card 2: System Status */}
          <motion.div variants={itemVariants} className="group relative bg-slate-900/50 border border-slate-800 p-6 rounded-2xl hover:bg-slate-900/80 hover:border-emerald-500/30 transition-all duration-300 overflow-hidden">
             <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <Activity className="w-24 h-24 text-emerald-500 transform -rotate-6" />
            </div>
            <div className="relative z-10">
              <div className="w-10 h-10 bg-emerald-500/10 rounded-lg flex items-center justify-center mb-4 border border-emerald-500/20 group-hover:scale-110 transition-transform">
                <Zap className="w-5 h-5 text-emerald-400" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Operational Status</h3>
              <div className="flex items-center gap-2 text-emerald-400 text-sm font-semibold mt-1">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </span>
                All Systems Nominal
              </div>
              <p className="text-slate-400 text-sm mt-2">Database latency: 24ms</p>
            </div>
          </motion.div>

          {/* Card 3: Navigation */}
          <motion.div variants={itemVariants} className="group relative bg-slate-900/50 border border-slate-800 p-6 rounded-2xl hover:bg-slate-900/80 hover:border-purple-500/30 transition-all duration-300 overflow-hidden">
             <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <Compass className="w-24 h-24 text-purple-500 transform rotate-45" />
            </div>
            <div className="relative z-10">
              <div className="w-10 h-10 bg-purple-500/10 rounded-lg flex items-center justify-center mb-4 border border-purple-500/20 group-hover:scale-110 transition-transform">
                <Compass className="w-5 h-5 text-purple-400" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Quick Navigation</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Use the sidebar to access USA, India, UK, and UAE selling modules. Most recent activity: <span className="text-slate-300">USA Selling</span>.
              </p>
            </div>
          </motion.div>

        </motion.div>

        {/* === ADMIN NOTICE === */}
        <motion.div variants={itemVariants} className="bg-gradient-to-r from-slate-900 to-indigo-900/20 border border-indigo-500/20 rounded-2xl p-6 relative overflow-hidden">
          <div className="absolute inset-0 bg-grid-slate-800/[0.2] bg-[bottom_1px_center] [mask-image:linear-gradient(to_bottom,transparent,black)] pointer-events-none" />
          
          <div className="relative flex items-start gap-4 z-10">
            <div className="p-3 bg-indigo-500/20 rounded-xl border border-indigo-500/30">
              <Lock className="w-6 h-6 text-indigo-400" />
            </div>
            <div>
              <h4 className="text-lg font-bold text-white mb-1">Secure Admin Environment</h4>
              <p className="text-slate-400 text-sm max-w-2xl">
                This dashboard is restricted to administrator accounts only. User permissions and role-based access controls are active. Non-admin users are automatically redirected to their assigned workspace.
              </p>
            </div>
          </div>
        </motion.div>

      </motion.div>
    </div>
  );
}