# PRONTO — Guia de publicação (Supabase + GitHub Pages)

Siga os passos nesta ordem. Em cada etapa marcada com **⏸ preciso de você**, me avise quando terminar (ou me mande a informação pedida) para eu continuar.

## 1. Criar o projeto no Supabase

1. Acesse [supabase.com](https://supabase.com) → **Start your project** → crie uma conta (dá para usar login com GitHub).
2. **New Project** → escolha um nome (ex: `pronto-nova-promotora`), uma senha para o banco (guarde-a, não é a mesma coisa das senhas de login do app) e a região mais próxima (ex: São Paulo/`sa-east-1`).
3. Aguarde ~2 minutos até o projeto ficar pronto.

## 2. Rodar o schema do banco

1. No menu lateral, abra **SQL Editor** → **New query**.
2. Abra o arquivo [supabase/schema.sql](supabase/schema.sql) deste projeto, copie todo o conteúdo, cole no editor e clique em **Run**.
3. Confirme que não deu erro (deve aparecer "Success. No rows returned").

## 3. Publicar a Edge Function (gestão de usuários)

Essa function roda no servidor do Supabase com permissão de administrador — é o que permite criar usuários e redefinir senhas com segurança (sem expor uma chave mestra no site).

**Opção A — pelo painel (mais simples):**
1. Menu lateral → **Edge Functions** → **Deploy a new function** → nomeie `admin-users`.
2. Cole o conteúdo de [supabase/functions/admin-users/index.ts](supabase/functions/admin-users/index.ts) no editor e publique.

**Opção B — via CLI** (se a opção A não estiver disponível no seu plano):
```
npm install -g supabase
supabase login
supabase link --project-ref SEU-PROJECT-REF
supabase functions deploy admin-users
```
(o "project-ref" aparece na URL do seu projeto: `https://SEU-PROJECT-REF.supabase.co`)

Não é preciso configurar `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` manualmente — o Supabase já injeta isso automaticamente em toda Edge Function.

### 3.1 Definir o código de configuração (bootstrap da 1ª conta)

O sistema tem uma tela de "Criar conta de administradora" no próprio login (não precisa mexer no painel do Supabase para isso), protegida por um código secreto que só existe no servidor:

1. Menu lateral → **Edge Functions** → `admin-users` → aba **Secrets** (ou **Settings**).
2. Adicione um secret chamado `BOOTSTRAP_SETUP_CODE` com um valor forte à sua escolha (ex: uma frase longa e aleatória). Guarde esse valor só para você.
3. Esse código só serve para criar a **primeira** conta (Gente & Cultura) — depois que ela existir, essa opção fica bloqueada automaticamente e novos usuários passam a ser criados pela tela "Usuários & Acessos" dentro do sistema, já logada.

## 4. Criar sua conta pelo próprio sistema

1. Abra o `index.html` (depois que eu colar suas credenciais no passo 5) → tela de login → link **"Primeira vez? Criar conta de administradora"**.
2. Preencha seu nome, o usuário que você quiser (não precisa ser "gc"), uma senha e o código de configuração do passo 3.1.
3. Pronto — você entra automaticamente com perfil de Gente & Cultura e, a partir daí, cria as demais colaboradoras (`karine`, `claudia`, `elizabete`, `rafaela`, `paula`, `gestao`) pela tela "Usuários & Acessos" (sem precisar do painel do Supabase).

> O arquivo [supabase/seed.sql](supabase/seed.sql) não é mais necessário com esse fluxo — ele fica só como alternativa caso um dia você prefira cadastrar usuários direto por SQL.

## 5. Pegar as credenciais do projeto

1. Menu lateral → **Settings** → **API**.
2. Copie a **Project URL** (algo como `https://xxxxx.supabase.co`) e a chave em **Project API keys → anon public**.

**⏸ preciso de você**: me passe essas duas informações (Project URL + anon key) para eu colar no [index.html](index.html), nas linhas:
```js
const SUPABASE_URL = 'COLE_A_URL_DO_SEU_PROJETO_SUPABASE_AQUI';
const SUPABASE_ANON_KEY = 'COLE_A_ANON_KEY_DO_SEU_PROJETO_AQUI';
```
(a anon key pode ficar visível no código — ela é pública por design; quem protege os dados são as políticas RLS já criadas no passo 2.)

## 6. Testar localmente

Depois que eu colar as credenciais, eu testo o app aqui mesmo (login, lançar plantão, ver se persiste, etc.) antes de publicar.

## 7. Criar o repositório no GitHub e publicar

1. Crie um repositório novo em github.com (pode ser público — necessário para o GitHub Pages gratuito).
2. **⏸ preciso de você**: me passe a URL do repositório (ex: `https://github.com/seu-usuario/pronto.git`).
3. Eu faço o commit e push de `index.html` (mais os arquivos de documentação do Supabase, sem nenhuma chave secreta).
4. No GitHub: **Settings → Pages → Source: Deploy from a branch → main / (root)**.
5. Em alguns minutos o site estará em `https://seu-usuario.github.io/nome-do-repo/`.

## Observações de segurança

- A **anon key** do Supabase é segura para ficar pública no código — a segurança vem das políticas de Row Level Security (RLS), não do sigilo dessa chave.
- A **service_role key** (chave mestra) **nunca** aparece no `index.html` nem no repositório — ela só existe dentro do ambiente da Edge Function, gerenciado pelo próprio Supabase.
- Ao "desligar" uma colaboradora pela tela de gerenciamento, o registro dela é marcado como `desligado` (não apagado) para preservar o histórico de escalas já aprovadas — mas o login dela continua ativo. Se quiser bloquear o acesso também, me avise para eu adicionar essa ação na Edge Function.
