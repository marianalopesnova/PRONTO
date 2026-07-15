// PRONTO — Edge Function: operações administrativas de usuário
// Usa a service_role key (disponível só no ambiente da function, nunca no cliente)
// para criar usuários, redefinir senha e alterar perfil de acesso.
// Só quem está logado com role 'gc' pode executar qualquer ação aqui.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const admin = createClient(SUPABASE_URL, SERVICE_KEY)

Deno.serve(async (req) => {
  try {
    const authHeader = req.headers.get('Authorization') ?? ''
    const jwt = authHeader.replace('Bearer ', '')
    const { data: { user: caller } } = await admin.auth.getUser(jwt)
    if (!caller) return json({ error: 'Não autenticado' }, 401)

    const { data: callerProfile } = await admin
      .from('profiles').select('role').eq('id', caller.id).single()
    if (callerProfile?.role !== 'gc') {
      return json({ error: 'Apenas o Gente & Cultura pode gerenciar usuários' }, 403)
    }

    const body = await req.json()
    const { action } = body

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
    headers: { 'Content-Type': 'application/json' },
  })
}
