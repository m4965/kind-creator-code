# FluxIA — MVP completo

## Stack
- TanStack Start + Lovable Cloud (Supabase) + shadcn/Tailwind
- `@xyflow/react` para builder de fluxos
- Evolution API para WhatsApp (envio: texto / imagem / áudio / vídeo)
- Groq via HTTP:
  - Texto: `llama-3.3-70b-versatile` (free)
  - Áudio (transcrição): `whisper-large-v3-turbo` (free)
  - Visão (comprovantes JPG/PNG/PDF→imagem): `meta-llama/llama-4-scout-17b-16e-instruct` (free, multimodal)

## Banco (migration única)
Tabelas com RLS por `user_id`:
- `profiles` (id, email, name) — trigger cria no signup
- `user_roles` (enum admin/user, `has_role()` security definer)
- `settings` (evolution_url, evolution_instance, evolution_key, groq_key, groq_model, system_prompt)
- `contacts` (phone, name, avatar_url, tags[])
- `conversations` (contact_id, last_message_at, ai_enabled, unread)
- `messages` (conversation_id, role, type[text/image/audio/video/document], content, media_url, transcript, meta jsonb)
- `flows` (name, active, trigger_keywords[], nodes jsonb, edges jsonb)
- `quick_replies` (shortcut, content, media_url, type)
- `funnel_stages` (name, color, order)
- `leads` (contact_id, stage_id, value, notes)
- `payments` (conversation_id, message_id, status[pending/confirmed/rejected], amount, extracted jsonb, image_url) — populada pelo nó de confirmação
- Realtime habilitado em `messages`, `conversations`, `leads`

## Rotas
- `/login` (email+senha + Google via broker Lovable)
- `/_authenticated/` layout com sidebar
  - `/` dashboard (stats)
  - `/inbox` lista + chat realtime, toggle IA
  - `/flows` lista + `/flows/$id` builder
  - `/quick-replies` CRUD
  - `/funnel` kanban
  - `/contacts` tabela
  - `/settings` Evolution + Groq

## Nós do builder
1. **Gatilho** (palavra-chave / qualquer mensagem)
2. **Enviar texto**
3. **Enviar imagem** (URL)
4. **Enviar áudio** (URL)
5. **Enviar vídeo** (URL)
6. **Resposta IA** (Groq texto com system prompt + histórico)
7. **Transcrever áudio** (se mensagem do user for áudio → roda Whisper, salva em `messages.transcript`, continua fluxo com texto)
8. **Confirmação de pagamento** (se mensagem for imagem/PDF → llama-4-scout extrai valor/data/banco → marca `payments.status` = confirmed/rejected → ramifica fluxo via 2 handles: aprovado / rejeitado)
9. **Condição** (regex/contém)
10. **Mover no funil** (seleciona estágio)

## Webhook público
`POST /api/public/webhook/evolution?user_id=...`
- Recebe payload Evolution (`messages.upsert`)
- Salva mensagem; se tipo audio → baixa, transcreve com Groq, salva transcript
- Se tipo image/document → guarda media_url
- Dispara fluxo ativo cujo gatilho casa (palavra-chave OU qualquer)
- Executa nós sequenciais; ramos do nó pagamento determinados pela análise da IA visão
- Se conversa tem `ai_enabled` e nenhum fluxo casou → resposta livre via Groq
- Envia respostas pela Evolution (`/message/sendText|sendMedia/{instance}`)

## Fluxo de exemplo (seed)
Para usuário `lukascarli@gmail.com`, criar fluxo "Atendimento padrão":
- Gatilho: qualquer mensagem nova
- → IA responde com prompt boas-vindas
- + Gatilho "comprovante" → Confirmação de pagamento → ramo aprovado envia "Pagamento confirmado ✅, obrigado!" / ramo rejeitado envia "Não consegui validar, pode reenviar?"

## Implementação
Server functions (`createServerFn`):
- `chat.functions.ts` — list conversations, list messages, toggle ai, send message manual
- `flows.functions.ts` — CRUD
- `quick-replies.functions.ts` — CRUD
- `funnel.functions.ts` — CRUD + mover lead
- `contacts.functions.ts`
- `settings.functions.ts` — get/save (criptografia simples — guardamos como texto no banco protegido por RLS)
- `evolution.server.ts` — helpers `sendText/sendMedia/downloadMedia`
- `groq.server.ts` — `chat`, `transcribe`, `vision`
- `flow-engine.server.ts` — executor

Webhook em `src/routes/api/public/webhook/evolution.ts`.

## Não escopo agora
- Multi-tenant / billing
- Templates oficiais WhatsApp Cloud API
- Edição visual de mídia

Vou implementar tudo numa sequência: migration → server helpers → server fns → rotas UI → builder → webhook → seed do fluxo exemplo.
