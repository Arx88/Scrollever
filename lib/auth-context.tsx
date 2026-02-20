"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import type { SupabaseClient, User as SupabaseUser } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/client"

export interface User {
  id: string
  email: string
  username: string
  avatarUrl: string | null
  createdAt: string
}

interface AuthContextType {
  user: User | null
  isLoading: boolean
  signIn: (email: string, password: string) => Promise<{ error?: string }>
  signUp: (email: string, password: string, username: string) => Promise<{ error?: string }>
  signOut: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)
const MISSING_ENV_ERROR = "Faltan variables NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY"

export function AuthProvider({ children }: { children: ReactNode }) {
  const supabase = useMemo<SupabaseClient | null>(() => {
    try {
      return createClient()
    } catch {
      return null
    }
  }, [])

  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const buildUser = useCallback(
    async (authUser: SupabaseUser): Promise<User> => {
      if (!supabase) {
        const fallbackUsername = authUser.email?.split("@")[0] ?? "user"
        return {
          id: authUser.id,
          email: authUser.email ?? "",
          username: fallbackUsername,
          avatarUrl: null,
          createdAt: authUser.created_at,
        }
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("username,avatar_url,created_at")
        .eq("id", authUser.id)
        .maybeSingle()

      const fallbackUsername = authUser.email?.split("@")[0] ?? "user"

      return {
        id: authUser.id,
        email: authUser.email ?? "",
        username: profile?.username ?? fallbackUsername,
        avatarUrl: profile?.avatar_url ?? null,
        createdAt: profile?.created_at ?? authUser.created_at,
      }
    },
    [supabase]
  )

  const syncUser = useCallback(
    async (authUser: SupabaseUser | null) => {
      if (!authUser) {
        setUser(null)
        setIsLoading(false)
        return
      }

      const nextUser = await buildUser(authUser)
      setUser(nextUser)
      setIsLoading(false)
    },
    [buildUser]
  )

  useEffect(() => {
    if (!supabase) {
      setIsLoading(false)
      return
    }

    let mounted = true

    const bootstrap = async () => {
      const { data } = await supabase.auth.getSession()
      if (!mounted) {
        return
      }

      await syncUser(data.session?.user ?? null)
    }

    void bootstrap()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      void syncUser(session?.user ?? null)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [supabase, syncUser])

  const signIn = useCallback(
    async (email: string, password: string) => {
      if (!supabase) {
        return { error: MISSING_ENV_ERROR }
      }

      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        return { error: error.message }
      }

      const { data } = await supabase.auth.getUser()
      await syncUser(data.user ?? null)

      return {}
    },
    [supabase, syncUser]
  )

  const signUp = useCallback(
    async (email: string, password: string, username: string) => {
      if (!supabase) {
        return { error: MISSING_ENV_ERROR }
      }

      const redirectBase = typeof window !== "undefined" ? window.location.origin : undefined

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectBase ? `${redirectBase}/auth/sign-up-success` : undefined,
          data: {
            username,
          },
        },
      })

      if (error) {
        return { error: error.message }
      }

      if (data.user) {
        const { error: profileError } = await supabase
          .from("profiles")
          .update({ username })
          .eq("id", data.user.id)

        if (profileError) {
          return { error: profileError.message }
        }
      }

      if (data.session?.user) {
        await syncUser(data.session.user)
      }

      return {}
    },
    [supabase, syncUser]
  )

  const signOut = useCallback(() => {
    if (supabase) {
      void supabase.auth.signOut()
    }
    setUser(null)
  }, [supabase])

  const value = useMemo<AuthContextType>(() => {
    return {
      user,
      isLoading,
      signIn,
      signUp,
      signOut,
    }
  }, [isLoading, signIn, signOut, signUp, user])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
