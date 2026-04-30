import { authenticate } from '../middleware/authenticate.js'
import { uploadFile, deleteFile } from '../lib/storage.js'
import { randomUUID } from 'crypto'

export async function uploadRoutes(fastify) {
  await fastify.register(import('@fastify/multipart'), { limits: { fileSize: 5 * 1024 * 1024 } })

  fastify.post('/uploads/image', { preHandler: authenticate }, async (req, reply) => {
    const data = await req.file()
    if (!data) return reply.status(400).send({ error: 'Nenhum arquivo enviado.' })
    const allowed = ['image/jpeg','image/png','image/webp']
    if (!allowed.includes(data.mimetype)) return reply.status(400).send({ error: 'Tipo não suportado.' })
    const ext      = data.mimetype.split('/')[1]
    const context  = req.query.context ?? 'misc'
    const key      = `${context}/${req.user.id}/${randomUUID()}.${ext}`
    const buffer   = await data.toBuffer()
    const publicUrl = await uploadFile(key, buffer, data.mimetype)
    return reply.send({ url: publicUrl, key })
  })

  fastify.delete('/uploads/image', { preHandler: authenticate }, async (req, reply) => {
    const { key } = req.body
    if (!key) return reply.status(400).send({ error: 'key é obrigatório.' })
    await deleteFile(key)
    return reply.status(204).send()
  })
}