import { createFileRoute, redirect } from '@tanstack/react-router'
import { supabase } from '@/integrations/supabase/client'
import { useState } from 'react'

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
  const [activeTab, setActiveTab] = useState('bases')
  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6 text-slate-800">Painel Administrativo</h1>
      <div className="flex space-x-4 mb-6 border-b border-gray-200">
        <button className={`py-2 px-4 ${activeTab === 'bases' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500'}`} onClick={() => setActiveTab('bases')}>
          Bases e Composições
        </button>
        <button className={`py-2 px-4 ${activeTab === 'users' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500'}`} onClick={() => setActiveTab('users')}>
          Empresas e Usuários
        </button>
      </div>

      {activeTab === 'bases' && (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h2 className="text-xl font-semibold mb-4">Atualização de Preços em Lote (Sem Lovable)</h2>
          <p className="text-gray-600 mb-4">Faça upload de planilhas do SINAPI/SICRO para atualizar a base via processamento assíncrono.</p>
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center hover:bg-gray-50 transition-colors">
            <input 
              type="file" 
              accept=".xlsx, .xls, .csv" 
              className="mb-4 text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const formData = new FormData();
                formData.append('file', file);
                try {
                  const { data: { session } } = await supabase.auth.getSession();
                  const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-base-upload`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${session?.access_token}` },
                    body: formData
                  });
                  const result = await response.json();
                  if (response.ok) alert(result.message);
                  else alert(`Erro: ${result.error}`);
                } catch (err: any) { alert(`Erro ao processar: ${err.message}`); }
              }}
            />
            <p className="text-gray-500 text-sm mt-2">Arraste a planilha ou clique no botão acima</p>
          </div>
        </div>
      )}

      {activeTab === 'users' && (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h2 className="text-xl font-semibold mb-4">Gestão de Workgroups (Multi-Tenant)</h2>
          <table className="min-w-full divide-y divide-gray-200 mt-4">
            <thead>
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Empresa / Grupo</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Usuários</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ações</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              <tr>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">LCL Projetos</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">4</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm"><span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">Ativo</span></td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500"><button className="text-blue-600">Gerenciar</button></td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
