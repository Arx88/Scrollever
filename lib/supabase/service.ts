import { createClient } from "@supabase/supabase-js"

interface ServiceEnv {
  url: string
  roleKey: string
}

function getServiceEnv(): ServiceEnv {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const roleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !roleKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
  }

  return { url, roleKey }
}

export function isServiceClientConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
}

export function createServiceClient() {
  const { url, roleKey } = getServiceEnv()

  return createClient(url, roleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  })
}
