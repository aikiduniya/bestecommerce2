// Self-hosted build stand-in for the Lovable OAuth broker. Google sign-in uses Supabase Auth (VITE_OAUTH_MODE=supabase).
export const lovable = {
  auth: {
    signInWithOAuth: async (_provider: string, _opts?: unknown) => ({
      redirected: false as const,
      error: new Error("Lovable sign-in is not available in self-hosted builds. Set VITE_OAUTH_MODE=supabase."),
    }),
  },
};
