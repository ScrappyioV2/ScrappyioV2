"use client";

import { useEffect, useState, useRef, createContext, useContext, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import type { User } from "@supabase/supabase-js";

export type UserRole = {
  id: string;
  user_id: string;
  email: string;
  full_name: string | null;
  role: 'admin' | 'validation' | 'purchase' | 'viewer' | string;
  allowed_pages: string[];
  is_active: boolean;
};

type AuthContextType = {
  user: User | null;
  userRole: UserRole | null;
  loading: boolean;
  logout: () => Promise<void>;
  isAdmin: boolean;
  hasPageAccess: (permissionKey: string) => boolean;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const isInitializing = useRef(false);
  const loadedUserId = useRef<string | null>(null);
  const fetchInProgress = useRef(false);

  // ✅ FIX: Load role from localStorage first, then database as fallback
  const fetchUserRole = async (userId: string): Promise<boolean> => {
    // STEP 1: Check cache for instant display
    let cacheHit = false;
    if (typeof window !== 'undefined') {
      const cachedRole = localStorage.getItem('scrappy_user_role');
      if (cachedRole) {
        try {
          const roleData = JSON.parse(cachedRole);
          if (roleData.user_id === userId) {
            setUserRole(roleData as UserRole);
            loadedUserId.current = userId;
            cacheHit = true;
          }
        } catch { }
      }
    }

    // STEP 2: Fetch fresh from DB
    const dbFetch = async () => {
      try {
        const { data, error } = await supabase
          .from('user_roles')
          .select('*')
          .eq('user_id', userId)
          .single();

        if (error) {
          console.error('❌ Role fetch error:', error.message);
          return false;
        }
        if (data) {
          setUserRole(data as UserRole);
          loadedUserId.current = userId;
          if (typeof window !== 'undefined') {
            localStorage.setItem('scrappy_user_role', JSON.stringify(data));
          }
          return true;
        }
        return false;
      } catch (err: any) {
        console.error('❌ DB fetch exception:', err.message);
        return false;
      }
    };

    if (cacheHit) {
      // Cache exists — don't block, fetch DB in background
      dbFetch();
      return true;
    } else {
      // No cache — must wait for DB
      return await dbFetch();
    }
  };

  // Initialize authentication on mount
  useEffect(() => {
    let isMounted = true;

    const initAuth = async () => {
      if (isInitializing.current) {
        return;
      }

      isInitializing.current = true;

      try {

        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) {
          console.error("❌ Session error:", error.message);
          if (isMounted) {
            setUser(null);
            setUserRole(null);
            setLoading(false);
          }
          return;
        }

        if (!isMounted) return;

        if (session?.user) {
          setUser(session.user);

          if (!fetchInProgress.current) {
            await fetchUserRole(session.user.id);
          }
        } else {
          setUser(null);
          setUserRole(null);
        }
      } catch (error: any) {
        console.error("❌ Auth initialization error:", error.message || error);
        if (isMounted) {
          setUser(null);
          setUserRole(null);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
          isInitializing.current = false;
        }
      }
    };

    initAuth();

    // Set up auth state listener
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) return;
      if (event === 'TOKEN_REFRESHED') return;

      if (event === "SIGNED_OUT") {
        setUser(null);
        setUserRole(null);
        loadedUserId.current = null;
        // Clear cached role
        if (typeof window !== 'undefined') {
          localStorage.removeItem('scrappy_user_role');
        }
        return;
      }

      if (event === "SIGNED_IN" && session?.user) {
        setUser(session.user);
        if (loadedUserId.current !== session.user.id && !fetchInProgress.current) {
          setLoading(true);
          await fetchUserRole(session.user.id);
          setLoading(false);
        }
      } else if (!session) {
        setUser(null);
        setUserRole(null);
        loadedUserId.current = null;
      }
    });

    return () => {
      isMounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  const logout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (error: any) {
      console.error("Logout error:", error.message || error);
    } finally {
      setUser(null);
      setUserRole(null);
      loadedUserId.current = null;
      fetchInProgress.current = false;

      if (typeof window !== 'undefined') {
        localStorage.removeItem('scrappy_user_role');
        const keys = Object.keys(localStorage);
        keys.forEach(key => {
          if (key.startsWith('sb-') || key.includes('supabase')) {
            localStorage.removeItem(key);
          }
        });
      }

      window.location.href = "/login?logout=true";
    }
  };

  const hasPageAccess = (permissionKey: string): boolean => {
    if (!userRole) return false;
    if (userRole.role === 'admin') return true;
    if (permissionKey === 'public') return true;
    if (permissionKey === 'admin-access') return false;
    const pages = Array.isArray(userRole.allowed_pages) ? userRole.allowed_pages : [];
    return pages.includes(permissionKey) || pages.includes('all') || pages.includes('*');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        userRole,
        loading,
        logout,
        isAdmin: userRole?.role === "admin",
        hasPageAccess,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}