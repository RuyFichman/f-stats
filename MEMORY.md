# Memória do projeto — Bets Stats

Atualizada em 24 de setembro de 2026.

## Resumo atual

O projeto foi criado do zero como um painel web responsivo de estatísticas de futebol para análise de apostas. A primeira versão está implementada, compilada e publicada de forma privada no Sites.

Deployment privado confirmado: `https://bets-stats-futebol.ruyfichman.chatgpt.site`.

A revisão `7da053b` foi salva como nova versão e publicada em 24 de setembro de 2026, preservando o acesso exclusivo do proprietário.

O aplicativo inicia com uma amostra simulada e consulta, no servidor, o feed JSON usado pelo site da ESPN. A integração é um experimento pessoal: o feed não é uma API pública documentada e não há garantia de estabilidade ou autorização para redistribuição.

## Funcionalidades entregues

- Seis ligas: Premier League, Bundesliga, Serie A italiana, La Liga, Ligue 1 e Brasileirão.
- Temporadas recentes e recortes dos últimos 5, 10 ou 20 jogos.
- Filtro geral, em casa ou fora.
- Busca por clube e ordenação por diferentes mercados.
- Chutes no alvo, chutes totais, escanteios, cartões amarelos/vermelhos, faltas e gols.
- Frequências de ambas marcam, over 1,5, over 2,5 e jogos sem sofrer gols.
- Resumo dos líderes, gráfico de chutes a favor/contra e painel detalhado por clube.
- Forma recente, campanha e indicador de cobertura dos dados.
- Estados de carregamento, erro, ausência de resultados e aviso de jogo responsável.
- Ferramenta WebMCP `configure_football_analysis` para aplicar os mesmos filtros da interface quando o navegador oferecer suporte.

## Integração de dados

A rota `GET /api/stats` recebe:

- `league`: chave interna da liga;
- `season`: ano da temporada;
- `window`: 5, 10 ou 20;
- `venue`: `all`, `home` ou `away`.

A rota consulta os placares anuais da ESPN pelos identificadores `eng.1`, `ger.1`, `ita.1`, `esp.1`, `fra.1` e `bra.1`. Para ligas europeias, ela combina o ano inicial da temporada com o ano seguinte e filtra pelo `season.year` da ESPN; para o Brasileirão, usa apenas o ano civil.

O placar anual já inclui resultados, chutes, chutes no alvo, escanteios, faltas e eventos de cartões. A rota seleciona os últimos 5, 10 ou 20 jogos independentemente por clube e mando, agrega as métricas e preserva ausências como `null`. Tanto o placar bruto quanto a resposta normalizada ficam em cache em memória por 15 minutos.

Nenhuma chave é necessária. Se a ESPN falhar, `/api/stats` responde 502 e o cliente mantém o último conjunto válido; a falha não é mascarada como dado real.

## Decisões técnicas

- Next.js/React com Vinext foi escolhido para manter interface e proxy seguro no mesmo projeto Cloudflare Worker.
- A coleta da ESPN ocorre exclusivamente no servidor.
- Campos sem cobertura permanecem nulos e aparecem como `—`.
- O modo demonstração evita uma tela vazia e permite avaliar todo o produto sem contratar um provedor imediatamente.
- O cache reduz chamadas ao feed experimental e o risco de bloqueio por excesso de tráfego.
- A UI usa tema esportivo escuro com destaque verde-limão, sem imagens decorativas.
- O site permanece privado; nenhuma configuração de acesso deve mudar sem autorização explícita.

## Validações já realizadas

- Build de produção concluído com sucesso.
- TypeScript estrito concluído sem erros.
- Página principal respondeu HTTP 200 localmente.
- Em ambiente local, o endpoint com dados da ESPN respondeu HTTP 200 para as seis ligas de 2026, com 100% de cobertura das estatísticas detalhadas no recorte testado.
- Consultas da Premier League 2025 com janela 20 e da Premier League/Brasileirão 2026 por mando respeitaram temporada, janela e casa/fora.
- Archive do Worker continha `dist/server/index.js` e `dist/.openai/hosting.json`.
- A publicação privada da revisão `7da053b` terminou com estado `succeeded`; a página inicial publicada respondeu HTTP 200.
- No Worker publicado, `/api/stats` respondeu HTTP 502 porque o feed da ESPN não retornou partidas finalizadas para o recorte, embora a mesma consulta funcione localmente. O cliente mantém a amostra simulada e mostra o erro sem apresentá-la como dado real.

## Ambiente e operação

- O projeto usa pnpm porque a instalação global do npm neste Windows está quebrada.
- Shims PowerShell podem ser bloqueados; prefira os executáveis `.cmd`.
- O Bash do sistema aponta para WSL, mas não há distribuição instalada. O empacotamento foi feito com o preparador oficial de Sites e o `tar.exe` do Windows.
- O `project_id` válido já está em `.openai/hosting.json`. Nunca chame `create_site` novamente para este checkout.
- Não armazene tokens do repositório Sites nem chaves de API nesta memória.

## Próximos passos prováveis

1. Investigar por que o feed da ESPN retorna uma lista vazia quando consultado pelo Worker publicado, embora funcione localmente.
2. Antes de qualquer uso público ou comercial, substituir a fonte experimental por um feed licenciado ou obter autorização de redistribuição.
3. Avaliar persistência/cache externo apenas se o volume de uso justificar.
4. Expandir para confrontos, árbitros, escalações, odds ou alertas somente mediante pedido do usuário.
