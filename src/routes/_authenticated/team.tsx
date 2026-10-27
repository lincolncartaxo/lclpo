import { createFileRoute } from '@tanstack/react-router'
import { supabase } from '@/integrations/supabase/client'
import { useCallback, useState, useEffect } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Building2, Users, Star, UserPlus, Trash2, Mail } from 'lucide-react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"

export const Route = createFileRoute('/_authenticated/team')({
  component: TeamPage,
})

function TeamPage() {
  const { user } = useAuth()
  const [profile, setProfile] = useState<any>(null)
  const [empresa, setEmpresa] = useState<any>(null)
  const [members, setMembers] = useState<any[]>([])
  const [memberRoles, setMemberRoles] = useState<Record<string, string>>({})
  const [isGlobalAdmin, setIsGlobalAdmin] = useState(false)
  const [currentOrganizationRole, setCurrentOrganizationRole] = useState('member')
  const [canManageMembers, setCanManageMembers] = useState(false)
  const [loading, setLoading] = useState(true)
  const [openInvite, setOpenInvite] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')

  const loadData = useCallback(async () => {
    if (!user) return
    
    // Buscar perfil do usuário para saber qual a empresa dele
    const { data: prof } = await (supabase as any).from('profiles').select('*, empresas(*)').eq('id', user.id).single()
    setProfile(prof)
    
    if (prof?.empresas) {
      setEmpresa(prof.empresas)
      const [{ data: globalAdmin }, { data: membership }, { data: orgMembers }] = await Promise.all([
        (supabase as any).rpc('has_role', { _user_id: user.id, _role: 'admin' }),
        (supabase as any).from('organization_members').select('role').eq('organization_id', prof.empresas.id).eq('user_id', user.id).maybeSingle(),
        (supabase as any).from('organization_members').select('user_id, role').eq('organization_id', prof.empresas.id),
      ])
      setIsGlobalAdmin(Boolean(globalAdmin))
      setCurrentOrganizationRole(String(membership?.role || 'member'))
      setMemberRoles(Object.fromEntries((orgMembers || []).map((member: any) => [member.user_id, member.role])))
      setCanManageMembers(Boolean(globalAdmin) || ['owner', 'admin'].includes(String(membership?.role || '')))
      // Buscar todos os membros dessa empresa
      const { data: mems } = await (supabase as any).from('profiles').select('*').eq('id_empresa', prof.empresas.id)
      setMembers(mems || [])
    }
    
    setLoading(false)
  }, [user])

  useEffect(() => { void loadData() }, [loadData])

  const handleCreateCompany = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const nome = new FormData(e.currentTarget).get('nome') as string
    if (!nome) return toast.error("Informe o nome da empresa")
    
    setLoading(true)
    // 1. Criar empresa
    const { data: newEmpresa, error: e1 } = await (supabase as any).from('empresas').insert({ nome, plano: 'free', status: 'ativo' }).select().single()
    if (e1) { setLoading(false); return toast.error(e1.message) }
    
    // 2. Vincular usuário logado como dono/membro dessa empresa
    await (supabase as any).from('profiles').update({ id_empresa: newEmpresa.id }).eq('id', user?.id)
    
    toast.success("Sua empresa foi criada!")
    loadData()
  }

  const handleInvite = async () => {
    if (!inviteEmail) return toast.error("Informe um e-mail válido")
    // Em um SaaS real, aqui dispararíamos um e-mail via Resend/SendGrid com um link seguro.
    // Como estamos no MVP, vamos instruir o usuário a mandar o colega criar a conta primeiro.
    
    toast.info(`Instrução: Peça para ${inviteEmail} criar uma conta na tela de Login. Depois, o Administrador global poderá vinculá-lo a esta empresa.`, { duration: 8000 })
    setOpenInvite(false)
    setInviteEmail('')
  }

  const handleRemoveMember = async (memberId: string) => {
    if (!canManageMembers) return toast.error("Apenas administradores podem remover membros")
    if (memberId === user?.id) return toast.error("Você não pode remover a si mesmo")
    if (!confirm("Remover este usuário do seu time? Ele perderá acesso a todos os orçamentos da empresa.")) return
    
    const { error } = await (supabase as any).rpc('remove_organization_member', { p_user_id: memberId })
    if (error) return toast.error("Erro ao remover: " + error.message)
    
    toast.success("Usuário removido da empresa")
    loadData()
  }

  if (loading) return <div className="p-8">Carregando...</div>

  // Se o usuário ainda não pertence a nenhuma empresa
  if (!empresa) {
    return (
      <div className="p-8 max-w-2xl mx-auto mt-10">
        <Card className="text-center p-6">
          <Building2 className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <CardTitle className="mb-2">Bem-vindo ao LclPlan Empresarial</CardTitle>
          <CardDescription className="mb-6">
            Para criar orçamentos e convidar outros engenheiros para colaborar com você, primeiro crie o perfil da sua empresa.
          </CardDescription>
          <form onSubmit={handleCreateCompany} className="flex gap-2 max-w-sm mx-auto">
            <Input name="nome" placeholder="Nome da sua Construtora/Empresa" required />
            <Button type="submit" disabled={loading}>Criar Workspace</Button>
          </form>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">{empresa.nome}</h1>
          <p className="text-muted-foreground text-sm flex items-center gap-2 mt-1">
            Plano atual: <span className="uppercase font-semibold text-primary">{empresa.plano}</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase font-bold ${empresa.status === 'ativo' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
              {empresa.status}
            </span>
          </p>
          <div className="flex flex-wrap items-center gap-2 mt-2 text-xs">
            <span className="text-muted-foreground">Seu acesso:</span>
            {isGlobalAdmin && <span className="px-2 py-1 rounded-full bg-red-100 text-red-700 font-bold">Administrador global</span>}
            {currentOrganizationRole === 'owner' && <span className="px-2 py-1 rounded-full bg-amber-100 text-amber-700 font-bold">Owner da empresa</span>}
            {currentOrganizationRole === 'admin' && <span className="px-2 py-1 rounded-full bg-blue-100 text-blue-700 font-bold">Administrador da empresa</span>}
            {currentOrganizationRole === 'member' && <span className="px-2 py-1 rounded-full bg-slate-100 text-slate-700 font-medium">Membro</span>}
          </div>
        </div>
        <Button variant="outline" className="bg-primary/5 text-primary border-primary/20"><Star className="w-4 h-4 mr-2"/> Fazer Upgrade</Button>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <Card className="md:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-lg flex items-center gap-2"><Users className="w-5 h-5"/> Equipe</CardTitle>
              <CardDescription>Membros que têm acesso aos orçamentos da {empresa.nome}.</CardDescription>
            </div>
            {canManageMembers && <Button size="sm" onClick={() => setOpenInvite(true)}><UserPlus className="w-4 h-4 mr-2"/> Convidar</Button>}
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>Acesso</TableHead><TableHead></TableHead></TableRow></TableHeader>
              <TableBody>
                {members.map(m => (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-600">
                        {m.nome ? m.nome.substring(0,2).toUpperCase() : 'US'}
                      </div>
                      {m.nome || 'Usuário Sem Nome'} {m.id === user?.id && <span className="text-xs text-muted-foreground">(Você)</span>}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {['owner', 'admin'].includes(memberRoles[m.id]) ? 'Administrador da empresa' : 'Membro'}
                    </TableCell>
                    <TableCell className="text-right">
                      {canManageMembers && m.id !== user?.id && (
                        <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => handleRemoveMember(m.id)}>
                          Remover
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Consumo do Plano</CardTitle>
            <CardDescription>Uso da sua conta</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-1"><span>Usuários</span> <span className="font-medium">{members.length} / {empresa.plano === 'free' ? '1' : 'Ilimitado'}</span></div>
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div className="bg-blue-500 h-full" style={{ width: empresa.plano === 'free' ? `${(members.length / 1) * 100}%` : '5%' }}></div>
              </div>
            </div>
            
            <div className="pt-4 border-t border-slate-100">
              <p className="text-xs text-muted-foreground text-center">
                Para convidar mais engenheiros ou desbloquear orçamentos ilimitados, assine o plano <b>PRO</b>.
              </p>
              <Button className="w-full mt-3" variant="secondary">Ver Planos</Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={openInvite} onOpenChange={setOpenInvite}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Convidar Membro</DialogTitle>
            <DialogDescription>
              Adicione um novo engenheiro ou orçamentista ao Workspace da sua empresa.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>E-mail do colaborador</Label>
              <Input type="email" placeholder="engenheiro@suaempresa.com.br" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenInvite(false)}>Cancelar</Button>
            <Button onClick={handleInvite}><Mail className="w-4 h-4 mr-2"/> Enviar Convite</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
