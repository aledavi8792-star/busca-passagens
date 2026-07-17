# Busca de Passagens

Buscador e comparador de passagens aéreas com foco em achar o menor preço através
de automação de buscas (datas flexíveis + aeroportos próximos), não "APIs
secretas". Todas as chamadas a APIs de terceiros passam pelo backend (Next.js
Route Handlers) — nenhuma chave de API é exposta ao navegador.

## Stack

- **Next.js 16** (App Router) + TypeScript + Tailwind — frontend e backend (Route Handlers) no mesmo projeto
- **Prisma + SQLite** localmente (Postgres em produção — ver "Deploy")
- **Amadeus for Developers** (Flight Offers Search) como provedor de voos — com fallback para **dados simulados (mock)** quando não há chave configurada
- **Resend** para email de alerta de preço (fase 2, opcional)

## Como rodar localmente

```bash
npm install
cp .env.example .env      # já vem preenchido com defaults razoáveis
npx prisma migrate dev    # cria o banco SQLite local (dev.db)
npm run dev
```

Abra http://localhost:3000. **Sem nenhuma chave configurada, o app já funciona
com dados simulados** (claramente marcados "MOCK" na UI) — use isso para
validar o fluxo completo: busca, datas flexíveis, calendário de preços,
destino combinado (Ciudad del Este) e alertas.

Atalhos de teste já vêm na tela inicial: `BSB → AGT`, `BSB → IGU` e
`BSB → Ciudad del Este (combinado)`.

## Configurando a Amadeus (preços reais)

1. Crie uma conta gratuita em https://developers.amadeus.com
2. Crie um app no dashboard ("My Apps" → "Create New App") — isso gera um
   **API Key** e **API Secret** para o ambiente **Test** (sandbox, gratuito)
3. No `.env`:
   ```
   AMADEUS_CLIENT_ID=seu_api_key
   AMADEUS_CLIENT_SECRET=seu_api_secret
   AMADEUS_ENV=test
   ```
4. Reinicie `npm run dev` — o aviso de "MOCK" some e as buscas passam a usar
   dados reais da Amadeus (sandbox: dados de teste, não é o inventário real
   ao vivo — para isso seria necessário um contrato de produção com a Amadeus).

**Importante sobre o botão "Ver oferta":** a API de busca da Amadeus (e os
dados mock) não fornecem um link de checkout direto para comprar a passagem —
isso exigiria uma API de booking (ex.: Kiwi Tequila, que tem campo
`deep_link`, ou Duffel, que tem checkout próprio). Por isso o botão abre uma
busca equivalente no Google Flights (ou o site da companhia, quando
reconhecida) para você finalizar a compra manualmente. Ver `src/lib/bookingLink.ts`.

## Rota combinada: Brasília → Ciudad del Este

Não existe voo comercial direto para Ciudad del Este. Ao selecionar esse
destino (autocomplete mostra "🚌✈️ Ciudad del Este"), o app busca
automaticamente as duas alternativas reais e mostra ambas, com o aeroporto de
chegada real e o trecho terrestre necessário:

- **Voo até Assunção (AGT)** + ~5-6h de ônibus/carro até Ciudad del Este
- **Voo até Foz do Iguaçu (IGU)** + ~20-30min atravessando a fronteira

Configuração em `src/lib/combinedRoutes.ts` — dá para adicionar outros
destinos "sem voo direto" seguindo o mesmo padrão.

## Passagens separadas (ida + volta como 2 tickets)

Em toda busca de ida e volta, o app roda em paralelo uma comparação: duas
passagens só-ida (uma para cada trecho, possivelmente companhias e datas
diferentes) contra o preço combinado de ida+volta. Quando a soma dos dois
trechos separados fica mais barata que qualquer pacote de ida-e-volta
encontrado, ela aparece na lista com o badge **"✂️ 2 passagens separadas"** e
dois botões de compra (um por trecho) — já que são duas reservas
independentes. Lógica em `searchSplitOption` (`src/lib/searchFlights.ts`).

## Milhas/pontos (seats.aero, opcional)

Se `SEATS_AERO_API_KEY` estiver configurada (conta em https://seats.aero,
Partner API), a busca também consulta disponibilidade de assento-prêmio
(milhas) para a rota e mostra uma seção separada "✨ Opções com milhas" — isso
é um dado fundamentalmente diferente do preço em dinheiro (vem do inventário
de programas de fidelidade, não da Amadeus), então é aditivo: sem a chave,
essa seção simplesmente não aparece e o resto do app funciona normalmente.
Ver `src/lib/seatsAero.ts` — os parâmetros seguem a documentação pública da
seats.aero no momento em que foi escrito; confira `developers.seats.aero` se
o formato de resposta mudar.

## Datas flexíveis e cache

Com "datas flexíveis" ativado (+/- 1 a 3 dias), o app gera uma matriz de
combinações de ida/volta (até 7x7=49 pares) e testa aeroportos próximos
quando habilitado, mas limita o total de buscas por requisição (60
combinações) para não estourar o free tier da Amadeus. Cada combinação
(origem+destino+datas+passageiros) fica em cache por 6h (tabela
`SearchCache`) — buscas repetidas ou sobrepostas não batem na API de novo
dentro da janela.

## Fase 2: alertas de preço

- Salve uma busca como alerta (email + preço-alvo) na tela de resultados
- `/api/cron/check-alerts` roda 1x por dia (configurado em `vercel.json` para
  Vercel Cron) e reexecuta a busca de cada alerta ativo, grava o histórico de
  preços (`PriceHistory`) e envia email via Resend quando o menor preço
  encontrado cair abaixo do alvo
- Gerencie alertas em `/alertas` (pausar, reativar, excluir)
- Sem `RESEND_API_KEY` configurada, o alerta ainda é checado e o histórico
  gravado — só o email não é enviado (fica logado no console do servidor)

Para testar o cron manualmente: `curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/check-alerts`

## Dicas para comprar mais barato (o que o app automatiza, e o que depende de você)

- **Monitorar > acertar na hora**: a estratégia com maior retorno é o alerta de
  preço (fase 2) — deixar rodando por 1-2 semanas e comprar no vale, em vez de
  tentar "adivinhar" o melhor momento numa busca só.
- **Datas flexíveis fazem mais diferença que horário de compra**: no mock (e
  na prática) terça/quarta tendem a ser mais baratos que sexta/domingo; o
  calendário de preços (heatmap) existe pra você enxergar isso de cara.
- **"Comprar de madrugada" não tem efeito real**: é um mito comum. O que
  existe de verdade é a companhia reprecificar (subir ou descer) por causa de
  ocupação do voo e antecedência da compra — não do horário do dia em que você
  compra.
- **Antecedência**: geralmente 4-8 semanas antes para voos domésticos e 2-4
  meses para internacionais tende a pegar as faixas de preço mais baixas;
  isso já fica visível ao comparar o heatmap de datas mais próximas vs. mais
  distantes.
- **Aeroportos próximos e passagens separadas**: ambos já automatizados no
  app (toggle "aeroportos próximos" e o comparador ida-volta vs. separado).
- **Milhas**: costuma compensar mais em trechos longos/internacionais ou
  classe executiva, onde o preço em dinheiro é desproporcional às milhas
  exigidas — vale comparar a seção "✨ Opções com milhas" quando configurada.
- **Limpe cookies / use aba anônima** ao comprar no site da companhia: alguns
  sites de fato sobem preço com base em buscas repetidas no seu navegador
  (dynamic pricing por sessão) — isso é do lado deles, o app não influencia
  nisso, mas ajuda a garantir que você está vendo o preço "de primeira busca".

## Deploy (Vercel)

1. **Banco de dados**: SQLite não persiste em serverless (Vercel). Crie um
   Postgres gerenciado (Neon, Supabase ou Vercel Postgres — todos têm free
   tier) e:
   - Troque `provider = "sqlite"` por `provider = "postgresql"` em
     `prisma/schema.prisma`
   - Aponte `DATABASE_URL` para a connection string do Postgres
   - Rode `npx prisma migrate deploy` (ou deixe rodar no build)
2. **Variáveis de ambiente**: configure no painel da Vercel todas as chaves
   do `.env.example` (`AMADEUS_CLIENT_ID`, `AMADEUS_CLIENT_SECRET`,
   `RESEND_API_KEY`, `CRON_SECRET`, etc.)
3. **Cron**: `vercel.json` já define o cron diário de `/api/cron/check-alerts`
   — a Vercel envia automaticamente `Authorization: Bearer $CRON_SECRET`
   quando a env var `CRON_SECRET` está configurada no projeto
4. Deploy normal via `vercel` CLI ou integração com o repositório Git

## Estrutura

```
src/
  app/
    page.tsx                    # tela de busca
    alertas/page.tsx             # gestão de alertas (fase 2)
    api/search/route.ts          # busca principal (orquestra datas flexíveis + aeroportos)
    api/airports/route.ts        # autocomplete de aeroportos
    api/alerts/route.ts          # CRUD de alertas
    api/cron/check-alerts/route.ts  # cron diário (fase 2)
  lib/
    amadeus.ts                   # cliente Amadeus (OAuth, flight offers, locations)
    mockData.ts                  # gerador de dados simulados (sem API key)
    searchFlights.ts             # orquestração: matriz de datas x aeroportos, cache, dedupe
    dateMatrix.ts                # geração da matriz de datas flexíveis
    combinedRoutes.ts            # config de destinos "voo + trecho terrestre"
    airports.ts                  # lista estática + grupos de aeroportos próximos
    currency.ts / format.ts      # conversão e formatação BRL
    cache.ts                     # cache de buscas (SearchCache, com fallback em memória)
    email.ts                     # notificação de queda de preço (Resend)
    seatsAero.ts                  # disponibilidade de milhas (seats.aero, opcional)
  components/                    # SearchForm, ResultsTable, PriceHeatmap, SaveAlertForm, AwardOptions
prisma/schema.prisma              # Alert, PriceHistory, SearchCache
```

## Limitações conhecidas (MVP)

- Só um provedor de voos integrado (Amadeus). Kiwi/Duffel/Skyscanner ficariam
  em `src/lib/` seguindo o mesmo padrão de `amadeus.ts`, agregando ofertas em
  `searchFlights.ts` antes do dedupe.
- Sem autenticação (uso pessoal, single-user) — alertas não são segmentados
  por usuário, qualquer um com acesso ao app vê/gerencia todos os alertas.
- Sugestão automática de rota combinada só existe para os destinos
  cadastrados em `combinedRoutes.ts` (hoje: Ciudad del Este). Para uma rota
  qualquer sem resultado, o app apenas orienta a tentar datas/aeroportos
  flexíveis.
- A comparação de passagens separadas usa só a origem/destino principal (não
  faz fan-out completo por rota combinada); e a integração com seats.aero
  segue a documentação pública deles no momento em que foi escrita — se a
  API deles mudar de formato, `src/lib/seatsAero.ts` pode precisar de ajuste.
