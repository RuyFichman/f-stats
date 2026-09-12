# Bets Stats

Painel web de estatísticas de futebol para análise de apostas. Cobre Premier League, Bundesliga, Serie A italiana, La Liga, Ligue 1 e Brasileirão.

## O que o painel analisa

- chutes no alvo a favor e contra;
- chutes totais, escanteios, faltas e cartões;
- gols marcados e sofridos;
- frequência de ambas marcam, over 1,5, over 2,5 e jogos sem sofrer gol;
- forma recente, mando e recortes de 5, 10 ou 20 partidas.

## Rodar localmente

```bash
pnpm install
pnpm dev
```

Sem configuração adicional, o painel abre em modo demonstração com dados simulados.

## Usar dados reais

Crie `.env.local` a partir de `.env.example` e informe uma chave da API-Football:

```env
API_FOOTBALL_KEY=sua_chave
```

A chave é usada apenas na rota do servidor. As respostas ao vivo ficam em cache por 15 minutos para reduzir o consumo da cota da API.

## Aviso

As informações são históricas e não garantem resultados futuros. O painel não faz recomendações de aposta.
