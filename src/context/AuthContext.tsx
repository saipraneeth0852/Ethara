import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/utils/supabase";
import type { User } from "@/types";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = async (authUser: any) => {
    if (!authUser) {
      setUser(null);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("users")
        .select("*")
        .eq("email", authUser.email)
        .single();

      if (error) {
        setUser(null);
        return;
      }

      setUser(data as User);
    } catch {
      setUser(null);
    }
  };

  const initializeAuth = async () => {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      setUser(null);
    } else {
      await fetchUser(user);
    }
    setLoading(false);
  };

  useEffect(() => {
    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      await fetchUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const login = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    const { data: { user } } = await supabase.auth.getUser();
    await fetchUser(user);
  };

  const signup = async (name: string, email: string, password: string) => {
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
    const { data: { user } } = await supabase.auth.getUser();
    await fetchUser(user);
    // Optionally add a user record to the `users` table if you manage users there.
  };

  const logout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setUser(null);
  };

  const refresh = async () => {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (error || !user) {
      setUser(null);
      return;
    }
    await fetchUser(user);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
