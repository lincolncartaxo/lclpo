import { createFileRoute, redirect } from '@tanstack/react-router'
import { supabase } from '@/integrations/supabase/client'
import { useState, useEffect } from 'react'

export const Route = createFileRoute('/_authenticated/admin/')({
  beforeLoad: async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) throw redirect({ to: '/login' })
    const role = session.user.user_metadata?.role
    if (role !== 'admin') throw redirect({ to: '/dashboard' })
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
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center hover:bg-gray-50 cursor-pointer">
            <p className="text-gray-500">Arraste a planilha .xlsx / .csv aqui</p>
          </div>
          <button className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-md">
            Processar Planilha (Edge Function)
          </button>
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
