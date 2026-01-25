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
  const fetchInProgress = useRef(false);

  // Fetch user role
  const fetchUserRole = async (userId: string): Promise<boolean> => {
    if (loadedUserId.current === userId && userRole) {
      console.log("✅ Role already loaded, skipping fetch");
      return true;
    }

    if (fetchInProgress.current) {
      console.log("⏭️ Role fetch already in progress, skipping");
      return false;
    }

    try {
      fetchInProgress.current = true;
      console.log("🔍 Fetching role for user:", userId);
      
      // ✅ FIX: Increased timeout to 10 seconds
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Role fetch timeout')), 10000)
      );
      
      const fetchPromise = supabase
        .from("user_roles")
        .select("*")
        .eq("user_id", userId)
        .single();

      const { data, error } = await Promise.race([
        fetchPromise,
        timeoutPromise
      ]) as any;

      if (error) {
        console.error("❌ Role fetch error:", error.message, error);
        return false;
      }

      if (data) {
        console.log("✅ Auth Role Loaded:", data.role);
        setUserRole(data as UserRole);
        loadedUserId.current = userId;
        return true;
      }

      console.warn("⚠️ No role data found for user");
      return false;
    } catch (err: any) {
      console.error("❌ Role fetch exception:", err.message || err);
      return false;
    } finally {
      fetchInProgress.current = false;
    }
  };

  // Initialize authentication on mount
  useEffect(() => {
    let isMounted = true;

    const initAuth = async () => {
      if (isInitializing.current) {
        console.log("⏭️ Already initializing, skipping");
        return;
      }

      isInitializing.current = true;

      try {
        console.log("🔐 Initializing auth...");
        
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
          console.log("✅ Session found:", session.user.email);
          setUser(session.user);

          if (!fetchInProgress.current) {
            const roleLoaded = await fetchUserRole(session.user.id);
            if (!roleLoaded) {
              console.warn("⚠️ Failed to load user role");
            }
          }
        } else {
          console.log("ℹ️ No active session");
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
      setUser(null);
      setUserRole(null);
      loadedUserId.current = null;
      fetchInProgress.current = false;
      window.location.href = "/login";
    } catch (error: any) {
      console.error("Logout error:", error.message || error);
    }
  };

  const hasPageAccess = (permissionKey: string): boolean => {
    if (!userRole) return false;
    if (userRole.role === "admin") return true;
    if (permissionKey === "public") return true;
    if (permissionKey === "admin-access") return false;

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






// "use client";

// import { useEffect, useState, useRef, createContext, useContext, ReactNode } from "react";
// import { useRouter } from "next/navigation";
// import { supabase } from "@/lib/supabaseClient";
// import type { User } from "@supabase/supabase-js";

// export type UserRole = {
//   id: string;
//   user_id: string;
//   email: string;
//   full_name: string | null;
//   role: "admin" | "validation" | "purchase" | "viewer" | string;
//   allowed_pages: string[];
//   is_active: boolean;
// };

// type AuthContextType = {
//   user: User | null;
//   userRole: UserRole | null;
//   loading: boolean;
//   logout: () => Promise<void>;
//   isAdmin: boolean;
//   hasPageAccess: (permissionKey: string) => boolean;
// };

// const AuthContext = createContext<AuthContextType | undefined>(undefined);

// export function AuthProvider({ children }: { children: ReactNode }) {
//   const [user, setUser] = useState<User | null>(null);
//   const [userRole, setUserRole] = useState<UserRole | null>(null);
//   const [loading, setLoading] = useState(true);
//   const router = useRouter();
//   const isInitializing = useRef(false);
//   const loadedUserId = useRef<string | null>(null);

//   // Fetch user role with NO abort signals - simpler approach
//   const fetchUserRole = async (userId: string): Promise<boolean> => {
//     if (loadedUserId.current === userId && userRole) {
//       console.log("✅ Role already loaded, skipping fetch");
//       return true;
//     }

//     try {
//       console.log("🔍 Fetching role for user:", userId);
      
//       const { data, error } = await supabase
//         .from("user_roles")
//         .select("*")
//         .eq("user_id", userId)
//         .single();

//       if (error) {
//         console.error("❌ Role fetch error:", error.message, error.details);
//         return false;
//       }

//       if (data) {
//         console.log("✅ Auth Role Loaded:", data.role);
//         setUserRole(data as UserRole);
//         loadedUserId.current = userId;
//         return true;
//       }

//       console.warn("⚠️ No role data found for user");
//       return false;
//     } catch (err: any) {
//       console.error("❌ Role fetch exception:", err.message || err);
//       return false;
//     }
//   };

//   // Initialize authentication on mount
//   useEffect(() => {
//     let isMounted = true;

//     const initAuth = async () => {
//       if (isInitializing.current) {
//         console.log("⏭️ Already initializing, skipping");
//         return;
//       }
//       isInitializing.current = true;

//       try {
//         console.log("🔐 Initializing auth...");
        
//         const { data: { session }, error } = await supabase.auth.getSession();

//         if (error) {
//           console.error("❌ Session error:", error.message);
//           if (isMounted) {
//             setUser(null);
//             setUserRole(null);
//             setLoading(false);
//           }
//           return;
//         }

//         if (!isMounted) return;

//         if (session?.user) {
//           console.log("✅ Session found:", session.user.email);
//           setUser(session.user);
          
//           // Fetch role with a small delay to ensure session is fully established
//           await new Promise(resolve => setTimeout(resolve, 100));
          
//           const roleLoaded = await fetchUserRole(session.user.id);
          
//           if (!roleLoaded) {
//             console.warn("⚠️ Failed to load user role");
//           }
//         } else {
//           console.log("ℹ️ No active session");
//           setUser(null);
//           setUserRole(null);
//         }
//       } catch (error: any) {
//         console.error("❌ Auth initialization error:", error.message || error);
//         if (isMounted) {
//           setUser(null);
//           setUserRole(null);
//         }
//       } finally {
//         if (isMounted) {
//           console.log("✅ Auth initialization complete");
//           setLoading(false);
//           isInitializing.current = false;
//         }
//       }
//     };

//     initAuth();

//     // Set up auth state listener
//     const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
//       if (!isMounted) return;

//       console.log("🔄 Auth state changed:", event);

//       if (event === "SIGNED_OUT") {
//         setUser(null);
//         setUserRole(null);
//         loadedUserId.current = null;
//         return;
//       }

//       if (event === "SIGNED_IN" && session?.user) {
//         setUser(session.user);
        
//         // Only fetch role if user changed
//         if (loadedUserId.current !== session.user.id) {
//           setLoading(true);
//           await fetchUserRole(session.user.id);
//           setLoading(false);
//         }
//       } else if (!session) {
//         setUser(null);
//         setUserRole(null);
//         loadedUserId.current = null;
//       }
//     });

//     return () => {
//       isMounted = false;
//       authListener.subscription.unsubscribe();
//     };
//   }, []);

//   const logout = async () => {
//     try {
//       await supabase.auth.signOut();
//       setUser(null);
//       setUserRole(null);
//       loadedUserId.current = null;
//       router.push("/login");
//     } catch (error: any) {
//       console.error("Logout error:", error.message || error);
//     }
//   };

//   const hasPageAccess = (permissionKey: string): boolean => {
//     if (!userRole) return false;
//     if (userRole.role === "admin") return true;
//     if (permissionKey === "public") return true;
//     if (permissionKey === "admin-access") return false;

//     const pages = Array.isArray(userRole.allowed_pages) ? userRole.allowed_pages : [];
//     return (
//       pages.includes(permissionKey) ||
//       pages.includes("all") ||
//       pages.includes("*")
//     );
//   };

//   return (
//     <AuthContext.Provider
//       value={{
//         user,
//         userRole,
//         loading,
//         logout,
//         isAdmin: userRole?.role === "admin",
//         hasPageAccess,
//       }}
//     >
//       {children}
//     </AuthContext.Provider>
//   );
// }

// export function useAuth() {
//   const context = useContext(AuthContext);
//   if (context === undefined) {
//     throw new Error("useAuth must be used within an AuthProvider");
//   }
//   return context;
// }
