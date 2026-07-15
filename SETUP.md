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

## 3. Criar os usuários iniciais

O Supabase Auth não permite inserir usuários com senha diretamente por SQL — precisa ser pela tela ou pela API.

1. Menu lateral → **Authentication** → **Users** → **Add user** → **Create new user**.
2. Para cada uma das 7 pessoas abaixo, crie um usuário com:
   - **Email**: `usuario@pronto.internal` (troque `usuario` pelo nome de usuário desejado)
   - **Password**: a senha que a pessoa vai usar para logar
   - Marque **Auto Confirm User** (senão o Supabase vai querer mandar e-mail de confirmação para um domínio que não existe)

   | Username (parte antes do @) | Perfil |
   |---|---|
   | `gestao` | Gestão |
   | `gc` | Gente & Cultura |
   | `karine` | Colaborador |
   | `claudia` | Colaborador |
   | `elizabete` | Colaborador |
   | `rafaela` | Colaborador |
   | `paula` | Colaborador |

   **Escolha senhas novas e fortes agora** — não reutilize `pronto123`/`nova2026`, que já estavam expostas no arquivo original.

3. Depois de criar cada um, clique nele na lista e copie o **User UID** (um UUID tipo `a1b2c3d4-...`).

**⏸ preciso de você**: me avise quando os 7 usuários estiverem criados. Se preferir, você mesma pode preencher o [supabase/seed.sql](supabase/seed.sql) trocando cada `UUID-DE-...` pelo UID copiado, e rodar esse arquivo no SQL Editor (mesmo processo do passo 2). Também posso montar o SQL final se você me passar os 7 UIDs.

## 4. Publicar a Edge Function (gestão de usuários)

Essa function roda no servidor do Supabase com permissão de administrador — é o que permite ao G&C criar usuários e redefinir senhas com segurança (sem expor uma chave mestra no site).

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

Não é preciso configurar nenhuma variável de ambiente manualmente — o Supabase já injeta `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` automaticamente dentro de toda Edge Function.

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
