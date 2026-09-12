# Memória do projeto — Bets Stats

Atualizada em 12 de setembro de 2026.

## Resumo atual

O projeto foi criado do zero como um painel web responsivo de estatísticas de futebol para análise de apostas. A primeira versão está implementada, compilada e publicada de forma privada no Sites.

Deployment confirmado na criação: `https://bets-stats-futebol.chatgpt.team`.

O aplicativo abre em modo demonstração porque nenhuma chave da API-Football foi configurada no ambiente publicado. Os valores exibidos nesse modo são determinísticos e simulados; a interface os identifica explicitamente.

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

Com `API_FOOTBALL_KEY`, a rota consulta partidas finalizadas na API-Football, seleciona o último recorte por clube, busca detalhes em grupos de até 20 partidas e agrega as métricas. As respostas ficam em cache em memória por 15 minutos.

Sem a chave, a rota retorna a amostra simulada. Se o provedor falhar quando uma chave estiver configurada, o cliente mantém o último conjunto válido e mostra o erro; ele não mascara silenciosamente a falha como dado real.

Importante: a integração ao vivo foi implementada e verificada por tipagem/build, mas ainda não foi validada ponta a ponta com uma chave real. Esse é o principal passo pendente.

## Decisões técnicas

- Next.js/React com Vinext foi escolhido para manter interface e proxy seguro no mesmo projeto Cloudflare Worker.
- A chave fica exclusivamente no servidor.
- Campos sem cobertura permanecem nulos e aparecem como `—`.
- O modo demonstração evita uma tela vazia e permite avaliar todo o produto sem contratar um provedor imediatamente.
- O cache reduz chamadas e protege a cota do plano da API.
- A UI usa tema esportivo escuro com destaque verde-limão, sem imagens decorativas.
- O site permanece privado; nenhuma configuração de acesso deve mudar sem autorização explícita.

## Validações já realizadas

- Build de produção concluído com sucesso.
- TypeScript estrito concluído sem erros.
- Página principal respondeu HTTP 200 localmente.
- Endpoint demonstrativo respondeu HTTP 200 e respeitou liga, janela e mando.
- Archive do Worker continha `dist/server/index.js` e `dist/.openai/hosting.json`.
- Primeira publicação privada terminou com estado `succeeded`.

## Ambiente e operação

- O projeto usa pnpm porque a instalação global do npm neste Windows está quebrada.
- Shims PowerShell podem ser bloqueados; prefira os executáveis `.cmd`.
- O Bash do sistema aponta para WSL, mas não há distribuição instalada. O empacotamento foi feito com o preparador oficial de Sites e o `tar.exe` do Windows.
- O `project_id` válido já está em `.openai/hosting.json`. Nunca chame `create_site` novamente para este checkout.
- Não armazene tokens do repositório Sites nem chaves de API nesta memória.

## Próximos passos prováveis

1. Configurar `API_FOOTBALL_KEY` como segredo do ambiente publicado.
2. Validar uma liga europeia e o Brasileirão com dados reais, conferindo nomes exatos das métricas e cobertura.
3. Avaliar persistência/cache externo apenas se o volume de uso ou a cota do provedor justificar.
4. Expandir para confrontos, árbitros, escalações, odds ou alertas somente mediante pedido do usuário.

