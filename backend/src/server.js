import Fastify        from 'fastify'
import cors           from '@fastify/cors'
import jwt            from '@fastify/jwt'
import 'dotenv/config'
import { db }               from './db/client.js'
import { ensureBucket }     from './lib/storage.js'
import { authRoutes }       from './routes/auth.js'
import { campaignRoutes }   from './routes/campaigns.js'
import { entityRoutes }     from './routes/entities.js'
import { linkRoutes }       from './routes/links.js'
import { tagRoutes }        from './routes/tags.js'
import { arcRoutes }        from './routes/arcs.js'
import { searchRoutes }     from './routes/search.js'
import { uploadRoutes }     from './routes/uploads.js'
import { fiveEtoolsRoutes } from './routes/fiveEtools.js'
import { aiRoutes }         from './routes/ai.js'
import { chatRoutes }       from './routes/chat.js'

const fastify = Fastify({ logger: true })

fastify.decorate('db', db)
await fastify.register(cors, { origin: true })
await fastify.register(jwt,  { secret: process.env.JWT_SECRET })

fastify.register(authRoutes,       { prefix: '/auth'      })
fastify.register(campaignRoutes,   { prefix: '/campaigns' })
fastify.register(entityRoutes)
fastify.register(linkRoutes)
fastify.register(tagRoutes)
fastify.register(arcRoutes)
fastify.register(searchRoutes)
fastify.register(uploadRoutes)
fastify.register(fiveEtoolsRoutes)
fastify.register(aiRoutes)
fastify.register(chatRoutes)

fastify.get('/health', async () => ({ status: 'ok' }))

try {
  await ensureBucket()
} catch (err) {
  fastify.log.error({ err }, 'Falha ao preparar bucket de imagens')
}

const port = Number(process.env.PORT) || 3333
await fastify.listen({ port, host: '0.0.0.0' })
console.log(`🧠 Lorekeeper rodando na porta ${port}`)
