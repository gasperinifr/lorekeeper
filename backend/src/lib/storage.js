import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

const BUCKET = 'lorekeeper'

export async function ensureBucket() {
  const { data } = await supabase.storage.getBucket(BUCKET)
  if (!data) await supabase.storage.createBucket(BUCKET, { public: true })
}

export async function uploadFile(path, buffer, contentType) {
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, buffer, { contentType, upsert: true })
  if (error) throw new Error(error.message)
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return data.publicUrl
}

export async function deleteFile(path) {
  await supabase.storage.from(BUCKET).remove([path])
}