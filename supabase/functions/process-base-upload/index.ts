import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import * as xlsx from 'https://esm.sh/xlsx@0.18.5'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '' // Service role for admin tasks
    )

    // Check if the user calling this is an admin
    const authHeader = req.headers.get('Authorization')!
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token)
    
    if (authError || !user) throw new Error('Unauthorized')
    
    // Validate admin role
    const role = user.user_metadata?.role
    if (role !== 'admin') throw new Error('Forbidden: Only admins can upload bases')

    // Parse the form data (file upload)
    const formData = await req.formData()
    const file = formData.get('file') as File
    
    if (!file) throw new Error('No file uploaded')

    // Read the file as array buffer
    const arrayBuffer = await file.arrayBuffer()
    const workbook = xlsx.read(arrayBuffer, { type: 'buffer' })
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]
    const data = xlsx.utils.sheet_to_json(worksheet)

    // TODO: Map the excel columns to the 'base_insumos' or 'base_composicoes' format
    // Exemplo:
    // const payload = data.map((row: any) => ({
    //   codigo: row['Código'],
    //   descricao: row['Descrição'],
    //   unidade: row['Unidade'],
    //   preco_desonerado: row['Preço Desonerado'],
    //   // ...
    // }))
    
    // Mock processing for now to validate pipeline
    const processedRows = data.length

    return new Response(
      JSON.stringify({ message: `Sucesso! Planilha processada com ${processedRows} linhas. O script de upsert pode ser adaptado conforme o layout das colunas.`, rows: processedRows }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
