# Masters of the Grail

**Português** · [English](README.en.md)

Jogo de estratégia por turnos com informação oculta, construído como laboratório para comparar três formas de tomar decisões sob as mesmas regras: **raciocínio humano**, **Bots determinísticos** e **Agents de IA baseados em LLM**.

![Tela inicial de Masters of the Grail](docs/images/home.png)

> **Controllers decide. Game Engine resolves.**
> Humano, Bot ou Agent: todos recebem a mesma visão parcial do jogo e devolvem uma intenção. Só o motor conhece o estado real.

## Por que este projeto existe

Benchmarks de LLM costumam medir respostas isoladas. Aqui o Agent precisa **jogar**: planejar com informação incompleta, consultar ferramentas, manter memória entre turnos, respeitar orçamento e tempo, e produzir uma ação válida a cada decisão.

O jogo foi desenhado para que as três mentes disputem a mesma partida em condições idênticas:

|              | Humano                              | Bot                              | Agent de IA                                                    |
| ------------ | ----------------------------------- | -------------------------------- | -------------------------------------------------------------- |
| Como decide  | Intuição, leitura dos rivais, blefe | Utility AI com pesos por perfil  | LLM com tools e memória                                        |
| O que vê     | `PlayerView`                        | `PlayerView`                     | `PlayerView`, consultada via tools                             |
| Reprodutível | Não                                 | Sim: mesma seed, mesmas decisões | Não, e com custo e latência                                    |
| Quando falha | Erra a jogada                       | Nunca falha, mas é previsível    | Resposta inválida, timeout ou orçamento esgotado: o Bot assume |

A pergunta que o projeto permite investigar: **um modelo de linguagem raciocina melhor que uma heurística determinística quando o jogo exige dedução, blefe e gestão de recursos?** E quanto isso custa?

## O jogo em um minuto

Masters invocam Servants e disputam o Santo Graal até restar um.

1. **Invocação:** seis escolhas de ritual pesam a probabilidade de cada um dos 63 Servants. A Mana gasta define a raridade.
2. **Destino:** cada Master sela em segredo o local onde passará a noite.
3. **Ação diurna:** investigar um Servant ou Master, transferir Mana, preparar terreno, ocultar-se ou carregar o Noble Phantasm numa linha ley.
4. **Noite:** destinos revelados. Todos no mesmo local lutam, com dano calculado de forma simultânea.
5. Buster vence Arts, Arts vence Quick, Quick vence Buster. Descobrir o nome verdadeiro de um rival concede +25% de dano contra ele.

Informação é o recurso central. Quem investiga melhor sabe onde o rival estará e contra quem vale lutar. Por isso o jogo é um bom teste de raciocínio.

![Ação diurna durante uma partida](docs/images/day-action.png)

## Agents de IA: como funciona

O `AgentRuntime` transforma um LLM num jogador seguro e auditável:

- **Visão mínima.** O modelo recebe somente a `PlayerView` do seu Master. Estado privado dos rivais nunca entra no prompt.
- **Tools de consulta.** O Agent pode responder `{"tool": "get_known_enemies"}` em vez de agir, e o runtime devolve o resultado. Tools disponíveis: `get_my_servant`, `get_my_resources`, `get_known_enemies`, `get_locations` e `get_investigation_results`. Tools apenas leem; nunca alteram o estado.
- **Protocolo JSON próprio.** Não depende de tool calling nativo do provider, então funciona com qualquer modelo que produza JSON.
- **Validação em duas camadas.** Schema Zod para a estrutura e o motor do jogo para a legalidade. JSON válido não garante jogada válida.
- **Memória separada.** Fatos verificados ficam separados das hipóteses do próprio Agent, que pode anotar suspeitas curtas entre turnos.
- **Orçamentos por Agent.** Limites de chamadas, tokens, custo, tempo por decisão, retries e tools por decisão. Tokens são reservados antes da chamada e reconciliados com o uso real.
- **Bot fallback.** Timeout, erro do provider, resposta inválida ou orçamento esgotado fazem o Bot decidir naquele turno. A partida nunca trava.
- **Telemetria.** Latência, tokens, custo estimado, tentativas inválidas e fallbacks por decisão, sem vazar credenciais.
- **Invocação numa chamada.** As seis escolhas do ritual saem de uma única resposta estruturada.

### Providers suportados

| Provider              | Exemplo de URL                                            | Observação                                          |
| --------------------- | --------------------------------------------------------- | --------------------------------------------------- |
| Ollama local          | `http://127.0.0.1:11434`                                  | Saída estruturada via `format`                      |
| Ollama Cloud          | `https://ollama.com` ou Ollama local com modelos `:cloud` | Sem chave pelo Ollama local autenticado             |
| OpenAI                | `https://api.openai.com/v1`                               | Erros de saldo, chave e modelo com mensagens claras |
| Compatível com OpenAI | LM Studio, gateways, outros serviços                      | `/chat/completions` com JSON mode                   |

Chaves de API ficam só na memória do servidor. Nunca são gravadas em disco, retornadas pela API, incluídas em saves ou replays, nem registradas na telemetria.

![Conexões de Agents nas configurações](docs/images/agent-connections.png)

## Instalar e rodar

**Requisitos:** [Node.js](https://nodejs.org/) 24 LTS (mínimo 22.13), npm e Git.

1. Confira a versão do Node:

   ```bash
   node -v
   ```

   Se aparecer algo abaixo de `v22.13.0`, atualize antes de continuar. Versões antigas causam avisos `EBADENGINE` e o erro `ERR_REQUIRE_ESM`. No Windows, rode `winget install OpenJS.NodeJS.LTS` e abra um terminal novo. Com [nvm](https://github.com/nvm-sh/nvm), rode `nvm install 24` e `nvm use 24`.

2. Baixe o projeto e instale as dependências:

   ```bash
   git clone https://github.com/JeanVerissimo/masters-of-the-grail.git
   cd masters-of-the-grail
   npm install
   ```

   Sem Git, baixe o ZIP pelo botão **Code → Download ZIP** do GitHub, extraia e abra um terminal dentro da pasta extraída.

3. Inicie o jogo:

   ```bash
   npm run dev
   ```

Abra [http://127.0.0.1:5173](http://127.0.0.1:5173). Humano contra Bots funciona sem internet, sem chave de API e sem modelo instalado.

Para a build de produção, servida em [http://127.0.0.1:3001](http://127.0.0.1:3001):

```bash
npm run build
npm start
```

### Jogar contra um Agent

1. Instale o [Ollama](https://ollama.com/) e baixe um modelo:
   ```bash
   ollama pull qwen2.5:7b
   ```
2. No jogo, abra **Configurações → Conexões de Agents**.
3. Preencha identificador, tipo `ollama`, URL `http://127.0.0.1:11434` e modelo `qwen2.5:7b`.
4. Clique em **Salvar conexão** e depois em **Testar conexão**.
5. Em **Configurar partida**, troque um oponente de `Bot` para `Agent` e escolha a conexão.

Para OpenAI ou outro serviço compatível, use o tipo `openai-compatible`, a URL do serviço, incluindo `/v1`, e sua chave.

### Comparar Agent e Bot

O benchmark roda partidas completas entre um Agent e Bots e separa decisões do modelo de decisões de fallback:

```bash
npm run benchmark -- --matches 10 --provider caminho/para/provider.json
```

O arquivo descreve a conexão, com os mesmos campos da tela de configurações. `kind` aceita `ollama`, `ollama-cloud` ou `openai-compatible`, e `apiKey` é opcional:

```json
{
  "id": "local-qwen",
  "kind": "ollama",
  "baseUrl": "http://127.0.0.1:11434",
  "model": "qwen2.5:7b",
  "limits": { "maxRequests": 20, "timeoutMs": 30000, "retries": 0 }
}
```

Sem `--provider`, o benchmark mede apenas o fallback. Se usar uma chave nesse arquivo, mantenha-o fora do repositório.

## Arquitetura

```text
React / Vite ──► REST + WebSocket ──► MatchManager (@grail/match-runtime)
                                           │
                                  GameEngine (estado privado)
                                           │
                                       PlayerView
                          ┌────────────────┼─────────────────┐
                        Human             Bot           AgentRuntime
                                                            │
                                                  LLMGateway ─► LLMProvider
```

O motor é determinístico: seed e lista de decisões reconstroem qualquer partida, o que habilita saves, replay passo a passo e simulações em massa. A orquestração das partidas fica num pacote próprio, sem dependência de Node, separada do servidor HTTP.

```text
apps/web               interface React, CSS e SVG
apps/server            Fastify, persistência local e conexões de Agents
packages/game-core     regras, RNG, invocação e replay determinístico
packages/match-runtime orquestração de partidas e tutorial, sem dependência de Node
packages/player-core   PlayerViewService: o que cada Master pode ver
packages/bot-controller Utility AI com cinco perfis
packages/agent-controller AgentRuntime, tools, memória e orçamentos
packages/llm           gateway e adapters HTTP de providers
packages/telemetry     métricas e sanitização de segredos
packages/shared        contratos e schemas Zod
data                   63 Servants e parâmetros de balanceamento
scripts                simulação e benchmark
tests                  regras, integração, segurança e providers
```

## Qualidade

```bash
npm run lint
npm run typecheck
npm test
npm run simulate -- --matches 1000
```

O CI no GitHub Actions executa lint, typecheck, testes, build, simulação e auditoria de dependências.

## Aviso

Projeto de fã, sem fins comerciais, inspirado no gênero de guerras do Graal. Não inclui arte oficial. Os Servants usam retratos gerados em CSS/SVG, e imagens autorizadas podem ser adicionadas localmente em `public/servants`.
