# Cache Redis/Valkey — Guia de implementação

## Arquitetura

Padrão **cache-aside** com **TTL curto** (30s–5min). O Redis nunca é obrigatório:
se `REDIS_URL` não estiver configurada ou o servidor cair, as rotas continuam
funcionando normalmente via banco de dados (graceful degradation).

```
Request
  │
  ▼
cache.getOrSet(key, ttl, fn)
  │
  ├── HIT  → retorna do Redis (sem tocar no Postgres)
  │
  └── MISS → executa fn() → salva no Redis → retorna resultado
```

## O que está sendo cacheado

| Dado                         | Chave                                         | TTL     | Motivo                                      |
|------------------------------|-----------------------------------------------|---------|---------------------------------------------|
| Perfil do usuário            | `user:{id}:profile`                           | 2 min   | Chamado em todo render do header            |
| Lista de campanhas           | `user:{id}:campaigns`                         | 1 min   | Dashboard inicial                           |
| Acesso à campanha (role)     | `campaign:{id}:access:{userId}`               | 1 min   | Executado em **toda** rota protegida        |
| Detalhe da campanha          | `campaign:{id}:detail:{userId}`               | 1.5 min | Inclui lista de membros (query pesada)      |
| Tags da campanha             | `campaign:{id}:tags`                          | 3 min   | Lidas em todas as entidades                 |
| Lista de arcos               | `campaign:{id}:arcs:{role}`                   | 2 min   | Carregada no sidebar                        |
| Lista de sessões             | `campaign:{id}:sessions:{role}`               | 2 min   | Carregada no sidebar                        |
| Lista de entidades           | `campaign:{id}:{type}:list:{role}:{userId}`   | 1 min   | NPCs, locais, itens… listados constantemente|
| Detalhe de entidade          | `campaign:{id}:{type}:{entityId}`             | 1.5 min | Inclui links, tags e eventos (4 queries)    |

## O que NÃO está sendo cacheado (intencional)

- **Chat / diário** — mensagens em tempo real, nunca devem ser stale
- **Eventos** — criados durante sessão ao vivo
- **Encounters** — gerenciados ao vivo durante a sessão
- **Links entre entidades** — operações de escrita frequentes
- **Busca** — queries dinâmicas com texto variável
- **AI / uploads** — operações únicas por natureza

## Invalidação

Toda rota de escrita (POST/PATCH/DELETE) invalida as chaves afetadas **antes** de retornar.

### Helpers disponíveis em `middleware/authenticate.js`:

```js
invalidateCampaignAccess(campaignId, userId)   // acesso de um usuário específico
invalidateCampaignAllUsers(campaignId)          // tudo da campanha (delByPrefix)
invalidateUserCampaignList(userId)              // lista de campanhas do usuário
```

### Helpers em `lib/cache.js`:

```js
cache.del(key)                 // deleta uma chave específica
cache.delByPrefix('campaign:X:') // deleta todas as chaves com esse prefixo (usa SCAN, não KEYS)
```

## Configuração

### 1. Opção gratuita recomendada: Upstash Redis

1. Acesse [upstash.com](https://upstash.com) e crie uma conta (gratuito)
2. Crie um banco Redis — plano **Free** inclui 10.000 req/dia
3. Copie a `REDIS_URL` do painel e cole no `.env`:

```env
REDIS_URL=redis://:sua-senha@seu-banco.upstash.io:6379
```

### 2. Alternativa local (desenvolvimento)

```bash
# Docker
docker run -d -p 6379:6379 redis:alpine

# ou Valkey (fork open-source do Redis)
docker run -d -p 6379:6379 valkey/valkey:alpine
```

```env
REDIS_URL=redis://localhost:6379
```

### 3. Sem Redis (padrão atual)

Não é necessário configurar nada. O sistema funciona normalmente sem cache.
Apenas defina `REDIS_URL` quando quiser ativar.

## Monitoramento

Para verificar hit/miss rate em produção, você pode inspecionar os logs
do Redis com `redis-cli monitor` ou usar o painel do Upstash.

## Adicionar cache a uma nova rota

```js
import { cache, cacheKey, TTL } from '../lib/cache.js'

// Leitura com cache-aside
fastify.get('/campaigns/:campaignId/minha-rota', async (req, reply) => {
  const key = `campaign:${req.params.campaignId}:minha-rota`
  const data = await cache.getOrSet(key, TTL.ENTITY_LIST, async () => {
    const { rows } = await db.query('SELECT ...', [...])
    return rows
  })
  return reply.send(data)
})

// Escrita com invalidação
fastify.post('/campaigns/:campaignId/minha-rota', async (req, reply) => {
  // ... lógica de inserção ...
  await cache.del(`campaign:${req.params.campaignId}:minha-rota`)
  // ou: await cache.delByPrefix(`campaign:${req.params.campaignId}:minha-`)
  return reply.status(201).send(resultado)
})
```
