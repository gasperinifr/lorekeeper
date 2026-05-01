import { useEffect, useState, FormEvent } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Copy, Mail, Trash2, UserPlus } from 'lucide-react'
import { useCampaign, useUpdateCampaign, useCreateInvite, useUpdateMember } from '@/hooks/useCampaign'
import { Input } from '@/components/ui/Input'
import { ImageUpload } from '@/components/ui/ImageUpload'
import { Button } from '@/components/ui/Button'
import { useUnsavedChangesPrompt } from '@/hooks/useUnsavedChangesPrompt'
import { api } from '@/api/client'
import { clsx } from 'clsx'

type InviteResult = {
  code: string
  invited_email?: string
  role: string
  play_role: string
  expires_at: string
}

const roleLabels: Record<string, string> = { viewer: 'Viewer', editor: 'Editor', admin: 'Admin' }
const playRoleLabels: Record<string, string> = { player: 'Jogador', gm: 'Mestre' }
const editableCampaignKeys = ['title', 'cover_image_url', 'description', 'status', 'visibility']
const serializeSettings = (value: unknown) => JSON.stringify(value ?? null)

export function CampaignSettings() {
  const { campaignId } = useParams<{ campaignId: string }>()
  const navigate = useNavigate()
  const { data: campaign, isLoading } = useCampaign(campaignId!)
  const updateCampaign = useUpdateCampaign(campaignId!)
  const createInvite = useCreateInvite(campaignId!)
  const updateMember = useUpdateMember(campaignId!)

  const [form, setForm] = useState<Record<string, string>>({})
  const [codeInvite, setCodeInvite] = useState({ role: 'viewer', play_role: 'player' })
  const [emailInvite, setEmailInvite] = useState({ email: '', role: 'viewer', play_role: 'player' })
  const [inviteResult, setInviteResult] = useState<InviteResult | null>(null)
  const [inviteError, setInviteError] = useState('')
  const [copied, setCopied] = useState(false)
  const [saved, setSaved] = useState(false)
  const [savedSnapshot, setSavedSnapshot] = useState('')

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const val = (k: string) => form[k] ?? (campaign as any)?.[k] ?? ''
  const currentSettings = Object.fromEntries(editableCampaignKeys.map(key => [key, val(key)]))

  useEffect(() => {
    if (campaign && !savedSnapshot) setSavedSnapshot(serializeSettings(currentSettings))
  }, [campaign, currentSettings, savedSnapshot])

  const saveSettings = async () => {
    await updateCampaign.mutateAsync(form)
    setSavedSnapshot(serializeSettings(currentSettings))
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  const hasUnsavedChanges = !!campaign && !!savedSnapshot && serializeSettings(currentSettings) !== savedSnapshot
  const { dialog: unsavedDialog } = useUnsavedChangesPrompt({
    when: hasUnsavedChanges && !updateCampaign.isPending,
    onSave: saveSettings,
    saving: updateCampaign.isPending,
  })

  if (isLoading || !campaign) return <div className="p-8 text-parchment/30 text-sm">Carregando...</div>

  const canAdmin = campaign.role === 'admin'

  const onSave = async (e: FormEvent) => {
    e.preventDefault()
    await saveSettings()
  }

  const buildInviteEmailHref = (email: string, code: string) =>
    `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(`Convite para ${campaign.title}`)}&body=${encodeURIComponent(`Use este codigo para entrar na campanha "${campaign.title}" no Lorekeeper:\n\n${code}`)}`

  const createInviteCode = async (email?: string) => {
    setInviteError('')
    setInviteResult(null)
    const data = email ? emailInvite : codeInvite
    const result = await createInvite.mutateAsync({
      email,
      role: data.role,
      play_role: data.play_role,
    })
    setInviteResult(result)
    return result
  }

  const onGenerateCode = async (e: FormEvent) => {
    e.preventDefault()
    try {
      await createInviteCode()
    } catch (err: any) {
      setInviteError(err.message)
    }
  }

  const onEmailInvite = async (e: FormEvent) => {
    e.preventDefault()
    const email = emailInvite.email.trim()
    if (!email) {
      setInviteError('Informe o email antes de preparar o convite.')
      return
    }
    try {
      const result = await createInviteCode(email)
      setEmailInvite({ email: '', role: 'viewer', play_role: 'player' })
      window.location.href = buildInviteEmailHref(email, result.code)
    } catch (err: any) {
      setInviteError(err.message)
    }
  }

  const copyInviteCode = async () => {
    if (!inviteResult) return
    await navigator.clipboard.writeText(inviteResult.code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const onDelete = async () => {
    if (!confirm('Excluir esta campanha permanentemente? Todos os dados serao perdidos.')) return
    await api.delete(`/campaigns/${campaignId}`)
    navigate('/dashboard')
  }

  const updateMemberField = (userId: string, key: 'role' | 'play_role', value: string) =>
    updateMember.mutate({ userId, [key]: value })

  const roleSelects = (value: { role: string; play_role: string }, onChange: (next: { role: string; play_role: string }) => void) => (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      <select
        value={value.role}
        onChange={e => onChange({ ...value, role: e.target.value })}
        className="bg-stone-200 border border-stone-300 rounded px-3 py-2 text-sm text-parchment focus:outline-none focus:border-gold/60"
      >
        <option value="viewer">Viewer</option>
        <option value="editor">Editor</option>
        {canAdmin && <option value="admin">Admin</option>}
      </select>
      <select
        value={value.play_role}
        onChange={e => onChange({ ...value, play_role: e.target.value })}
        className="bg-stone-200 border border-stone-300 rounded px-3 py-2 text-sm text-parchment focus:outline-none focus:border-gold/60"
      >
        <option value="player">Jogador</option>
        {canAdmin && <option value="gm">Mestre</option>}
      </select>
    </div>
  )

  return (
    <>
    {unsavedDialog}
    <div className="p-8 max-w-2xl mx-auto">
      <h1 className="font-display text-2xl text-parchment mb-8">Configuracoes da campanha</h1>

      <section className="mb-10">
        <h2 className="text-xs text-parchment/30 uppercase tracking-widest mb-4">Informacoes gerais</h2>
        <form onSubmit={onSave} className="flex flex-col gap-4">
          <Input label="Titulo" value={val('title')} onChange={set('title')} />

          <div className="flex flex-col gap-2">
            <label className="text-sm text-parchment/70 font-medium">Imagem da campanha</label>
            <ImageUpload
              currentUrl={val('cover_image_url')}
              context="campaigns"
              onUpload={url => setForm(f => ({ ...f, cover_image_url: url }))}
            />
            <Input label="URL da imagem" value={val('cover_image_url')} onChange={set('cover_image_url')} placeholder="https://..." />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm text-parchment/70 font-medium">Descricao</label>
            <textarea
              value={val('description')}
              onChange={set('description')}
              rows={3}
              className="bg-stone-200 border border-stone-300 rounded px-3 py-2 text-sm text-parchment placeholder-parchment/40 focus:outline-none focus:border-gold/60 resize-none"
            />
          </div>

          <div className="flex gap-4">
            <div className="flex flex-col gap-1 flex-1">
              <label className="text-sm text-parchment/70 font-medium">Status</label>
              <select value={val('status')} onChange={set('status')} className="bg-stone-200 border border-stone-300 rounded px-3 py-2 text-sm text-parchment focus:outline-none focus:border-gold/60">
                <option value="active">Ativa</option>
                <option value="paused">Pausada</option>
                <option value="completed">Concluida</option>
              </select>
            </div>
            <div className="flex flex-col gap-1 flex-1">
              <label className="text-sm text-parchment/70 font-medium">Visibilidade</label>
              <select value={val('visibility')} onChange={set('visibility')} className="bg-stone-200 border border-stone-300 rounded px-3 py-2 text-sm text-parchment focus:outline-none focus:border-gold/60">
                <option value="private">Privada</option>
                <option value="unlisted">Nao listada</option>
                <option value="public">Publica</option>
              </select>
            </div>
          </div>

          <Button type="submit" loading={updateCampaign.isPending} size="sm" className="self-start">
            {saved ? 'Salvo' : 'Salvar alteracoes'}
          </Button>
        </form>
      </section>

      <section className="mb-10">
        <h2 className="text-xs text-parchment/30 uppercase tracking-widest mb-4">Membros e cargos</h2>

        <div className="flex flex-col gap-2 mb-5">
          {(campaign.members ?? []).map(m => (
            <div key={m.id} className="flex flex-col gap-2 bg-stone-100 border border-stone-300 rounded-lg px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-gold/20 flex items-center justify-center text-gold text-xs font-bold">
                  {m.username[0].toUpperCase()}
                </div>
                <span className="text-sm text-parchment flex-1">{m.username}</span>
                <span className={clsx(
                  'text-xs px-2 py-0.5 rounded-full border',
                  m.role === 'admin' && 'text-gold border-gold/30 bg-gold/10',
                  m.role === 'editor' && 'text-sky-400 border-sky-400/30 bg-sky-400/10',
                  m.role === 'viewer' && 'text-parchment/30 border-stone-300',
                )}>
                  {roleLabels[m.role]}
                </span>
                <span className={clsx(
                  'text-xs px-2 py-0.5 rounded-full border',
                  m.play_role === 'gm' ? 'text-crimson-light border-crimson/30 bg-crimson/10' : 'text-parchment/35 border-stone-300',
                )}>
                  {playRoleLabels[m.play_role]}
                </span>
              </div>
              {canAdmin && (
                <div className="grid grid-cols-2 gap-2">
                  <select value={m.role} onChange={e => updateMemberField(m.id, 'role', e.target.value)} className="bg-stone-200 border border-stone-300 rounded px-3 py-2 text-xs text-parchment">
                    <option value="viewer">Viewer</option>
                    <option value="editor">Editor</option>
                    <option value="admin">Admin</option>
                  </select>
                  <select value={m.play_role} onChange={e => updateMemberField(m.id, 'play_role', e.target.value)} className="bg-stone-200 border border-stone-300 rounded px-3 py-2 text-xs text-parchment">
                    <option value="player">Jogador</option>
                    <option value="gm">Mestre</option>
                  </select>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="bg-stone-100 border border-stone-300 rounded-xl p-4 flex flex-col gap-4">
          <p className="text-sm text-parchment/60 font-medium flex items-center gap-2">
            <UserPlus size={14} /> Convidar membro
          </p>

          <form onSubmit={onGenerateCode} className="rounded-lg border border-stone-300 bg-stone-200 p-3 flex flex-col gap-3">
            <p className="text-xs text-parchment/40 uppercase tracking-widest">Codigo reutilizavel</p>
            {roleSelects(codeInvite, setCodeInvite)}
            <Button type="submit" size="sm" loading={createInvite.isPending} className="self-start">
              Gerar codigo
            </Button>
          </form>

          <form onSubmit={onEmailInvite} className="rounded-lg border border-stone-300 bg-stone-200 p-3 flex flex-col gap-3">
            <p className="text-xs text-parchment/40 uppercase tracking-widest">Convite por email</p>
            <Input
              placeholder="email@exemplo.com"
              type="email"
              value={emailInvite.email}
              onChange={e => setEmailInvite(i => ({ ...i, email: e.target.value }))}
            />
            {roleSelects(emailInvite, next => setEmailInvite(i => ({ ...i, ...next })))}
            <Button type="submit" size="sm" loading={createInvite.isPending} className="self-start">
              <Mail size={13} /> Preparar email
            </Button>
          </form>

          {inviteError && <p className="text-xs text-crimson-light">{inviteError}</p>}
          {inviteResult && (
            <div className="rounded-lg border border-gold/25 bg-gold/10 p-3 flex flex-col gap-3">
              <div>
                <p className="text-xs text-gold/70 uppercase tracking-widest mb-1">Codigo de convite</p>
                <p className="font-display text-lg text-parchment tracking-wide">{inviteResult.code}</p>
                <p className="text-xs text-parchment/35 mt-1">
                  Perfil: {roleLabels[inviteResult.role]} - Cargo: {playRoleLabels[inviteResult.play_role]} - expira em {new Date(inviteResult.expires_at).toLocaleDateString('pt-BR')}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" variant="ghost" onClick={copyInviteCode}>
                  <Copy size={13} /> {copied ? 'Copiado' : 'Copiar codigo'}
                </Button>
                {inviteResult.invited_email && (
                  <a href={buildInviteEmailHref(inviteResult.invited_email, inviteResult.code)}>
                    <Button type="button" size="sm" variant="ghost">
                      <Mail size={13} /> Abrir email
                    </Button>
                  </a>
                )}
              </div>
            </div>
          )}
        </div>
      </section>

      <section>
        <h2 className="text-xs text-crimson/60 uppercase tracking-widest mb-4">Zona de perigo</h2>
        <div className="bg-crimson/10 border border-crimson/20 rounded-xl p-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm text-parchment font-medium">Excluir campanha</p>
            <p className="text-xs text-parchment/40 mt-0.5">Esta acao e permanente e irreversivel.</p>
          </div>
          <Button variant="danger" size="sm" onClick={onDelete}>
            <Trash2 size={13} /> Excluir
          </Button>
        </div>
      </section>
    </div>
    </>
  )
}
