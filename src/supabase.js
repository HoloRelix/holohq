import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = (url && key) ? createClient(url, key) : null

export const sbSignUp = (email, pass) =>
  supabase?.auth.signUp({ email, password: pass }) ?? Promise.resolve({ error: { message: 'Supabase not configured' } })

export const sbSignIn = (email, pass) =>
  supabase?.auth.signInWithPassword({ email, password: pass }) ?? Promise.resolve({ error: { message: 'Supabase not configured' } })

export const sbSignOut = () =>
  supabase?.auth.signOut() ?? Promise.resolve({})

export const sbSave = async (uid, data) => {
  if (!supabase) return
  await supabase.from('user_data').upsert(
    { user_id: uid, data, updated_at: new Date().toISOString() },
    { onConflict: 'user_id' }
  )
}

export const sbLoad = async (uid) => {
  if (!supabase) return null
  const { data } = await supabase.from('user_data').select('data').eq('user_id', uid).single()
  return data?.data ?? null
}

export const sbOnAuthChange = (cb) => {
  if (!supabase) return () => {}
  const { data } = supabase.auth.onAuthStateChange(cb)
  return () => data.subscription.unsubscribe()
}
