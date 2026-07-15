-- ═══════════════════════════════════════════════════════════════
-- PRONTO — Seed inicial (colaboradores + perfis de acesso)
-- Rode DEPOIS do schema.sql e DEPOIS de criar os 7 usuários no
-- Authentication → Users do Supabase (veja SETUP.md passo 4).
-- Substitua os UUID-DE-... pelos IDs reais gerados para cada usuário.
-- ═══════════════════════════════════════════════════════════════

insert into public.colaboradores (id, nome, jornada) values
  ('c1','Karine',8),
  ('c2','Claudia',8),
  ('c3','Elizabete',8),
  ('c4','Rafaela',8),
  ('c5','Paula',8);

-- Substitua os UUIDs abaixo pelos "User UID" mostrados no dashboard
-- (Authentication → Users) para cada e-mail sintético criado.
insert into public.profiles (id, username, role, colab_id, nome) values
  ('UUID-DE-gestao@pronto.internal',    'gestao',    'gestora',     null, 'Gestão'),
  ('UUID-DE-gc@pronto.internal',        'gc',        'gc',          null, 'G&C'),
  ('UUID-DE-karine@pronto.internal',    'karine',    'colaborador', 'c1', 'Karine'),
  ('UUID-DE-claudia@pronto.internal',   'claudia',   'colaborador', 'c2', 'Claudia'),
  ('UUID-DE-elizabete@pronto.internal', 'elizabete', 'colaborador', 'c3', 'Elizabete'),
  ('UUID-DE-rafaela@pronto.internal',   'rafaela',   'colaborador', 'c4', 'Rafaela'),
  ('UUID-DE-paula@pronto.internal',     'paula',     'colaborador', 'c5', 'Paula');
