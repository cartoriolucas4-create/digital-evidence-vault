# Registro Técnico de Evidências Digitais

Sistema para investigação policial legítima: um único link público captura dados técnicos verificáveis (IP, headers, dados do navegador, geolocalização e câmera — sempre com autorização) e um painel administrativo permite gerenciar, visualizar e exportar as ocorrências.

## Escopo desta iteração

**Backend (Lovable Cloud):**
- Habilitar Lovable Cloud (autenticação + banco + storage privado).
- Tabelas:
  - `cases` — configuração do link único (título, imagem, descrição, conteúdo, id_investigação, id_campanha, ativo).
  - `access_events` — cada acesso: UUID, case_id, session_id, IPs (v4/v6/direto/proxy), protocolo, HTTP version, headers brutos (jsonb), User-Agent, método, path, timestamps UTC, dados do navegador (jsonb), geolocalização (jsonb, opcional), fonte de cada dado, hash dos metadados.
  - `evidence_files` — imagens capturadas: event_id, storage_path, mime, tamanho, SHA-256, timestamp.
  - `audit_log` — ações do painel (login, view, export, create, update, delete) com usuário e timestamp.
  - `user_roles` + enum `app_role` (admin) + função `has_role` (padrão seguro).
- Storage bucket privado `evidence` com URLs assinadas temporárias.
- Server routes (raw HTTP em `src/routes/api/public/*`) para captura confiável de IP/headers via `getRequestIP` e `getRequestHeaders`, distinguindo IP direto vs. proxy/CDN via cadeia `x-forwarded-for` documentada.
- Server functions autenticadas para listar/exportar ocorrências e para gerar URLs assinadas.

**Página pública `/acesso/$id`:**
- Registra o acesso imediatamente ao carregar (POST para `/api/public/track`).
- Renderiza título, imagem e conteúdo configurados pelo admin.
- Seções separadas com botões explícitos:
  - "Autorizar localização" → chama `navigator.geolocation.getCurrentPosition` e envia coords + precisão + timestamps.
  - "Autorizar câmera" → `getUserMedia`, mostra prévia, captura sob clique explícito, calcula SHA-256 no browser, envia via multipart para `/api/public/upload`.
- Mostra ao visitante que dados técnicos estão sendo registrados (transparência).

**Painel admin `/_authenticated/admin`:**
- Login via Supabase (email/senha).
- Dashboard: total de acessos, último acesso, filtros por caso.
- Gestão de casos (CRUD do link único).
- Detalhe de ocorrência: todos os campos organizados por fonte ("DADO OBTIDO DIRETAMENTE", "FORNECIDO PELO NAVEGADOR", "FORNECIDO PELO SERVIDOR", "FORNECIDO POR PROXY/CDN", "NÃO DISPONÍVEL").
- Mapa (Leaflet, dinâmico atrás de `ClientOnly`) exibindo ponto + círculo de precisão real quando houver coords.
- Exportação: JSON, CSV e PDF (jsPDF) com o layout de relatório especificado.
- Log de auditoria visível.

## Precisão / anti-invenção

- Cada campo é armazenado com um discriminador de fonte; a UI mostra "não disponível" quando ausente em vez de estimar.
- IP: se `cf-connecting-ip` ou cadeia `x-forwarded-for` confiável presente, registrar como "proxy/CDN"; caso contrário usar `getRequestIP` como "direto". IPv4/IPv6 registrados apenas se realmente detectados no formato.
- Sem fingerprinting invasivo: só APIs padrão do navegador com permissão.

## Segurança

- HTTPS (default), RLS em todas as tabelas, roles em tabela separada.
- Uploads validados: apenas image/*, limite 10MB, hash calculado server-side também para verificação.
- Rate limiting simples por IP+case na rota pública (contagem em `access_events` na última janela).
- Storage privado + URLs assinadas curtas para download no painel.
- Auditoria de todas as ações administrativas.

## Fora de escopo desta iteração

- Backups agendados, 2FA/MFA, e assinatura digital criptográfica dos relatórios (podem ser adicionados depois).

## Detalhes técnicos

- Stack: TanStack Start + React 19 + Tailwind v4 + shadcn (já no template).
- SHA-256 no browser via `crypto.subtle.digest` e no server via `crypto.createHash`.
- Mapa: `react-leaflet` + `leaflet`, carregados via `React.lazy` dentro de `<ClientOnly>`.
- PDF: `jspdf` + `jspdf-autotable`.
- Zod para validar payloads em todas as rotas.
