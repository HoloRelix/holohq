import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// ---- Auth helpers ----
export const signUp = (email, password) =>
  supabase.auth.signUp({ email, password })

export const signIn = (email, password) =>
  supabase.auth.signInWithPassword({ email, password })

export const signOut = () => supabase.auth.signOut()

export const getUser = () => supabase.auth.getUser()

// ---- Data helpers ----
// Save all user data as a single JSON blob (simple, fast, works great for this app)
export const saveUserData = async (userId, data) => {
  const { error } = await supabase
    .from('user_data')
    .upsert({ user_id: userId, data: data, updated_at: new Date().toISOString() }, 
             { onConflict: 'user_id' })
  return { error }
}

export const loadUserData = async (userId) => {
  const { data, error } = await supabase
    .from('user_data')
    .select('data')
    .eq('user_id', userId)
    .single()
  return { data: data?.data, error }
}
