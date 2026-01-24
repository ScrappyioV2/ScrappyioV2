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
  role: "admin" | "validation" | "purchase" | "viewer" | string;
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

  // Fetch user role with proper error handling
  const fetchUserRole = async (userId: string): Promise<boolean> => {
    // Prevent duplicate fetches for same user
    if (loadedUserId.current === userId && userRole) {
      return true;
    }

    try {
      const { data, error } = await supabase
        .from("user_roles")
        .select("*")
        .eq("user_id", userId)
        .single();

      if (error) {
        console.error("❌ Role fetch failed:", error);
        return false;
      }

      if (data) {
        console.log("✅ Auth Role Loaded:", data.role);
        setUserRole(data as UserRole);
        loadedUserId.current = userId;
        return true;
      }

      return false;
    } catch (err) {
      console.error("❌ Role fetch exception:", err);
      return false;
    }
  };

  // Initialize authentication on mount
  useEffect(() => {
    let isMounted = true;
    let loadingTimeout: NodeJS.Timeout;

    const initAuth = async () => {
      // Prevent multiple initializations
      if (isInitializing.current) return;
      isInitializing.current = true;

      // Safety timeout - force complete after 5 seconds
      loadingTimeout = setTimeout(() => {
        if (isMounted && loading) {
          console.warn("⚠️ Auth initialization timeout - forcing completion");
          setLoading(false);
          
          // Redirect to login if still no user
          if (!user) {
            router.push("/login");
          }
        }
      }, 5000);

      try {
        console.log("🔐 Initializing auth...");
        
        // Detect production environment
        const isProduction = typeof window !== 'undefined' && 
                            window.location.hostname !== 'localhost';
        
        let session = null;
        let error = null;

        if (isProduction) {
          // Production: Use API route for better reliability
          try {
            const response = await fetch("/api/auth/session", {
              method: "GET",
              credentials: "include",
              cache: "no-store",
            });

            if (response.ok) {
              const data = await response.json();
              session = data.session;
              error = data.error ? new Error(data.error) : null;
            } else {
              console.error("API session fetch failed with status:", response.status);
              // Fallback to direct Supabase call
              const result = await supabase.auth.getSession();
              session = result.data.session;
              error = result.error;
            }
          } catch (fetchError: any) {
            console.error("API session fetch failed:", fetchError);
            // Fallback to direct Supabase call
            const result = await supabase.auth.getSession();
            session = result.data.session;
            error = result.error;
          }
        } else {
          // Development: Direct Supabase call
          const result = await supabase.auth.getSession();
          session = result.data.session;
          error = result.error;
        }

        if (error) {
          console.error("❌ Session error:", error);
          if (isMounted) {
            setUser(null);
            setUserRole(null);
            setLoading(false);
          }
          return;
        }

        if (!isMounted) return;

        if (session?.user) {
          console.log("✅ Session found:", session.user.email);
          setUser(session.user);
          
          // Fetch role and WAIT for it to complete
          const roleLoaded = await fetchUserRole(session.user.id);
          
          if (!roleLoaded) {
            console.warn("⚠️ Failed to load user role");
          }
        } else {
          console.log("ℹ️ No active session");
          setUser(null);
          setUserRole(null);
        }
      } catch (error) {
        console.error("❌ Auth initialization error:", error);
        if (isMounted) {
          setUser(null);
          setUserRole(null);
        }
      } finally {
        clearTimeout(loadingTimeout);
        if (isMounted) {
          console.log("✅ Auth initialization complete");
          setLoading(false);
          isInitializing.current = false;
        }
      }
    };

    initAuth();

    // Set up auth state listener
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) return;

      console.log("🔄 Auth state changed:", event);

      if (event === "SIGNED_OUT") {
        setUser(null);
        setUserRole(null);
        loadedUserId.current = null;
        return;
      }

      if (session?.user) {
        setUser(session.user);
        
        // Only fetch role if user changed
        if (loadedUserId.current !== session.user.id) {
          setLoading(true);
          await fetchUserRole(session.user.id);
          setLoading(false);
        }
      } else {
        setUser(null);
        setUserRole(null);
        loadedUserId.current = null;
      }
    });

    return () => {
      isMounted = false;
      clearTimeout(loadingTimeout);
      authListener.subscription.unsubscribe();
    };
  }, []);

  const logout = async () => {
    try {
      await supabase.auth.signOut();
      setUser(null);
      setUserRole(null);
      loadedUserId.current = null;
      router.push("/login");
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  // STRICT PERMISSION CHECKER
  const hasPageAccess = (permissionKey: string): boolean => {
    // 1. Safety Check
    if (!userRole) return false;

    // 2. ADMIN BYPASS - Only if role is EXACTLY 'admin'
    if (userRole.role === "admin") return true;

    // 3. Public Pages
    if (permissionKey === "public") return true;

    // 4. Admin Only Pages - Strict Block
    if (permissionKey === "admin-access") return false;

    // 5. REGULAR USER CHECK - Ensure we are checking the actual allowed_pages array
    const pages = Array.isArray(userRole.allowed_pages) ? userRole.allowed_pages : [];
    return (
      pages.includes(permissionKey) ||
      pages.includes("all") ||
      pages.includes("*")
    );
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
