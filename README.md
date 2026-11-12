# Dash-Brasa — Brasileirão 2026

Dashboard em **React + TypeScript + Vite** com dados da API football-data.org v4, competição BSA e temporada 2026.

## Áreas do dashboard

- **Classificação:** tabela, zonas indicativas e forma dos últimos jogos.
- **Estatísticas:** gols por rodada, melhores ataques/defesas, comparação de pontos e evolução.
- **Análises:** desempenho ofensivo/defensivo, resultados, placares e indicadores por rodada.
- **Artilharia:** ranking com controle da quantidade de jogadores, gols e participações disponíveis.
- **Clubes:** cards dos participantes e acesso rápido ao perfil.
- **Partidas:** calendário/resultados com filtros por status e rodada.
- **Comparador:** KPIs lado a lado e comparação de indicadores de dois clubes.
- **Perfil do Clube:** campanha, últimos cinco jogos e forma recente.

## Como executar no Windows

1. Instale **Node.js LTS**: https://nodejs.org/
2. Extraia o ZIP e abra a pasta `dash-brasa-js` no VS Code.
3. Abra o terminal nessa pasta e execute:

```powershell
npm install
Copy-Item .env.example .env.local
```

4. Abra `.env.local` e informe seu token:

```env
VITE_FOOTBALL_DATA_TOKEN=SEU_TOKEN_AQUI
```

5. Inicie:

```powershell
npm run dev
```

6. Abra o endereço exibido pelo Vite, normalmente `http://localhost:5173`.

Para gerar a versão de produção:

```powershell
npm run build
npm run preview
```



## Deploy na Vercel

1. Suba o repositório no GitHub (a pasta `dash-brasa-js`).
2. Em [vercel.com](https://vercel.com) → **Add New Project** → importe o repo.
3. Framework Preset: **Vite** (detectado automaticamente).
4. Em **Environment Variables**, adicione:

| Nome | Valor | Ambiente |
|------|-------|----------|
| `FOOTBALL_DATA_TOKEN` | seu token da football-data.org | Production, Preview, Development |

> Use `FOOTBALL_DATA_TOKEN` (sem `VITE_`). Assim o token fica **só no servidor**, na Edge Function `api/[...path].js`, e não vai para o JavaScript do navegador.

5. Deploy. O proxy `/api/*` redireciona para `https://api.football-data.org/v4/*`.

### Desenvolvimento local

```bash
npm install
cp .env.example .env.local
# edite VITE_FOOTBALL_DATA_TOKEN
npm run dev
```

O Vite usa o proxy em `vite.config.ts`. Em produção a Vercel usa a função em `api/`.

## Token e segurança

O token enviado no projeto original foi removido deste pacote. Configure seu próprio token em `.env.local`. O prefixo `VITE_` faz com que o valor seja incorporado ao código do navegador; portanto, essa configuração é adequada apenas para desenvolvimento/local. Para publicar o dashboard, mova as chamadas da API para um backend/proxy privado e mantenha o token somente no servidor. Nunca faça commit de `.env.local`.

## Limitações da fonte de dados

A API disponibiliza classificação, partidas e artilheiros conforme o plano contratado. Ela não fornece, para todos os endpoints/planos, histórico de classificação por rodada, eventos/minutos de gols, árbitros, idade, nacionalidade e elenco completo. Os painéis indicam claramente quando a informação não está disponível; não são criados dados fictícios. Indicadores de pontos, gols, forma e resultados são calculados com os dados recebidos.

## Estrutura

```text
src/
  App.tsx
  services/api.ts
  types/
  utils/
  index.css
```
