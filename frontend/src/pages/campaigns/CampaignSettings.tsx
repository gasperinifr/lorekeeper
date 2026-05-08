import { useEffect, useState, FormEvent } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Copy, SlidersHorizontal, Trash2, UserPlus, X } from 'lucide-react'
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

const roleLabels: Record<string, string> = { viewer: 'Visualizador', editor: 'Editor', admin: 'Administrador' }
const playRoleLabels: Record<string, string> = { player: 'Jogador', gm: 'Mestre' }
const editableCampaignKeys = ['title', 'description', 'status', 'visibility']
const serializeSettings = (value: unknown) => JSON.stringify(value ?? null)

type BannerFit = 'cover' | 'contain'

function BannerDisplayDialog({
  imageUrl,
  fit,
  position,
  onFitChange,
  onPositionChange,
  onClose,
  onSave,
  saving,
}: {
  imageUrl: string
  fit: string
  position: string
  onFitChange: (value: string) => void
  onPositionChange: (value: string) => void
  onClose: () => void
  onSave: () => void
  saving: boolean
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/80 backdrop-blur-sm">
      <div className="w-full max-w-3xl rounded-xl border border-stone-300 bg-stone-100 shadow-xl p-5 flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="font-display text-lg text-parchment">Exibição do banner no Hub</h3>
            <p className="text-xs text-parchment/35 mt-1">Ajusta apenas como o banner aparece na tela inicial da campanha.</p>
          </div>
          <button type="button" onClick={onClose} className="text-parchment/35 hover:text-parchment transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="h-56 rounded-lg overflow-hidden bg-stone-200 border border-stone-300 flex items-center justify-center">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt="Prévia do banner"
              className={clsx('h-full w-full', fit === 'cover' ? 'object-cover' : 'object-contain')}
              style={{ objectPosition: position }}
            />
          ) : (
            <p className="text-xs text-parchment/30">Sem imagem para pré-visualizar.</p>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-sm text-parchment/70 font-medium">Encaixe</label>
            <select
              value={fit}
              onChange={e => onFitChange(e.target.value)}
              className="bg-stone-200 border border-stone-300 rounded px-3 py-2 text-sm text-parchment focus:outline-none focus:border-gold/60"
            >
              <option value="cover">Preencher o banner</option>
              <option value="contain">Mostrar imagem inteira</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm text-parchment/70 font-medium">Foco</label>
            <select
              value={position}
              onChange={e => onPositionChange(e.target.value)}
              className="bg-stone-200 border border-stone-300 rounded px-3 py-2 text-sm text-parchment focus:outline-none focus:border-gold/60"
            >
              <option value="center">Centro</option>
              <option value="top">Topo</option>
              <option value="bottom">Base</option>
              <option value="left">Esquerda</option>
              <option value="right">Direita</option>
            </select>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>Cancelar</Button>
          <Button type="button" size="sm" onClick={onSave} loading={saving}>Salvar banner</Button>
        </div>
      </div>
    </div>
  )
}

export function CampaignSettings() {
  const { campaignId } = useParams<{ campaignId: string }>()
  const navigate = useNavigate()
  const { data: campaign, isLoading } = useCampaign(campaignId!)
  const updateCampaign = useUpdateCampaign(campaignId!)
  const updateCoverCampaign = useUpdateCampaign(campaignId!)
  const updateHubBannerCampaign = useUpdateCampaign(campaignId!)
  const createInvite = useCreateInvite(campaignId!)
  const updateMember = useUpdateMember(campaignId!)

  const [form, setForm] = useState<Record<string, string>>({})
  const [codeInvite, setCodeInvite] = useState({ role: 'viewer', play_role: 'player' })
  const [deleteConfirmName, setDeleteConfirmName] = useState('')
  const [inviteResult, setInviteResult] = useState<InviteResult | null>(null)
  const [inviteError, setInviteError] = useState('')
  const [deleteError, setDeleteError] = useState('')
  const [copied, setCopied] = useState(false)
  const [saved, setSaved] = useState(false)
  const [savedCover, setSavedCover] = useState(false)
  const [savedHubBanner, setSavedHubBanner] = useState(false)
  const [savedSnapshot, setSavedSnapshot] = useState('')
  const [coverSnapshot, setCoverSnapshot] = useState('')
  const [hubBannerSnapshot, setHubBannerSnapshot] = useState('')
  const [deleteArmed, setDeleteArmed] = useState(false)
  const [showBannerDisplay, setShowBannerDisplay] = useState(false)

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const val = (k: string) => form[k] ?? (campaign as any)?.[k] ?? ''
  const currentSettings = Object.fromEntries(editableCampaignKeys.map(key => [key, val(key)]))
  const currentCover = val('cover_image_url')
  const currentHubBanner = val('hub_banner_url')
  const currentHubBannerFit = val('hub_banner_fit') || 'cover'
  const currentHubBannerPosition = val('hub_banner_position') || 'center'

  useEffect(() => {
    if (!campaign) return
    if (!savedSnapshot) setSavedSnapshot(serializeSettings(currentSettings))
    if (!coverSnapshot) setCoverSnapshot(serializeSettings(currentCover))
    if (!hubBannerSnapshot) setHubBannerSnapshot(serializeSettings({ currentHubBanner, currentHubBannerFit, currentHubBannerPosition }))
  }, [campaign, currentSettings, currentCover, currentHubBanner, currentHubBannerFit, currentHubBannerPosition, savedSnapshot, coverSnapshot, hubBannerSnapshot])

  const saveSettings = async () => {
    await updateCampaign.mutateAsync({
      title: val('title'),
      description: val('description'),
      status: val('status') as 'active' | 'paused' | 'completed',
      visibility: val('visibility') as 'private' | 'unlisted' | 'public',
    })
    setSavedSnapshot(serializeSettings(currentSettings))
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  const saveCoverOnly = async () => {
    await updateCoverCampaign.mutateAsync({ cover_image_url: currentCover })
    setCoverSnapshot(serializeSettings(currentCover))
    setSavedCover(true)
    setTimeout(() => setSavedCover(false), 2500)
  }

  const saveHubBannerOnly = async () => {
    await updateHubBannerCampaign.mutateAsync({
      hub_banner_url: currentHubBanner,
      hub_banner_fit: currentHubBannerFit as BannerFit,
      hub_banner_position: currentHubBannerPosition,
    })
    setHubBannerSnapshot(serializeSettings({ currentHubBanner, currentHubBannerFit, currentHubBannerPosition }))
    setSavedHubBanner(true)
    setTimeout(() => setSavedHubBanner(false), 2500)
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

  const createInviteCode = async () => {
    setInviteError('')
    setInviteResult(null)
    const data = codeInvite
    const result = await createInvite.mutateAsync({
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

  const copyInviteCode = async () => {
    if (!inviteResult) return
    await navigator.clipboard.writeText(inviteResult.code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const onDelete = async () => {
    setDeleteError('')
    const expected = campaign.title.trim()
    if (deleteConfirmName.trim() !== expected) {
      setDeleteError('Para excluir a campanha, digite o nome exato no campo de confirmação.')
      return
    }
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
        <option value="viewer">Visualizador</option>
        <option value="editor">Editor</option>
        {canAdmin && <option value="admin">Administrador</option>}
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
    {showBannerDisplay && (
      <BannerDisplayDialog
        imageUrl={currentHubBanner || currentCover}
        fit={currentHubBannerFit}
        position={currentHubBannerPosition}
        onFitChange={value => setForm(f => ({ ...f, hub_banner_fit: value }))}
        onPositionChange={value => setForm(f => ({ ...f, hub_banner_position: value }))}
        onClose={() => setShowBannerDisplay(false)}
        onSave={() => saveHubBannerOnly().then(() => setShowBannerDisplay(false))}
        saving={updateHubBannerCampaign.isPending}
      />
    )}
    <div className="p-8 w-full max-w-[1400px] mx-auto">
      <h1 className="font-display text-2xl text-parchment mb-8">Configurações da campanha</h1>

      <section className="mb-10">
        <h2 className="text-xs text-parchment/30 uppercase tracking-widest mb-4">Informações gerais</h2>
        <form onSubmit={onSave} className="flex flex-col gap-4">
          <Input label="Título" value={val('title')} onChange={set('title')} />

          <div className="flex flex-col gap-1">
            <label className="text-sm text-parchment/70 font-medium">Descrição</label>
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
                <option value="completed">Concluída</option>
              </select>
            </div>
            <div className="flex flex-col gap-1 flex-1">
              <label className="text-sm text-parchment/70 font-medium">Visibilidade</label>
              <select value={val('visibility')} onChange={set('visibility')} className="bg-stone-200 border border-stone-300 rounded px-3 py-2 text-sm text-parchment focus:outline-none focus:border-gold/60">
                <option value="private">Privada</option>
                <option value="unlisted">Não listada</option>
                <option value="public">Pública</option>
              </select>
            </div>
          </div>

          <Button type="submit" loading={updateCampaign.isPending} size="sm" className="self-start">
            {saved ? 'Salvo' : 'Salvar alterações'}
          </Button>

          <section className="rounded-xl border border-stone-300 bg-stone-100 p-4 flex flex-col gap-4">
            <div>
              <h3 className="text-sm text-parchment font-medium">Imagens da campanha</h3>
              <p className="text-xs text-parchment/35 mt-1">A capa aparece nos cards. O banner controla somente o topo do Hub da campanha.</p>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">
              <div className="rounded-lg border border-stone-300 bg-stone-200/40 p-4 flex flex-col gap-2">
                <label className="text-sm text-parchment/70 font-medium">Imagem da capa</label>
                <ImageUpload
                  currentUrl={val('cover_image_url')}
                  context="campaigns"
                  fieldKey="cover_image_url"
                  className="campaign-settings-image-upload"
                  onUpload={url => setForm(f => ({ ...f, cover_image_url: url }))}
                />
                <Input label="URL da capa" value={val('cover_image_url')} onChange={set('cover_image_url')} placeholder="https://..." />
                <Button type="button" size="sm" className="self-start" onClick={saveCoverOnly} loading={updateCoverCampaign.isPending}>
                  {savedCover ? 'Imagem salva' : 'Salvar imagem da capa'}
                </Button>
              </div>

              <div className="rounded-lg border border-stone-300 bg-stone-200/40 p-4 flex flex-col gap-2 min-w-0">
                <label className="text-sm text-parchment/70 font-medium">Banner do Hub</label>
                <ImageUpload
                  currentUrl={val('hub_banner_url')}
                  context="campaign-banners"
                  fieldKey="hub_banner_url"
                  className="campaign-settings-image-upload"
                  onUpload={url => setForm(f => ({ ...f, hub_banner_url: url }))}
                />
                <Input label="URL do banner" value={val('hub_banner_url')} onChange={set('hub_banner_url')} placeholder="https://..." />
                <div className="flex flex-wrap gap-2">
                  <Button type="button" size="sm" className="self-start" onClick={saveHubBannerOnly} loading={updateHubBannerCampaign.isPending}>
                    {savedHubBanner ? 'Banner salvo' : 'Salvar banner do Hub'}
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setShowBannerDisplay(true)} disabled={!currentHubBanner && !currentCover}>
                    <SlidersHorizontal size={13} /> Exibição no Hub
                  </Button>
                </div>
              </div>
            </div>
          </section>
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
                    <option value="viewer">Visualizador</option>
                    <option value="editor">Editor</option>
                    <option value="admin">Administrador</option>
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
            <p className="text-xs text-parchment/40 uppercase tracking-widest">Código de convite</p>
            {roleSelects(codeInvite, setCodeInvite)}
            <Button type="submit" size="sm" loading={createInvite.isPending} className="self-start">
              Gerar código
            </Button>
          </form>

          {inviteError && <p className="text-xs text-crimson-light">{inviteError}</p>}
          {inviteResult && (
            <div className="rounded-lg border border-gold/25 bg-gold/10 p-3 flex flex-col gap-3">
              <div>
                <p className="text-xs text-gold/70 uppercase tracking-widest mb-1">Código de convite</p>
                <p className="font-display text-lg text-parchment tracking-wide">{inviteResult.code}</p>
                <p className="text-xs text-parchment/35 mt-1">
                  Perfil: {roleLabels[inviteResult.role]} - Cargo: {playRoleLabels[inviteResult.play_role]} - expira em {new Date(inviteResult.expires_at).toLocaleDateString('pt-BR')}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" variant="ghost" onClick={copyInviteCode}>
                  <Copy size={13} /> {copied ? 'Copiado' : 'Copiar código'}
                </Button>
              </div>
            </div>
          )}
        </div>
      </section>

      <section>
        <h2 className="text-xs text-crimson/60 uppercase tracking-widest mb-4">Zona de perigo</h2>
        <div className="bg-crimson/10 border border-crimson/20 rounded-xl p-4 flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="min-w-0">
            <p className="text-sm text-parchment font-medium">Excluir campanha</p>
            <p className="text-xs text-parchment/40 mt-0.5">Esta ação é permanente e irreversível.</p>
          </div>
          <Button
            type="button"
            variant="danger"
            size="sm"
            onClick={() => setDeleteArmed(true)}
            className="self-start sm:self-auto"
          >
            <Trash2 size={13} /> Excluir campanha
          </Button>
        </div>
        {deleteArmed && (
          <div className="rounded-lg border border-crimson/25 bg-ink/25 p-4 flex flex-col gap-3">
            <Input
              label={`Digite "${campaign.title}" para confirmar`}
              value={deleteConfirmName}
              onChange={e => setDeleteConfirmName(e.target.value)}
            />
            {deleteError && <p className="text-xs text-crimson-light">{deleteError}</p>}
            <div className="flex flex-wrap gap-2">
              <Button variant="danger" size="sm" onClick={onDelete} disabled={deleteConfirmName.trim() !== campaign.title.trim()}>
                <Trash2 size={13} /> Excluir permanentemente
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setDeleteArmed(false)
                  setDeleteConfirmName('')
                  setDeleteError('')
                }}
              >
                Cancelar
              </Button>
            </div>
          </div>
        )}
        </div>
      </section>
    </div>
    </>
  )
}
