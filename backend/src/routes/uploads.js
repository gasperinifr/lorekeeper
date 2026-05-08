import { randomUUID } from 'crypto'
import { authenticate } from '../middleware/authenticate.js'
import { uploadFile, deleteFile } from '../lib/storage.js'

export async function uploadRoutes(fastify) {
  await fastify.register(import('@fastify/multipart'), { limits: { fileSize: 5 * 1024 * 1024 } })

  fastify.post('/uploads/image', { preHandler: authenticate }, async (req, reply) => {
    try {
      const data = await req.file()
      if (!data) return reply.status(400).send({ error: 'Nenhum arquivo enviado.' })

      const allowed = ['image/jpeg', 'image/png', 'image/webp']
      if (!allowed.includes(data.mimetype)) {
        return reply.status(400).send({ error: 'Tipo não suportado.' })
      }

      const ext = data.mimetype.split('/')[1]
      const context = req.query.context ?? 'misc'
      const key = `${context}/${req.user.id}/${randomUUID()}.${ext}`
      const buffer = await data.toBuffer()
      const publicUrl = await uploadFile(key, buffer, data.mimetype)

      return reply.send({ url: publicUrl, key })
    } catch (err) {
      req.log.error({ err }, 'Falha ao enviar imagem')

      if (err.code === 'FST_REQ_FILE_TOO_LARGE') {
        return reply.status(413).send({ error: 'Imagem muito grande. Envie um arquivo de ate 5MB.' })
      }

      if (/Storage não configurado/i.test(err.message)) {
        return reply.status(500).send({
          error: 'Upload de imagens não configurado no backend. Defina SUPABASE_URL e SUPABASE_SERVICE_KEY no Fly.',
        })
      }

      if (/Invalid Compact JWS/i.test(err.message)) {
        return reply.status(500).send({
          error: 'Chave do Supabase invalida. Confira se SUPABASE_SERVICE_KEY no Fly e a service_role key do projeto.',
        })
      }

      return reply.status(500).send({ error: `Falha ao enviar imagem: ${err.message}` })
    }
  })

  fastify.delete('/uploads/image', { preHandler: authenticate }, async (req, reply) => {
    try {
      const { key } = req.body
      if (!key) return reply.status(400).send({ error: 'key é obrigatório.' })

      await deleteFile(key)
      return reply.status(204).send()
    } catch (err) {
      req.log.error({ err }, 'Falha ao remover imagem')
      return reply.status(500).send({ error: `Falha ao remover imagem: ${err.message}` })
    }
  })
}
