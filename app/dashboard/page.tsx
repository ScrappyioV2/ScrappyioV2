'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';

export default function DashboardPage() {
  // Authentication state
  const [user, setUser] = useState<any>(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [authMessage, setAuthMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Mock data - replace with real database data later
  const [sellers] = useState([
    {
      id: 1,
      name: 'Manage Sellers',
      icon: '📊',
      brandChecking: { approved: 12, notApproved: 3 },
      listing: { done: 8, pending: 7 },
      purchasing: { done: 5, pending: 10 },
      delivered: { done: 4, pending: 11 }
    },
    {
      id: 2,
      name: 'USA Selling',
      icon: 'US',
      brandChecking: { approved: 25, notApproved: 5 },
      listing: { done: 18, pending: 12 },
      purchasing: { done: 15, pending: 15 },
      delivered: { done: 10, pending: 20 }
    },
    {
      id: 3,
      name: 'India Selling',
      icon: 'IN',
      brandChecking: { approved: 8, notApproved: 2 },
      listing: { done: 6, pending: 4 },
      purchasing: { done: 3, pending: 7 },
      delivered: { done: 2, pending: 8 }
    },
    {
      id: 4,
      name: 'UK Selling',
      icon: 'GB',
      brandChecking: { approved: 15, notApproved: 4 },
      listing: { done: 11, pending: 8 },
      purchasing: { done: 9, pending: 10 },
      delivered: { done: 7, pending: 12 }
    },
    {
      id: 5,
      name: 'UAE Selling',
      icon: 'AE',
      brandChecking: { approved: 10, notApproved: 2 },
      listing: { done: 7, pending: 5 },
      purchasing: { done: 4, pending: 8 },
      delivered: { done: 3, pending: 9 }
    },
  ]);

  // Check authentication on mount
  useEffect(() => {
    const checkAuth = async () => {
      if (!supabase) return;
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    };
    
    checkAuth();
    
    // Listen for auth changes
    if (supabase) {
      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        setUser(session?.user ?? null);
      });
      
      return () => subscription.unsubscribe();
    }
  }, []);

  const handleAuth = async () => {
    if (!supabase) return;
    
    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        setAuthMessage({ text: 'Logged in successfully!', type: 'success' });
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setAuthMessage({ text: 'Account created! Check your email to verify.', type: 'success' });
      }
      setShowLoginModal(false);
      setEmail('');
      setPassword('');
      setTimeout(() => setAuthMessage(null), 3000);
    } catch (error: any) {
      setAuthMessage({ text: error.message, type: 'error' });
    }
  };

  const handleLogout = async () => {
    if (!supabase) return;
    try {
      await supabase.auth.signOut();
      setUser(null);
      setAuthMessage({ text: 'Logged out successfully!', type: 'success' });
      setTimeout(() => setAuthMessage(null), 3000);
    } catch (error: any) {
      setAuthMessage({ text: error.message, type: 'error' });
    }
  };

  return (
    <div className="p-6">
      {/* Header with Login Button */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">DASHBOARD</h1>
          <p className="text-gray-600 mt-1">Welcome back!</p>
        </div>
        
        {/* Login/Logout Button */}
        <div className="flex items-center gap-3">
          {user ? (
            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="text-sm font-medium text-gray-900">{user.email}</div>
                <div className="text-xs text-gray-500">Logged in</div>
              </div>
              <button
                onClick={handleLogout}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-lg transition shadow-md"
              >
                Logout
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowLoginModal(true)}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition shadow-md flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
              </svg>
              Login / Sign Up
            </button>
          )}
        </div>
      </div>

      {/* Auth Message Toast */}
      {authMessage && (
        <div className={`mb-4 p-4 rounded-lg ${authMessage.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          {authMessage.text}
        </div>
      )}

      {/* Dashboard Cards */}
      <div className="space-y-6">
        {sellers.map((seller) => (
          <div key={seller.id} className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="text-4xl">{seller.icon}</div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">{seller.name}</h2>
                <p className="text-gray-600 text-sm">Workflow tracking</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Brand Checking Status */}
              <div className="border border-gray-200 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">BRAND CHECKING STATUS</h3>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <div className="text-xs text-gray-600 mb-1">APPROVED</div>
                    <div className="text-2xl font-bold text-gray-900">{seller.brandChecking.approved}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-600 mb-1">NOT - APPROVED</div>
                    <div className="text-2xl font-bold text-gray-900">{seller.brandChecking.notApproved}</div>
                  </div>
                </div>
              </div>

              {/* Listing Status */}
              <div className="border border-gray-200 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">LISTING STATUS</h3>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <div className="text-xs text-gray-600 mb-1">DONE</div>
                    <div className="text-2xl font-bold text-gray-900">{seller.listing.done}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-600 mb-1">PENDING</div>
                    <div className="text-2xl font-bold text-gray-900">{seller.listing.pending}</div>
                  </div>
                </div>
              </div>

              {/* Purchasing Status */}
              <div className="border border-gray-200 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">PURCHASING STATUS</h3>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <div className="text-xs text-gray-600 mb-1">DONE</div>
                    <div className="text-2xl font-bold text-gray-900">{seller.purchasing.done}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-600 mb-1">PENDING</div>
                    <div className="text-2xl font-bold text-gray-900">{seller.purchasing.pending}</div>
                  </div>
                </div>
              </div>

              {/* Delivered Status */}
              <div className="border border-gray-200 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">DELIVERD STATUS</h3>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <div className="text-xs text-gray-600 mb-1">DONE</div>
                    <div className="text-2xl font-bold text-gray-900">{seller.delivered.done}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-600 mb-1">PENDING</div>
                    <div className="text-2xl font-bold text-gray-900">{seller.delivered.pending}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg text-center">
        <p className="text-blue-800">🎉 Dashboard loaded successfully! Database integration coming soon.</p>
      </div>

      {/* Login Modal */}
      {showLoginModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-xl">
            <h2 className="text-2xl font-bold mb-4">
              {isLogin ? 'Login' : 'Sign Up'}
            </h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="your@email.com"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="••••••••"
                />
              </div>
              
              {authMessage && (
                <div className={`p-3 rounded-lg text-sm ${authMessage.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                  {authMessage.text}
                </div>
              )}
              
              <button
                onClick={handleAuth}
                className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition"
              >
                {isLogin ? 'Login' : 'Sign Up'}
              </button>
              
              <button
                onClick={() => setIsLogin(!isLogin)}
                className="w-full text-sm text-blue-600 hover:text-blue-700"
              >
                {isLogin ? "Don't have an account? Sign up" : 'Already have an account? Login'}
              </button>
              
              <button
                onClick={() => {
                  setShowLoginModal(false);
                  setAuthMessage(null);
                }}
                className="w-full px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold rounded-lg transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
