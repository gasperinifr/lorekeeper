export async function authenticate(req, reply) {
  try {
    await req.jwtVerify()
  } catch {
    return reply.status(401).send({ error: 'Token inválido ou ausente.' })
  }
}

export async function requireCampaignAccess(req, reply) {
  await authenticate(req, reply)
  if (reply.sent) return

  const { db } = req.server
  const { campaignId } = req.params
  const userId = req.user.id

  const { rows } = await db.query(
    `SELECT
       CASE WHEN c.owner_id=$2 THEN 'admin' ELSE cm.role END AS role,
       CASE WHEN c.owner_id=$2 THEN 'gm' ELSE COALESCE(cm.play_role,'player') END AS play_role
     FROM campaigns c
     LEFT JOIN campaign_members cm ON cm.campaign_id=c.id AND cm.user_id=$2
     WHERE c.id=$1 AND (c.owner_id=$2 OR cm.user_id IS NOT NULL)`,
    [campaignId, userId]
  )
  if (!rows.length) return reply.status(403).send({ error: 'Acesso negado.' })
  req.campaignRole = rows[0].role
  req.campaignPlayRole = rows[0].play_role ?? 'player'
}

export async function requireEditor(req, reply) {
  await requireCampaignAccess(req, reply)
  if (reply.sent) return

  if (!['admin','editor'].includes(req.campaignRole)) {
    return reply.status(403).send({ error: 'Permissão de edição necessária.' })
  }
}
