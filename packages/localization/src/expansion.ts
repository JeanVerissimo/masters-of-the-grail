export const expansionPt: Record<string, string> = {
  "simulator.useAnswers": "Copiar respostas para invocação",
  "simulator.applied":
    "As seis respostas do simulador foram aplicadas. Você pode revisá-las antes de confirmar a invocação.",
  "simulator.prepareMatch":
    "Respostas copiadas. Configure uma partida com um jogador humano; o ritual será preenchido ao começar.",
  "reveal.all": "Todos os Servos da guerra",
  "reveal.finished": "A guerra terminou. Todas as identidades foram reveladas.",
  "catalog.title": "Trono dos Heróis",
  "catalog.eyebrow": "ARQUIVO DOS ESPÍRITOS HEROICOS",
  "catalog.intro":
    "Conheça todos os Servos disponíveis, compare seus atributos e encontre os rituais com maior chance de chamá-los.",
  "catalog.search": "Buscar Servo",
  "catalog.searchPlaceholder": "Nome do Servo…",
  "catalog.rarity": "Raridade",
  "catalog.alignment": "Alinhamento",
  "catalog.noCatalyst": "Sem catalisador",
  ALL: "Todos",
  "catalog.empty": "Nenhum Servo corresponde aos filtros.",
  "catalog.retry": "Tentar novamente",
  "catalog.affinities": "Traços favorecidos",
  "catalog.best": "Os três rituais mais prováveis",
  "catalog.probabilityHelp":
    "Chance real por invocação: escolhas compatíveis têm maior influência, com limite de 39,9% por Servo. A porcentagem inclui o sorteio da raridade e a disputa com os demais candidatos. Valores arredondados; nenhuma combinação garante o resultado. Estas chances valem para novas partidas; partidas antigas preservam as regras anteriores.",
  "catalog.calculating": "Comparando todas as combinações do ritual…",
  "catalog.tryRecipe": "Testar no simulador",
  "catalog.provisional":
    "Descrições editoriais. Atributos e NPs são adaptações provisórias deste jogo. Em caso de empate, exibimos três combinações distintas dentre as mais prováveis.",
  "simulator.title": "Simulação de invocação",
  "simulator.eyebrow": "LABORATÓRIO DO RITUAL",
  "simulator.intro":
    "Altere livremente as seis respostas e compare as chances antes de iniciar uma guerra.",
  "simulator.noCost":
    "Simulação teórica: não consome Mana, não invoca um Servo e não altera suas partidas.",
  "simulator.topFive": "Os cinco chamados mais prováveis",
  "simulator.remaining": "Chance dos demais Servos:",
  "simulator.chance": "Chance de invocar",
  "simulator.tieHelp":
    "O restante da probabilidade pertence aos outros candidatos. Empates usam uma ordem estável; não significam prioridade no sorteio.",
  "combat.result": "Resolução do combate",
  "combat.simultaneous":
    "Todos os ataques foram calculados antes das eliminações. Confira o resultado antes de continuar.",
  "combat.dealt": "Dano causado",
  "combat.received": "Dano recebido",
  "combat.advantage": "Vantagem",
  "combat.disadvantage": "Desvantagem",
  "combat.tie": "Empate de tipos",
  "combat.matchup": "Tipo BAQ",
  "combat.notUsed": "não utilizado",
  "combat.after": "Após a batalha",
  "combat.ownStatus": "Seu Servant",
  "combat.survived": "Sobreviveu",
  "combat.enemyHealth":
    "A vitalidade dos rivais é mostrada por condição. O HP exato deles permanece oculto.",
  "combat.npUsers": "Liberaram NP",
  "combat.eliminations": "Eliminados",
  "combat.none": "Nenhum",
  continue: "Continuar",
  "combat.toResults": "Ver resultado da guerra",
  "combat.toDay": "Próximo dia",
  COMBAT_REVIEW_REQUIRED:
    "Leia a resolução do combate e clique em Continuar antes de agir.",
  INVALID_COMBAT_REPORT:
    "Este relatório não corresponde ao combate atual. Reabra a partida.",
  SERVANT_NOT_FOUND: "Servo não encontrado.",
  theme: "Tema visual",
  "theme.dark": "Dark",
  "theme.light": "Light",
  "theme.parchment": "Pergaminho",
  "theme.crimson": "Carmesim",
  "settings.appearance": "Aparência e idioma",
  "help.theme":
    "Escolha a paleta da interface. A prévia é imediata; confirme para guardar sua preferência.",
  "help.locale": "Idioma da interface.",
  "help.motion":
    "Reduz animações e transições para uma navegação mais confortável.",
  "ollama-cloud": "Ollama Cloud",
  "help.providerId":
    "Nome único desta conexão no lobby. Use letras, números, hífen ou sublinhado. Reutilizar um nome atualiza a conexão.",
  "help.provider":
    "Ollama usa seu serviço local de modelos; Ollama Cloud usa modelos na nuvem (via Ollama local autenticado ou https://ollama.com com chave); OpenAI-compatible aceita servidores com API compatível, como LM Studio.",
  "help.baseUrl":
    "Endereço do serviço de IA. Exemplos: http://localhost:11434 para Ollama (também para modelos :cloud com Ollama autenticado), https://ollama.com para Ollama Cloud direto ou http://localhost:1234/v1 para um serviço compatível.",
  "help.model":
    "Identificador exato de um modelo disponível no serviço, por exemplo qwen2.5:7b. O jogo não baixa modelos automaticamente.",
  "help.apiKey":
    "Credencial opcional exigida pelo serviço. Fica apenas na memória do servidor e precisa ser informada novamente após reiniciá-lo. Para Ollama Cloud direto, a variável de ambiente OLLAMA_API_KEY é usada quando o campo fica vazio.",
  "help.maxRequests":
    "Número máximo de chamadas ao modelo por Agent em cada partida. Ao esgotar, um Bot assume as decisões.",
  "help.maxTokens":
    "Orçamento acumulado de tokens de entrada e saída por Agent e partida. Ao atingir o limite, usa Bot fallback.",
  "help.maxOutputTokens":
    "Limite de tokens por resposta. Valores baixos podem cortar o JSON e provocar uma nova tentativa.",
  "help.timeoutMs":
    "Tempo máximo de espera por chamada, em milissegundos. 20000 equivale a 20 segundos; depois disso, o Bot decide.",
  "help.retries":
    "Tentativas extras quando a resposta falha ou traz uma ação inválida. Zero desativa novas tentativas.",
  "help.maxToolCalls":
    "Máximo de consultas às ferramentas do jogo durante uma decisão do Agent.",
  "help.maxCost":
    "Teto de custo estimado por Agent e partida, na moeda das tarifas abaixo. Só pode ser acompanhado quando há tarifas e uso de tokens informado pelo serviço.",
  "help.inputPrice":
    "Preço de um milhão de tokens enviados ao modelo. Use a tarifa do serviço; vazio deixa o custo indisponível.",
  "help.outputPrice":
    "Preço de um milhão de tokens gerados pelo modelo, na mesma moeda do preço de entrada. Zero representa custo informado como gratuito.",
};
