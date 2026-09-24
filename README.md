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

Ao abrir, o painel mostra uma amostra simulada enquanto consulta a fonte experimental no servidor.

## Fonte experimental

A rota `/api/stats` consulta o feed JSON usado pelo site da ESPN, sem chave, e normaliza partidas concluídas para o contrato do painel. O feed não é uma API pública documentada; esta integração destina-se a um experimento pessoal e pode mudar ou ficar indisponível sem aviso.

As respostas normalizadas e os placares anuais ficam em cache no servidor por 15 minutos para reduzir o tráfego. Estatísticas ausentes permanecem nulas e aparecem como traço.

## Aviso

As informações são históricas e não garantem resultados futuros. O painel não faz recomendações de aposta.
