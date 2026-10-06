import { createFileRoute, redirect } from '@tanstack/react-router'
import { supabase } from '@/integrations/supabase/client'
import { useState, useEffect } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Trash2, Edit, Users, Building, FileText, Database, HardHat, Plus, Search, ListPlus } from 'lucide-react'
import { toast } from 'sonner'

export const Route = createFileRoute('/_authenticated/admin')({
  ssr: false,
  beforeLoad: async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) throw redirect({ to: '/login' })
    const { data: isAdmin } = await supabase.rpc('has_role', { _user_id: session.user.id, _role: 'admin' })
    if (!isAdmin) throw redirect({ to: '/dashboard' })
  },
  component: AdminPanel,
})

function AdminPanel() {
  const [activeTab, setActiveTab] = useState("usuarios")

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Painel de Controle Administrativo</h1>
          <p className="text-muted-foreground mt-2">CRUD completo de inquilinos, usuários, bases de referência e orçamentos.</p>
        </div>
      </div>

      <Tabs defaultValue="usuarios" className="w-full" onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5 h-12">
          <TabsTrigger value="usuarios" className="flex items-center gap-2"><Users className="w-4 h-4"/> Usuários</TabsTrigger>
          <TabsTrigger value="empresas" className="flex items-center gap-2"><Building className="w-4 h-4"/> Empresas</TabsTrigger>
          <TabsTrigger value="insumos" className="flex items-center gap-2"><Database className="w-4 h-4"/> Insumos</TabsTrigger>
          <TabsTrigger value="composicoes" className="flex items-center gap-2"><HardHat className="w-4 h-4"/> Composições</TabsTrigger>
          <TabsTrigger value="orcamentos" className="flex items-center gap-2"><FileText className="w-4 h-4"/> Orçamentos</TabsTrigger>
        </TabsList>

        <TabsContent value="usuarios"><UsuariosManager /></TabsContent>
        <TabsContent value="empresas"><EmpresasManager /></TabsContent>
        <TabsContent value="insumos"><InsumosManager /></TabsContent>
        <TabsContent value="composicoes"><ComposicoesManager /></TabsContent>
        <TabsContent value="orcamentos"><OrcamentosManager /></TabsContent>
      </Tabs>
    </div>
  )
}

function UsuariosManager() {
  const [users, setUsers] = useState<any[]>([])
  const [empresas, setEmpresas] = useState<any[]>([])
  const [form, setForm] = useState<any>({ id: '', nome: '', role: 'user', empresa: 'none' })
  const [open, setOpen] = useState(false)

  const fetchUsers = async () => {
    const { data } = await supabase.from('profiles').select('*, ')
    setUsers(data || [])
  }
  
  useEffect(() => {
    fetchUsers()
    ;(supabase as any).from('empresas').select('id, nome').then(({data}: any) => setEmpresas(data || []))
  }, [])

  const handleSave = async () => {
    const payload = { 
      nome: form.nome, 
      
      empresa: form.empresa === 'none' ? null : form.empresa
    }
    const { error } = await supabase.from('profiles').update(payload).eq('id', form.id)
    if (error) return toast.error(error.message)
    toast.success("Usuário atualizado")
    setOpen(false)
    fetchUsers()
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir este perfil de usuário? O login na auth pode persistir se não for removido no painel do Supabase.")) return
    const { error } = await supabase.from('profiles').delete().eq('id', id)
    if (error) toast.error(error.message)
    else { toast.success("Excluído com sucesso"); fetchUsers() }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Gestão de Usuários</CardTitle>
        <CardDescription>Edite funções e vincule usuários às suas empresas (Tenants).</CardDescription>
      </CardHeader>
      <CardContent>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Editar Usuário</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>Nome</Label><Input value={form.nome||''} onChange={e=>setForm({...form, nome: e.target.value})} /></div>
              <div>
                <Label>Role</Label>
                <Select value={form.role||'user'} onValueChange={v=>setForm({...form, role: v})}>
                  <SelectTrigger><SelectValue/></SelectTrigger>
                  <SelectContent><SelectItem value="user">User</SelectItem><SelectItem value="admin">Admin</SelectItem></SelectContent>
                </Select>
              </div>
              <div>
                <Label>Empresa (Tenant)</Label>
                <Select value={form.empresa||'none'} onValueChange={v=>setForm({...form, id_empresa: v})}>
                  <SelectTrigger><SelectValue/></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem vínculo</SelectItem>
                    {empresas.map(e => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter><Button onClick={handleSave}>Salvar</Button></DialogFooter>
          </DialogContent>
        </Dialog>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Empresa</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map(u => (
              <TableRow key={u.id}>
                <TableCell>{u.nome || 'Sem Nome'}</TableCell>
                <TableCell>{u.role || 'user'}</TableCell>
                <TableCell>{u.empresa || '-'}</TableCell>
                <TableCell className="text-right space-x-2">
                  <Button variant="outline" size="sm" onClick={() => { setForm({id: u.id, nome: u.nome, role: u.role, id_empresa: u.empresa||'none'}); setOpen(true) }}><Edit className="w-4 h-4"/></Button>
                  <Button variant="destructive" size="sm" onClick={() => handleDelete(u.id)}><Trash2 className="w-4 h-4"/></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

function EmpresasManager() {
  const [empresas, setEmpresas] = useState<any[]>([])
  const [form, setForm] = useState<any>({ id: null, nome: '', plano: 'basic', status: 'ativo' })
  const [open, setOpen] = useState(false)

  const fetch = async () => { const { data } = await (supabase as any).from('empresas').select('*').order('nome'); setEmpresas(data || []) }
  useEffect(() => { fetch() }, [])

  const handleSave = async () => {
    if (!form.nome) return toast.error("Nome é obrigatório")
    const payload = { ...form }
    if (!payload.id) delete payload.id
    const { error } = await (supabase as any).from('empresas').upsert(payload)
    if (error) return toast.error(error.message)
    toast.success("Empresa salva!")
    setOpen(false)
    fetch()
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir empresa? Certifique-se de que não existem orçamentos atrelados a ela.")) return
    const { error } = await (supabase as any).from('empresas').delete().eq('id', id)
    if (error) toast.error(error.message)
    else { toast.success("Excluída"); fetch() }
  }

  const openNew = () => { setForm({ id: null, nome: '', plano: 'basic', status: 'ativo' }); setOpen(true) }

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div><CardTitle>Workgroups (Empresas)</CardTitle><CardDescription>Gerencie clientes e assinaturas.</CardDescription></div>
          <Button onClick={openNew}><Plus className="w-4 h-4 mr-2"/> Nova Empresa</Button>
        </div>
      </CardHeader>
      <CardContent>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>{form.id ? 'Editar' : 'Nova'} Empresa</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>Nome</Label><Input value={form.nome} onChange={e=>setForm({...form, nome: e.target.value})} /></div>
              <div>
                <Label>Plano</Label>
                <Select value={form.plano} onValueChange={v=>setForm({...form, plano: v})}>
                  <SelectTrigger><SelectValue/></SelectTrigger>
                  <SelectContent><SelectItem value="basic">Basic</SelectItem><SelectItem value="pro">Pro</SelectItem><SelectItem value="enterprise">Enterprise</SelectItem></SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={v=>setForm({...form, status: v})}>
                  <SelectTrigger><SelectValue/></SelectTrigger>
                  <SelectContent><SelectItem value="ativo">Ativo</SelectItem><SelectItem value="inativo">Bloqueado</SelectItem></SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter><Button onClick={handleSave}>Salvar</Button></DialogFooter>
          </DialogContent>
        </Dialog>

        <Table>
          <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>Plano</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader>
          <TableBody>
            {empresas.map(e => (
              <TableRow key={e.id}>
                <TableCell className="font-medium">{e.nome}</TableCell><TableCell>{e.plano}</TableCell>
                <TableCell><span className={`px-2 py-1 rounded-full text-xs font-semibold ${e.status === 'ativo' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{e.status?.toUpperCase()}</span></TableCell>
                <TableCell className="text-right space-x-2">
                  <Button variant="outline" size="sm" onClick={() => { setForm(e); setOpen(true) }}><Edit className="w-4 h-4"/></Button>
                  <Button variant="destructive" size="sm" onClick={() => handleDelete(e.id)}><Trash2 className="w-4 h-4"/></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

function InsumosManager() {
  const [q, setQ] = useState("")
  const [rows, setRows] = useState<any[]>([])
  const [form, setForm] = useState<any>({ id: null, codigo: '', descricao: '', unidade: '', preco_desonerado: 0, preco_nao_desonerado: 0, fonte: 'SINAPI' })
  const [open, setOpen] = useState(false)

  const search = async () => {
    let query = supabase.from('base_insumos').select('*').limit(50)
    if (q) query = query.textSearch('descricao', q)
    const { data } = await query
    setRows(data || [])
  }

  const handleSave = async () => {
    const payload = { ...form, preco_desonerado: Number(form.preco_desonerado), preco_nao_desonerado: Number(form.preco_nao_desonerado) }
    if (!payload.id) delete payload.id
    const { error } = await supabase.from('base_insumos').upsert(payload)
    if (error) return toast.error(error.message)
    toast.success("Insumo salvo!")
    setOpen(false)
    search()
  }

  const handleDelete = async (id: number) => {
    if (!confirm("Excluir insumo da base global?")) return
    const { error } = await supabase.from('base_insumos').delete().eq('id', id)
    if (error) toast.error(error.message)
    else { toast.success("Excluído"); search() }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Insumos (Preços de Referência)</CardTitle>
        <CardDescription>CRUD de itens básicos da base.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input placeholder="Buscar (ex: areia)..." value={q} onChange={e=>setQ(e.target.value)} onKeyDown={e => e.key === 'Enter' && search()} />
          <Button onClick={search}><Search className="w-4 h-4 mr-2"/>Buscar</Button>
          <Button variant="secondary" onClick={() => { setForm({ id: null, codigo: '', descricao: '', unidade: 'un', preco_desonerado: 0, preco_nao_desonerado: 0, fonte: 'SINAPI' }); setOpen(true) }}><Plus className="w-4 h-4 mr-2"/>Novo Insumo</Button>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>{form.id ? 'Editar' : 'Novo'} Insumo</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2"><Label>Descrição</Label><Input value={form.descricao} onChange={e=>setForm({...form, descricao: e.target.value})} /></div>
              <div><Label>Código</Label><Input value={form.codigo} onChange={e=>setForm({...form, codigo: e.target.value})} /></div>
              <div><Label>Unidade</Label><Input value={form.unidade} onChange={e=>setForm({...form, unidade: e.target.value})} /></div>
              <div><Label>Preço Desonerado (R$)</Label><Input type="number" step="0.01" value={form.preco_desonerado} onChange={e=>setForm({...form, preco_desonerado: e.target.value})} /></div>
              <div><Label>Preço Não Desonerado (R$)</Label><Input type="number" step="0.01" value={form.preco_nao_desonerado} onChange={e=>setForm({...form, preco_nao_desonerado: e.target.value})} /></div>
              <div className="col-span-2"><Label>Fonte</Label><Input value={form.fonte} onChange={e=>setForm({...form, fonte: e.target.value})} /></div>
            </div>
            <DialogFooter><Button onClick={handleSave}>Salvar</Button></DialogFooter>
          </DialogContent>
        </Dialog>

        <Table>
          <TableHeader><TableRow><TableHead>Código</TableHead><TableHead>Fonte</TableHead><TableHead>Descrição</TableHead><TableHead>Unid</TableHead><TableHead className="text-right">Deson.</TableHead><TableHead className="text-right">Não Deson.</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader>
          <TableBody>
            {rows.map((r, i) => (
              <TableRow key={i}>
                <TableCell className="font-mono text-xs">{r.codigo}</TableCell><TableCell>{r.fonte}</TableCell><TableCell className="max-w-xs truncate">{r.descricao}</TableCell><TableCell>{r.unidade}</TableCell>
                <TableCell className="text-right">R$ {r.preco_desonerado}</TableCell>
                <TableCell className="text-right">R$ {r.preco_nao_desonerado}</TableCell>
                <TableCell className="text-right space-x-2">
                  <Button variant="outline" size="sm" onClick={() => { setForm(r); setOpen(true) }}><Edit className="w-4 h-4"/></Button>
                  <Button variant="destructive" size="sm" onClick={() => handleDelete(r.id)}><Trash2 className="w-4 h-4"/></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

function ComposicoesManager() {
  const [q, setQ] = useState("")
  const [rows, setRows] = useState<any[]>([])
  const [form, setForm] = useState<any>({ id: null, codigo: '', descricao: '', unidade: '', custo_desonerado: 0, custo_nao_desonerado: 0, fonte: 'SINAPI' })
  const [open, setOpen] = useState(false)
  const [itensModalComp, setItensModalComp] = useState<any>(null)

  const search = async () => {
    let query = supabase.from('base_composicoes').select('*').limit(50)
    if (q) query = query.textSearch('descricao', q)
    const { data } = await query
    setRows(data || [])
  }

  const handleSave = async () => {
    const payload = { ...form, custo_desonerado: Number(form.custo_desonerado), custo_nao_desonerado: Number(form.custo_nao_desonerado) }
    if (!payload.id) delete payload.id
    const { error } = await supabase.from('base_composicoes').upsert(payload)
    if (error) return toast.error(error.message)
    toast.success("Composição salva!")
    setOpen(false)
    search()
  }

  const handleDelete = async (id: number) => {
    if (!confirm("Excluir composição? Todos os itens internos dela também deveriam ser excluídos/órfãos.")) return
    const { error } = await supabase.from('base_composicoes').delete().eq('id', id)
    if (error) toast.error(error.message)
    else { toast.success("Excluído"); search() }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Composições (Macro-serviços)</CardTitle>
        <CardDescription>Gerencie as composições e visualize os itens (insumos) que a formam.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input placeholder="Buscar composição..." value={q} onChange={e=>setQ(e.target.value)} onKeyDown={e => e.key === 'Enter' && search()} />
          <Button onClick={search}><Search className="w-4 h-4 mr-2"/>Buscar</Button>
          <Button variant="secondary" onClick={() => { setForm({ id: null, codigo: '', descricao: '', unidade: 'm2', custo_desonerado: 0, custo_nao_desonerado: 0, fonte: 'SINAPI' }); setOpen(true) }}><Plus className="w-4 h-4 mr-2"/>Nova Composição</Button>
        </div>

        {/* Modal de CRUD da Composição */}
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>{form.id ? 'Editar' : 'Nova'} Composição</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2"><Label>Descrição</Label><Input value={form.descricao} onChange={e=>setForm({...form, descricao: e.target.value})} /></div>
              <div><Label>Código</Label><Input value={form.codigo} onChange={e=>setForm({...form, codigo: e.target.value})} /></div>
              <div><Label>Unidade</Label><Input value={form.unidade} onChange={e=>setForm({...form, unidade: e.target.value})} /></div>
              <div><Label>Custo Desonerado</Label><Input type="number" step="0.01" value={form.custo_desonerado} onChange={e=>setForm({...form, custo_desonerado: e.target.value})} /></div>
              <div><Label>Custo Não Desonerado</Label><Input type="number" step="0.01" value={form.custo_nao_desonerado} onChange={e=>setForm({...form, custo_nao_desonerado: e.target.value})} /></div>
              <div className="col-span-2"><Label>Fonte</Label><Input value={form.fonte} onChange={e=>setForm({...form, fonte: e.target.value})} /></div>
            </div>
            <DialogFooter><Button onClick={handleSave}>Salvar</Button></DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Modal de Itens da Composição */}
        {itensModalComp && <ItensDaComposicaoModal comp={itensModalComp} onClose={() => setItensModalComp(null)} />}

        <Table>
          <TableHeader><TableRow><TableHead>Código</TableHead><TableHead>Descrição</TableHead><TableHead>Unid</TableHead><TableHead className="text-right">Deson.</TableHead><TableHead className="text-right">Não Deson.</TableHead><TableHead className="text-center">Ações</TableHead></TableRow></TableHeader>
          <TableBody>
            {rows.map((r, i) => (
              <TableRow key={i}>
                <TableCell className="font-mono text-xs">{r.codigo}</TableCell><TableCell className="max-w-xs truncate">{r.descricao}</TableCell><TableCell>{r.unidade}</TableCell>
                <TableCell className="text-right">R$ {r.custo_desonerado}</TableCell>
                <TableCell className="text-right">R$ {r.custo_nao_desonerado}</TableCell>
                <TableCell className="text-center space-x-1 whitespace-nowrap">
                  <Button variant="secondary" size="sm" onClick={() => setItensModalComp(r)} title="Itens da Composição"><ListPlus className="w-4 h-4"/></Button>
                  <Button variant="outline" size="sm" onClick={() => { setForm(r); setOpen(true) }}><Edit className="w-4 h-4"/></Button>
                  <Button variant="destructive" size="sm" onClick={() => handleDelete(r.id)}><Trash2 className="w-4 h-4"/></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

function ItensDaComposicaoModal({ comp, onClose }: { comp: any, onClose: () => void }) {
  const [itens, setItens] = useState<any[]>([])
  const [form, setForm] = useState({ insumo_codigo: '', descricao: '', unidade: 'un', coeficiente: 1, tipo: 'INSUMO', fonte: comp.fonte })

  const fetchItens = async () => {
    const { data } = await supabase.from('base_composicao_itens').select('*').eq('composicao_codigo', comp.codigo)
    setItens(data || [])
  }
  useEffect(() => { fetchItens() }, [comp.codigo])

  const handleAdd = async () => {
    if (!form.insumo_codigo || !form.descricao) return toast.error("Código e descrição são necessários")
    const payload = {
      composicao_codigo: comp.codigo,
      insumo_codigo: form.insumo_codigo,
      descricao: form.descricao,
      unidade: form.unidade,
      coeficiente: Number(form.coeficiente),
      tipo: form.tipo,
      fonte: form.fonte
    }
    const { error } = await supabase.from('base_composicao_itens').insert([payload])
    if (error) return toast.error(error.message)
    toast.success("Item adicionado")
    setForm({ insumo_codigo: '', descricao: '', unidade: 'un', coeficiente: 1, tipo: 'INSUMO', fonte: comp.fonte })
    fetchItens()
  }

  const handleRemove = async (id: number) => {
    const { error } = await supabase.from('base_composicao_itens').delete().eq('id', id)
    if (error) toast.error(error.message)
    else fetchItens()
  }

  return (
    <Dialog open={true} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader><DialogTitle>Itens da Composição: {comp.codigo}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <p className="text-sm font-medium">{comp.descricao}</p>
          
          <div className="bg-muted p-4 rounded-md grid grid-cols-4 gap-2 items-end">
            <div><Label>Tipo</Label>
              <Select value={form.tipo} onValueChange={v=>setForm({...form, tipo: v})}>
                <SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="INSUMO">Insumo</SelectItem><SelectItem value="COMPOSICAO">Composição (Aux)</SelectItem></SelectContent>
              </Select>
            </div>
            <div><Label>Cód Insumo</Label><Input value={form.insumo_codigo} onChange={e=>setForm({...form, insumo_codigo: e.target.value})} /></div>
            <div className="col-span-2"><Label>Descrição</Label><Input value={form.descricao} onChange={e=>setForm({...form, descricao: e.target.value})} /></div>
            <div><Label>Und</Label><Input value={form.unidade} onChange={e=>setForm({...form, unidade: e.target.value})} /></div>
            <div><Label>Coeficiente</Label><Input type="number" step="0.0001" value={form.coeficiente} onChange={e=>setForm({...form, coeficiente: Number(e.target.value)})} /></div>
            <div className="col-span-2"><Button onClick={handleAdd} className="w-full">Adicionar Item</Button></div>
          </div>

          <div className="max-h-60 overflow-auto border rounded-md">
            <Table>
              <TableHeader><TableRow><TableHead>Tipo</TableHead><TableHead>Cód</TableHead><TableHead>Descrição</TableHead><TableHead>Coeficiente</TableHead><TableHead></TableHead></TableRow></TableHeader>
              <TableBody>
                {itens.map(i => (
                  <TableRow key={i.id}>
                    <TableCell className="text-xs">{i.tipo}</TableCell>
                    <TableCell className="font-mono text-xs">{i.insumo_codigo || i.composicao_codigo}</TableCell>
                    <TableCell className="text-xs truncate max-w-[200px]" title={i.descricao}>{i.descricao}</TableCell>
                    <TableCell>{i.coeficiente}</TableCell>
                    <TableCell><Button variant="ghost" size="sm" onClick={()=>handleRemove(i.id)}><Trash2 className="w-4 h-4 text-red-500"/></Button></TableCell>
                  </TableRow>
                ))}
                {itens.length === 0 && <TableRow><TableCell colSpan={5} className="text-center py-4">Nenhum item cadastrado nesta composição</TableCell></TableRow>}
              </TableBody>
            </Table>
          </div>
        </div>
        <DialogFooter><Button onClick={onClose} variant="secondary">Fechar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function OrcamentosManager() {
  const [orcamentos, setOrcamentos] = useState<any[]>([])

  const fetch = async () => {
    const { data } = await supabase.from('orcamentos').select('*').order('created_at', { ascending: false }).limit(100)
    setOrcamentos(data || [])
  }
  useEffect(() => { fetch() }, [])

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza? Esta ação deletará o orçamento e todos os seus itens da base de dados global permanentemente.")) return
    const { error } = await supabase.from('orcamentos').delete().eq('id', id)
    if (error) toast.error(error.message)
    else { toast.success("Orçamento excluído"); fetch() }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Gestão de Orçamentos Globais</CardTitle>
        <CardDescription>Auditoria de todos os orçamentos criados pelos usuários na plataforma.</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow><TableHead>ID</TableHead><TableHead>Nome da Obra</TableHead><TableHead>Município</TableHead><TableHead>BDI</TableHead><TableHead>Data Criação</TableHead><TableHead className="text-right">Ações</TableHead></TableRow>
          </TableHeader>
          <TableBody>
            {orcamentos.map(o => (
              <TableRow key={o.id}>
                <TableCell className="font-mono text-xs">{o.id.substring(0,8)}</TableCell>
                <TableCell className="font-medium">{o.nome}</TableCell>
                <TableCell>{o.municipio || '-'}</TableCell>
                <TableCell>{(o.bdi_pct * 100).toFixed(2)}%</TableCell>
                <TableCell>{new Date(o.created_at).toLocaleDateString()}</TableCell>
                <TableCell className="text-right space-x-2">
                  <Button variant="destructive" size="sm" onClick={() => handleDelete(o.id)}><Trash2 className="w-4 h-4"/></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
