import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing Supabase environment variables. Check your .env file.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: "pkce",
    // ✅ REMOVED custom storage - use default cookie storage for client-server sync
  },
});

export default supabase;





// import { createClient } from "@supabase/supabase-js";

// const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
// const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// if (!supabaseUrl || !supabaseAnonKey) {
//   throw new Error("Missing Supabase environment variables. Check your .env file.");
// }

// export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
//   auth: {
//     persistSession: true, // Enables session persistence
//     autoRefreshToken: true, // Auto-refresh tokens before expiry
//     detectSessionInUrl: true, // Detect session from URL (OAuth flows)
//     flowType: "pkce", // Secure auth flow for production
//     storage: typeof window !== "undefined" ? window.localStorage : undefined,
//     storageKey: "scrappy-auth-token", // Custom storage key
//   },
// });

// export default supabase;
