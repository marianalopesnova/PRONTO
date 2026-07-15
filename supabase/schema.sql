-- ═══════════════════════════════════════════════════════════════
-- PRONTO — Schema Supabase (Postgres + RLS)
-- Cole este arquivo inteiro no SQL Editor do Supabase e clique em "Run".
-- ═══════════════════════════════════════════════════════════════

-- ── PROFILES ── vínculo 1:1 com auth.users (role + colaborador)
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  role text not null check (role in ('gestora','gc','colaborador')),
  colab_id text,
  nome text not null,
  created_at timestamptz not null default now()
);

-- ── COLABORADORES ──
create table public.colaboradores (
  id text primary key,
  nome text not null,
  cargo text,
  admissao date,
  jornada int not null default 8,
  contrato text default 'CLT',
  status text not null default 'ativo' check (status in ('ativo','ferias','afastado','desligado')),
  ferias_ini date,
  ferias_fim date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── ESCALA ── um registro por colaborador/dia
create table public.escala (
  id bigint generated always as identity primary key,
  colab_id text not null references public.colaboradores(id) on delete cascade,
  data date not null,
  status text not null,
  ini time,
  fim time,
  updated_by text,
  updated_at timestamptz not null default now(),
  unique (colab_id, data)
);

-- ── CIÊNCIAS ── confirmação de recebimento da escala do mês
create table public.ciencias (
  id bigint generated always as identity primary key,
  colab_id text not null references public.colaboradores(id) on delete cascade,
  ano int not null,
  mes int not null,
  confirmado_em timestamptz not null default now(),
  unique (colab_id, ano, mes)
);

-- ── TROCAS ── solicitação de troca de plantão entre colaboradoras
create table public.trocas (
  id bigint generated always as identity primary key,
  de_id text not null references public.colaboradores(id),
  de_data date not null,
  de_st text,
  para_id text not null references public.colaboradores(id),
  para_data date not null,
  para_st text,
  status text not null default 'pendente' check (status in ('pendente','aprovada','recusada')),
  motivo text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by text
);

-- ── LOG DE AUDITORIA ── alterações de perfil/acesso
create table public.log_auditoria (
  id bigint generated always as identity primary key,
  usuario text,
  email text,
  campo text,
  valor_anterior text,
  valor_novo text,
  por text,
  at timestamptz not null default now()
);

-- ── APROVAÇÕES ── fluxo Gestão → G&C por mês/ano
create table public.aprovacoes (
  id bigint generated always as identity primary key,
  ano int not null,
  mes int not null,
  status text not null default 'pendente' check (status in ('pendente','aprovada','recusada')),
  enviado_por text,
  enviado_em timestamptz,
  aprovado_por text,
  aprovado_em timestamptz,
  motivo_recusa text,
  unique (ano, mes)
);

-- ── HISTÓRICO ── snapshot da escala de cada colaborador no momento do
-- envio/aprovação de um mês (permite consultar a versão aprovada mesmo
-- que a escala "ao vivo" mude depois)
create table public.historico (
  ano int not null,
  mes int not null,
  colab_id text not null references public.colaboradores(id) on delete cascade,
  dados jsonb not null,
  criado_em timestamptz not null default now(),
  primary key (ano, mes, colab_id)
);

-- ═══════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ═══════════════════════════════════════════════════════════════
alter table public.profiles       enable row level security;
alter table public.colaboradores  enable row level security;
alter table public.escala         enable row level security;
alter table public.ciencias       enable row level security;
alter table public.trocas         enable row level security;
alter table public.log_auditoria  enable row level security;
alter table public.aprovacoes     enable row level security;
alter table public.historico      enable row level security;

-- Helper: role do usuário autenticado atual
create or replace function public.current_role_pronto()
returns text language sql stable security definer as $$
  select role from public.profiles where id = auth.uid()
$$;

-- Helper: colab_id do usuário autenticado atual
create or replace function public.current_colab_id()
returns text language sql stable security definer as $$
  select colab_id from public.profiles where id = auth.uid()
$$;

-- PROFILES: qualquer autenticado pode ler; nenhuma escrita pelo cliente
-- (criação/edição de usuários só via Edge Function com service_role)
create policy "profiles_select" on public.profiles
  for select to authenticated using (true);

-- COLABORADORES: leitura geral; escrita só gestora/gc
create policy "colaboradores_select" on public.colaboradores
  for select to authenticated using (true);
create policy "colaboradores_write" on public.colaboradores
  for all to authenticated
  using (current_role_pronto() in ('gestora','gc'))
  with check (current_role_pronto() in ('gestora','gc'));

-- ESCALA: leitura geral; escrita só gestora/gc
create policy "escala_select" on public.escala
  for select to authenticated using (true);
create policy "escala_write" on public.escala
  for all to authenticated
  using (current_role_pronto() in ('gestora','gc'))
  with check (current_role_pronto() in ('gestora','gc'));

-- CIÊNCIAS: leitura geral; escrita só do próprio colaborador (ou gestora/gc)
create policy "ciencias_select" on public.ciencias
  for select to authenticated using (true);
create policy "ciencias_write" on public.ciencias
  for all to authenticated
  using (current_role_pronto() in ('gestora','gc') or colab_id = current_colab_id())
  with check (current_role_pronto() in ('gestora','gc') or colab_id = current_colab_id());

-- TROCAS: leitura geral; criação pelo próprio colaborador envolvido; aprovação/recusa por gestora/gc
create policy "trocas_select" on public.trocas
  for select to authenticated using (true);
create policy "trocas_insert" on public.trocas
  for insert to authenticated
  with check (de_id = current_colab_id() or current_role_pronto() in ('gestora','gc'));
create policy "trocas_update" on public.trocas
  for update to authenticated
  using (current_role_pronto() in ('gestora','gc') or de_id = current_colab_id())
  with check (current_role_pronto() in ('gestora','gc') or de_id = current_colab_id());

-- LOG DE AUDITORIA: leitura só gestora/gc; escrita via Edge Function (service_role bypassa RLS)
create policy "log_select" on public.log_auditoria
  for select to authenticated using (current_role_pronto() in ('gestora','gc'));

-- APROVAÇÕES: leitura geral; escrita só gestora/gc
create policy "aprovacoes_select" on public.aprovacoes
  for select to authenticated using (true);
create policy "aprovacoes_write" on public.aprovacoes
  for all to authenticated
  using (current_role_pronto() in ('gestora','gc'))
  with check (current_role_pronto() in ('gestora','gc'));

-- HISTÓRICO: leitura geral; escrita só gestora/gc
create policy "historico_select" on public.historico
  for select to authenticated using (true);
create policy "historico_write" on public.historico
  for all to authenticated
  using (current_role_pronto() in ('gestora','gc'))
  with check (current_role_pronto() in ('gestora','gc'));

-- ═══════════════════════════════════════════════════════════════
-- REALTIME — habilita mudanças em tempo real nas tabelas relevantes
-- ═══════════════════════════════════════════════════════════════
alter publication supabase_realtime add table
  public.colaboradores, public.escala, public.ciencias, public.trocas,
  public.log_auditoria, public.aprovacoes, public.historico;
