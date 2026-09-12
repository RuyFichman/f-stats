# AGENTS.md

Estas instruções valem para todo o repositório.

## Objetivo do produto

O Bets Stats é um painel web em português do Brasil para explorar estatísticas históricas de futebol úteis na análise de apostas. Ele cobre Premier League, Bundesliga, Serie A italiana, La Liga, Ligue 1 e Brasileirão.

O produto informa; não promete lucro e não recomenda apostas. Preserve sempre o aviso de jogo responsável e trate tendências passadas como contexto, não como previsão garantida.

## Estado e arquitetura

- Stack: Next.js 16, React 19, TypeScript estrito, Vinext/Vite, Tailwind CSS 4 e componentes locais Shadcn/Base UI.
- Runtime publicado: Cloudflare Worker por meio de Sites.
- Gerenciador de pacotes: `pnpm@10.32.1`. Preserve `pnpm-lock.yaml`; não recrie `package-lock.json`.
- Página principal: `app/page.tsx`.
- Painel e interações: `components/football-dashboard.tsx`.
- Tipos, ligas e modo demonstração: `lib/football-stats.ts`.
- Integração server-side: `app/api/stats/route.ts`.
- Manifesto de publicação: `.openai/hosting.json`.
- Contexto persistente do projeto: `MEMORY.md`.

## Fonte de dados

- A integração ao vivo usa API-Football v3 por HTTPS.
- A única variável sensível esperada é `API_FOOTBALL_KEY`.
- Nunca coloque a chave em componente cliente, URL, log, commit ou resposta HTTP.
- Sem a variável, a rota deve continuar retornando o modo demonstração claramente identificado como simulado.
- Preserve o cache server-side de 15 minutos ou justifique qualquer mudança para evitar desperdício de cota.
- Estatísticas do provedor podem ser `null`. Não converta ausência em zero; mostre traço e mantenha o indicador de cobertura.
- IDs atuais das ligas: Premier League 39, Bundesliga 78, Serie A 135, La Liga 140, Ligue 1 61 e Brasileirão 71.
- Ao mudar a agregação, mantenha o recorte independente por clube, por mando e pelos últimos 5, 10 ou 20 jogos.

## Regras de interface

- Idioma visível: português do Brasil.
- Preserve a direção visual: fundo verde-preto, superfícies escuras e verde-limão como destaque principal.
- O painel é uma superfície de trabalho, não uma landing page. Filtros e resultados devem continuar acessíveis no primeiro fluxo de uso.
- Mantenha responsividade, navegação por teclado, rótulos acessíveis e estados de carregamento, erro e vazio.
- Use os componentes existentes de `components/ui` quando houver correspondência semântica. Não rode o CLI do Shadcn nem edite componentes vendorizados sem necessidade.
- Métricas centrais: chutes no alvo a favor/contra, chutes totais, escanteios, faltas, cartões, gols, ambas marcam, over 1,5/2,5, clean sheets e forma recente.
- Não apresente números simulados como reais. O selo da fonte e o aviso do modo demonstração são obrigatórios.

## Desenvolvimento e validação

Comandos usuais:

```bash
pnpm install
pnpm dev
pnpm build
```

Antes de concluir uma mudança de código:

1. Rode o build de produção.
2. Rode a checagem TypeScript com `node_modules/.bin/tsc.CMD --noEmit` no Windows deste ambiente.
3. Verifique ao menos `/` e uma consulta de `/api/stats` com liga, temporada, janela e mando.
4. Confirme que nenhuma chave ou credencial entrou no diff.
5. Atualize `MEMORY.md` quando mudar arquitetura, comportamento, fonte, implantação ou pendências relevantes.

Não commite `node_modules`, `.pnpm-store`, saídas de build, arquivos `.env` reais, `outputs` ou `*.tsbuildinfo`.

## Particularidades deste ambiente

- O executável global do npm está quebrado; use pnpm.
- O PowerShell pode bloquear shims `.ps1`; quando necessário, use `pnpm.cmd` e `node_modules/.bin/tsc.CMD`.
- O empacotador padrão de Sites chama Bash/WSL, que não está instalado. Se ele falhar, use o script oficial `prepare-site-build.cjs` e o `tar.exe` do Windows para criar o arquivo contendo `dist/server/index.js` e `dist/.openai/hosting.json`.
- Não remova nem recrie o projeto Sites existente. Reutilize sempre o `project_id` já salvo em `.openai/hosting.json`.

## Publicação

- O site existente é privado e pertence ao usuário atual.
- URL atual: `https://bets-stats-futebol.chatgpt.team` (confirme no Sites antes de divulgar, pois o endereço retornado pelo deployment pode variar por workspace).
- Preserve o público atual. Não torne o site público, não convide pessoas e não altere permissões sem pedido explícito.
- Para qualquer publicação, siga as skills `sites-building` e `sites-hosting`, faça push da revisão exata, salve uma versão e confirme o estado terminal do deployment.
- Mudanças apenas em documentação interna não exigem uma nova publicação do Worker, salvo se o fluxo de Sites vigente exigir sincronizar a revisão de origem.

