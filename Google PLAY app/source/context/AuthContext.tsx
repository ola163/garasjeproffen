import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/lib/supabase";

const MESSE_EMAIL    = "messe@garasjeproffen.no";
const MESSE_PASSWORD = "Jdag2026";
const MESSE_KEY      = "gp_messe_session";

const MESSE_USER: User = {
  id: "messe-internal-00000000",
  email: MESSE_EMAIL,
  app_metadata: {},
  user_metadata: {},
  aud: "authenticated",
  created_at: "2024-01-01T00:00:00.000Z",
};

type AuthContextType = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  session: null, user: null, loading: true,
  signIn: async () => null, signUp: async () => null, signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session,      setSession]      = useState<Session | null>(null);
  const [messeActive,  setMesseActive]  = useState(false);
  const [loading,      setLoading]      = useState(true);

  useEffect(() => {
    async function boot() {
      // Check for persisted messe session
      const stored = await AsyncStorage.getItem(MESSE_KEY);
      if (stored === "1") { setMesseActive(true); setLoading(false); return; }

      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      setLoading(false);
    }
    boot();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    return () => subscription.unsubscribe();
  }, []);

  async function signIn(email: string, password: string): Promise<string | null> {
    if (email.trim().toLowerCase() === MESSE_EMAIL && password === MESSE_PASSWORD) {
      await AsyncStorage.setItem(MESSE_KEY, "1");
      setMesseActive(true);
      return null;
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error?.message ?? null;
  }

  async function signUp(email: string, password: string): Promise<string | null> {
    const { error } = await supabase.auth.signUp({ email, password });
    return error?.message ?? null;
  }

  async function signOut() {
    await AsyncStorage.removeItem(MESSE_KEY);
    setMesseActive(false);
    await supabase.auth.signOut();
  }

  const user = messeActive ? MESSE_USER : (session?.user ?? null);

  return (
    <AuthContext.Provider value={{ session, user, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
