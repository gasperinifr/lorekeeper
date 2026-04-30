import { createClient } from '@supabase/supabase-js'

const BUCKET = 'lorekeeper'
let supabase

function getSupabase() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
    throw new Error('Storage nao configurado: defina SUPABASE_URL e SUPABASE_SERVICE_KEY.')
  }

  if (!supabase) {
    supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    )
  }

  return supabase
}

export async function ensureBucket() {
  const client = getSupabase()
  const { data, error } = await client.storage.getBucket(BUCKET)
  if (error && !/not found/i.test(error.message)) throw new Error(error.message)
  if (data) return

  const { error: createError } = await client.storage.createBucket(BUCKET, { public: true })
  if (createError && !/already exists/i.test(createError.message)) throw new Error(createError.message)
}

export async function uploadFile(path, buffer, contentType) {
  const client = getSupabase()
  const { error } = await client.storage
    .from(BUCKET)
    .upload(path, buffer, { contentType, upsert: true })
  if (error) throw new Error(error.message)

  const { data } = client.storage.from(BUCKET).getPublicUrl(path)
  return data.publicUrl
}

export async function deleteFile(path) {
  const client = getSupabase()
  const { error } = await client.storage.from(BUCKET).remove([path])
  if (error) throw new Error(error.message)
}
