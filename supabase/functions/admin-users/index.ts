// PRONTO — Edge Function: operações administrativas de usuário
// Usa a service_role key (disponível só no ambiente da function, nunca no cliente)
// para criar usuários, redefinir senha e alterar perfil de acesso.
// Só quem está logado com role 'gc' pode executar qualquer ação aqui.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const admin = createClient(SUPABASE_URL, SERVICE_KEY)

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS })
  }
  try {
    const body = await req.json()
    const { action } = body

    // ═══ BOOTSTRAP: cria a primeira conta de administradora (G&C) direto pelo
    // app, sem exigir uma sessão já logada. Protegido por um código secreto que
    // só existe no ambiente da function (nunca no front-end) e só funciona
    // enquanto nenhuma conta 'gc' existir ainda — depois disso, este caminho
    // fica permanentemente bloqueado e novos usuários passam a ser criados
    // pela tela "Usuários & Acessos" (ação create_user, abaixo).
    if (action === 'bootstrap_admin') {
      const { setup_code, username, password, nome } = body
      const expected = Deno.env.get('BOOTSTRAP_SETUP_CODE')
      if (!expected) return json({ error: 'Bootstrap não configurado no servidor (BOOTSTRAP_SETUP_CODE ausente)' }, 500)
      if (!setup_code || setup_code !== expected) return json({ error: 'Código de configuração incorreto' }, 403)

      const { count } = await admin.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'gc')
      if ((count ?? 0) > 0) return json({ error: 'Já existe uma conta de Gente & Cultura. Peça para ela criar seu usuário em Usuários & Acessos.' }, 409)

      if (!username || !password || !nome) return json({ error: 'Preencha nome, usuário e senha' }, 400)
      const email = `${username}@pronto.internal`
      const { data: created, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true })
      if (error) return json({ error: error.message }, 400)

      const { error: profileErr } = await admin.from('profiles').insert({
        id: created.user.id, username, role: 'gc', colab_id: null, nome,
      })
      if (profileErr) return json({ error: profileErr.message }, 400)

      await admin.from('log_auditoria').insert({
        usuario: nome, email: username, campo: 'usuário', valor_anterior: '—',
        valor_novo: 'Conta de administradora criada (bootstrap)', por: nome,
      })
      return json({ ok: true, id: created.user.id })
    }

    // ═══ Demais ações exigem uma sessão de quem já está logado como 'gc' ═══
    const authHeader = req.headers.get('Authorization') ?? ''
    const jwt = authHeader.replace('Bearer ', '')
    const { data: { user: caller } } = await admin.auth.getUser(jwt)
    if (!caller) return json({ error: 'Não autenticado' }, 401)

    const { data: callerProfile } = await admin
      .from('profiles').select('role').eq('id', caller.id).single()
    if (callerProfile?.role !== 'gc') {
      return json({ error: 'Apenas o Gente & Cultura pode gerenciar usuários' }, 403)
    }

    if (action === 'create_user') {
      const { username, password, role, nome, colab_id, cargo, jornada } = body
      const email = `${username}@pronto.internal`
      const { data: created, error } = await admin.auth.admin.createUser({
        email, password, email_confirm: true,
      })
      if (error) return json({ error: error.message }, 400)

      const { error: profileErr } = await admin.from('profiles').insert({
        id: created.user.id, username, role, colab_id: colab_id || null, nome,
      })
      if (profileErr) return json({ error: profileErr.message }, 400)

      if (colab_id) {
        await admin.from('colaboradores').upsert({ id: colab_id, nome, cargo, jornada: jornada || 8 })
      }

      await admin.from('log_auditoria').insert({
        usuario: nome, email: username, campo: 'usuário', valor_anterior: '—',
        valor_novo: 'Usuário criado', por: caller.email,
      })
      return json({ ok: true, id: created.user.id })
    }

    if (action === 'reset_password') {
      const { username, new_password } = body
      const { data: list } = await admin.auth.admin.listUsers()
      const target = list.users.find(u => u.email === `${username}@pronto.internal`)
      if (!target) return json({ error: 'Usuário não encontrado' }, 404)

      const { error } = await admin.auth.admin.updateUserById(target.id, { password: new_password })
      if (error) return json({ error: error.message }, 400)

      await admin.from('log_auditoria').insert({
        usuario: username, email: username, campo: 'senha', valor_anterior: '••••••',
        valor_novo: 'Nova senha definida', por: caller.email,
      })
      return json({ ok: true })
    }

    if (action === 'change_role') {
      const { username, new_role } = body
      const { data: profile } = await admin.from('profiles').select('id, role').eq('username', username).single()
      if (!profile) return json({ error: 'Usuário não encontrado' }, 404)

      const { error } = await admin.from('profiles').update({ role: new_role }).eq('id', profile.id)
      if (error) return json({ error: error.message }, 400)

      await admin.from('log_auditoria').insert({
        usuario: username, email: username, campo: 'perfil de acesso',
        valor_anterior: profile.role, valor_novo: new_role, por: caller.email,
      })
      return json({ ok: true })
    }

    return json({ error: 'Ação desconhecida' }, 400)
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  })
}
