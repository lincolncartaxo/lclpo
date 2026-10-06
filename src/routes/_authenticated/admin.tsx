import { createFileRoute, redirect } from '@tanstack/react-router'
import { supabase } from '@/integrations/supabase/client'
import { useState, useEffect } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Trash2, Edit, Users, Building, FileText, Database, HardHat } from 'lucide-react'
import { toast } from 'sonner'

export const Route = createFileRoute('/_authenticated/admin')({
  ssr: false,
  head: () => ({ meta: [{ title: 'Administração — Orça' }, { name: 'robots', content: 'noindex' }] }),
  beforeLoad: async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw redirect({ to: '/login' })
    const { data: isAdmin } = await supabase.rpc('has_role', { _user_id: user.id, _role: 'admin' })
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
          <p className="text-muted-foreground mt-2">Gestão completa de inquilinos, usuários, bases de referência e orçamentos.</p>
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
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchUsers()
  }, [])

  const fetchUsers = async () => {
    setLoading(true)
    const { data, error } = await supabase.from('profiles').select('*')
    if (error) toast.error(error.message)
    else setUsers(data || [])
    setLoading(false)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Gestão de Usuários</CardTitle>
        <CardDescription>Controle de acessos, perfis e vínculos com empresas.</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Data de Criação</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map(u => (
              <TableRow key={u.id}>
                <TableCell className="font-mono text-xs">{u.id.substring(0,8)}...</TableCell>
                <TableCell>{u.nome_completo || 'Sem Nome'}</TableCell>
                <TableCell>{u.role || 'user'}</TableCell>
                <TableCell>{new Date(u.created_at || '').toLocaleDateString()}</TableCell>
                <TableCell className="text-right space-x-2">
                  <Button variant="outline" size="sm"><Edit className="w-4 h-4"/></Button>
                  <Button variant="destructive" size="sm"><Trash2 className="w-4 h-4"/></Button>
                </TableCell>
              </TableRow>
            ))}
            {users.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Nenhum usuário encontrado</TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

function EmpresasManager() {
  const [empresas, setEmpresas] = useState<any[]>([])
  
  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase.from('empresas').select('*').catch(()=>({data:[]}))
      setEmpresas(data || [])
    }
    fetch()
  }, [])

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>Empresas e Workgroups</CardTitle>
            <CardDescription>Gerencie seus clientes SaaS, planos e bloqueios (Multi-Tenant).</CardDescription>
          </div>
          <Button>Nova Empresa</Button>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome da Empresa</TableHead>
              <TableHead>Plano</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {empresas.map(e => (
              <TableRow key={e.id}>
                <TableCell className="font-medium">{e.nome}</TableCell>
                <TableCell>{e.plano}</TableCell>
                <TableCell>
                  <span className={`px-2 py-1 rounded-full text-xs font-semibold ${e.status === 'ativo' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {e.status?.toUpperCase()}
                  </span>
                </TableCell>
                <TableCell className="text-right space-x-2">
                  <Button variant="outline" size="sm"><Edit className="w-4 h-4"/></Button>
                  <Button variant="destructive" size="sm"><Trash2 className="w-4 h-4"/></Button>
                </TableCell>
              </TableRow>
            ))}
            {empresas.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Tabela "empresas" vazia ou SQL de Multi-Tenant pendente.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

function InsumosManager() {
  const [q, setQ] = useState("")
  const [rows, setRows] = useState<any[]>([])
  
  const search = async () => {
    let query = supabase.from('base_insumos').select('codigo,descricao,unidade,preco_desonerado,fonte').limit(50)
    if (q) query = query.textSearch('descricao', q)
    const { data } = await query
    setRows(data || [])
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Base de Preços (Insumos)</CardTitle>
        <CardDescription>Visualização e edição dos insumos do SINAPI/SICRO.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input placeholder="Buscar insumo (Full Text Search)..." value={q} onChange={e=>setQ(e.target.value)} onKeyDown={e => e.key === 'Enter' && search()} />
          <Button onClick={search}>Buscar</Button>
          <Dialog>
            <DialogTrigger asChild><Button variant="secondary">Upload Excel</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Atualizar Base de Insumos</DialogTitle></DialogHeader>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center hover:bg-gray-50 cursor-pointer mt-4">
                <input type="file" className="mb-4 text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700" />
                <p className="text-muted-foreground text-sm">Dispara a Edge Function de processamento</p>
              </div>
            </DialogContent>
          </Dialog>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Código</TableHead>
              <TableHead>Fonte</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead>Unidade</TableHead>
              <TableHead className="text-right">Preço</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r, i) => (
              <TableRow key={i}>
                <TableCell className="font-mono text-xs">{r.codigo}</TableCell>
                <TableCell>{r.fonte}</TableCell>
                <TableCell className="max-w-md truncate">{r.descricao}</TableCell>
                <TableCell>{r.unidade}</TableCell>
                <TableCell className="text-right">R$ {r.preco_desonerado}</TableCell>
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
  
  const search = async () => {
    let query = supabase.from('base_composicoes').select('codigo,descricao,unidade,custo_desonerado,fonte').limit(50)
    if (q) query = query.textSearch('descricao', q)
    const { data } = await query
    setRows(data || [])
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Base de Composições</CardTitle>
        <CardDescription>Busca e gestão das composições (Macro-serviços).</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input placeholder="Buscar composição..." value={q} onChange={e=>setQ(e.target.value)} onKeyDown={e => e.key === 'Enter' && search()} />
          <Button onClick={search}>Buscar</Button>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Código</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead>Unidade</TableHead>
              <TableHead className="text-right">Custo Deson.</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r, i) => (
              <TableRow key={i}>
                <TableCell className="font-mono text-xs">{r.codigo}</TableCell>
                <TableCell className="max-w-md truncate">{r.descricao}</TableCell>
                <TableCell>{r.unidade}</TableCell>
                <TableCell className="text-right">R$ {r.custo_desonerado}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

function OrcamentosManager() {
  const [orcamentos, setOrcamentos] = useState<any[]>([])

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase.from('orcamentos').select('*').order('created_at', { ascending: false }).limit(100)
      setOrcamentos(data || [])
    }
    fetch()
  }, [])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Gestão de Orçamentos Globais</CardTitle>
        <CardDescription>Auditoria de todos os orçamentos criados pelos usuários na plataforma.</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Nome da Obra</TableHead>
              <TableHead>Município</TableHead>
              <TableHead>BDI</TableHead>
              <TableHead>Data Criação</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
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
                  <Button variant="outline" size="sm">Ver</Button>
                  <Button variant="destructive" size="sm"><Trash2 className="w-4 h-4"/></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
