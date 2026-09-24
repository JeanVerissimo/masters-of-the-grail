// Tradução en-US. Chaves ausentes aqui caem para o português (ver translate).
export const coreEn: Record<string, string> = {
  manaEfficiency: "Healing efficiency",
  mystery: "Mystery",
  limits: "Limits per Agent / match",
  maxRequests: "Max calls",
  maxTokens: "Token budget",
  maxOutputTokens: "Tokens per answer",
  timeoutMs: "Time per decision (ms)",
  retries: "Retries",
  maxToolCalls: "Tools per decision",
  maxCost: "Cost limit (optional)",
  inputPrice: "Price per million input tokens",
  outputPrice: "Price per million output tokens",
  title: "HOLY GRAIL WAR",
  players: "Masters",
  bot: "Bot",
  agent: "Agent",
  provider: "Provider",
  providerId: "Identifier",
  providerMissing: "No provider — Bot fallback",
  error: "The action could not be completed.",
  ritualDescription:
    "The Grail hears your intentions. No choice guarantees who will answer.",
  manaWarning:
    "Offered Mana is spent for good. A rarer summon leaves less for healing.",
  desiredTrait: "What kind of Servant do you seek?",
  grailWish: "What do you wish from the Grail?",
  alignment: "What is your alignment?",
  catalyst: "Which catalyst will you use?",
  classFocus: "Which class do you want to attract?",
  manaOffering: "How much Mana will you offer?",
  mana: "Mana",
  np: "Noble Phantasm",
  replayStep: "Decision",
  noEvents: "Silence precedes the ritual.",
  locationDescription:
    "Your destination is sealed before the day action and revealed at nightfall.",
  dayDescription: "Day actions are secret and resolved simultaneously.",
  combatDescription:
    "Choose one attack against each rival. Every attack happens, even if your Servant falls.",
  noBattle: "No opponents at this location.",
  spectating: "Your Master was eliminated. Advance to watch the outcome.",
  npHelp:
    "Hits every rival, spends 5 charges and reveals your identity to those present.",
  locked: "Destination sealed",
  condition: "Condition",
  damage: "Damage dealt",
  requests: "Agent decisions",
  fallbacks: "Fallbacks",
  principle: "Controllers decide. Game Engine resolves.",
  connectionId: "e.g. local-model",
  modelPlaceholder: "Installed model name",
  namePlaceholder: "Master name",
  summoningCost: "Mana cost",
  settingsSaved: "Settings saved",
  classes: "Classes",
  roster: "Heroic spirits",
  prepared: "Terrain prepared",
  ritualOdds:
    "More Mana raises the odds of rarity. Class, catalyst and compatibility shape the weights.",
  Balanced: "Balanced",
  Aggressive: "Aggressive",
  Cautious: "Cautious",
  Investigator: "Investigator",
  Survivalist: "Survivalist",
  "help.INVESTIGATE_SERVANT":
    "Advance toward a rival's identity; their Mystery reduces the gain. At 100%, reveal the Servant and deal 25% more damage to them. Hiding blocks investigation.",
  "help.INVESTIGATE_MASTER":
    "Learn two possible destinations of the target; exactly one is true.",
  "help.TRANSFER_MANA":
    "Spend Mana to restore vitality based on the Servant's efficiency.",
  "help.PREPARE_TERRAIN":
    "+25% damage at the chosen location, for tonight only.",
  "help.HIDE": "Block investigations against you today.",
  "help.USE_LEYLINE": "+1 Noble Phantasm charge, up to 5.",
  POWER: "Power",
  LOYALTY: "Loyalty",
  CUNNING: "Cunning",
  KNOWLEDGE: "Knowledge",
  CHAOS: "Chaos",
  RESILIENCE: "Resilience",
  ANY: "Any spirit",
  PROTECTION: "Protection",
  REDEMPTION: "Redemption",
  FREEDOM: "Freedom",
  RECOGNITION: "Recognition",
  CHANGE_THE_WORLD: "Change the world",
  NO_WISH: "No wish",
  LAWFUL_GOOD: "Lawful good",
  LAWFUL_NEUTRAL: "Lawful neutral",
  LAWFUL_EVIL: "Lawful evil",
  NEUTRAL_GOOD: "Neutral good",
  TRUE_NEUTRAL: "True neutral",
  NEUTRAL_EVIL: "Neutral evil",
  CHAOTIC_GOOD: "Chaotic good",
  CHAOTIC_NEUTRAL: "Chaotic neutral",
  CHAOTIC_EVIL: "Chaotic evil",
  ROYAL_RELIC: "Royal relic",
  ANCIENT_WEAPON: "Ancient weapon shard",
  SACRED_RELIC: "Sacred relic",
  MYSTIC_ARTIFACT: "Mystic artifact",
  WARRIOR_RELIC: "Warrior's relic",
  OLD_MANUSCRIPT: "Old manuscript",
  CRIMINAL_RELIC: "Criminal's relic",
  NONE: "No preference",
  LOW: "Low · 10 Mana",
  MEDIUM: "Medium · 25 Mana",
  HIGH: "High · 45 Mana",
  EXTREME: "Extreme · 65 Mana",
  SABER: "Saber",
  ARCHER: "Archer",
  LANCER: "Lancer",
  RIDER: "Rider",
  CASTER: "Caster",
  ASSASSIN: "Assassin",
  BERSERKER: "Berserker",
  BUSTER: "Buster",
  ARTS: "Arts",
  QUICK: "Quick",
  HEALTHY: "Healthy",
  WOUNDED: "Wounded",
  CRITICAL: "Critical",
  DEFEATED: "Defeated",
  UNKNOWN: "Unknown",
  "location-1": "Ashen Harbor",
  "location-2": "Moon Temple",
  "location-3": "Forgotten Garden",
  "location-4": "Clock Tower",
  "location-5": "Old Station",
  "location-6": "Veiled Bridge",
  "location-7": "Library",
  "location-8": "Observatory",
  SUMMONED: "A spirit answered the call",
  DAY_STARTED: "A new day begins",
  NIGHT_STARTED: "Destinations are revealed",
  MANA_SPENT: "Mana spent",
  HEALED: "Vitality restored",
  IDENTITY_GAINED: "Identity progress",
  IDENTITY_DISCOVERED: "True name discovered",
  INVESTIGATION_BLOCKED: "Investigation blocked",
  LOCATION_CLUE: "Possible destinations",
  LOCATION_REVEALED: "Destination revealed",
  DAMAGE_RESOLVED: "Attack resolved",
  NP_USED: "Noble Phantasm unleashed",
  ELIMINATION_CREDIT: "Elimination assist",
  PLAYER_ELIMINATED: "Master eliminated",
  MATCH_FINISHED: "The war has ended",
  INVALID_INPUT: "Check the values you entered.",
  INSUFFICIENT_MANA: "Not enough Mana.",
  MATCH_BUSY: "Wait for the other Masters to decide.",
  SESSION_REQUIRED: "Reload the page to open the local session.",
  REQUEST_FAILED: "The operation failed. Check the settings and try again.",
  REPLAY_AVAILABLE_AFTER_MATCH: "The replay is available once the match ends.",
  INVALID_PROVIDER_URL: "The provider URL is not valid.",
  HTTPS_REQUIRED_FOR_REMOTE_PROVIDER: "Use HTTPS for remote providers.",
  PROVIDER_HTTP_401: "The provider rejected the credential.",
  PROVIDER_HTTP_404: "Endpoint or model not found.",
  PROVIDER_UNAVAILABLE: "Provider unavailable; the Bot takes over.",
  BROWSER_STORAGE_FULL:
    "Your browser has no space left to save. Clear this site's data and try again.",
  SAVE_NOT_FOUND: "Save not found.",
  PROVIDER_NOT_FOUND: "Connection not found. Save it again.",
  PROVIDER_HTTP_400: "The service refused the request. Check the model name.",
  PROVIDER_HTTP_429: "The service usage limit was reached. Try again later.",
  PROVIDER_NO_CREDIT:
    "Connected, but the service account has no balance or credits.",
  PROVIDER_INVALID_KEY: "The API key was rejected. Check the key you entered.",
  PROVIDER_MODEL_NOT_FOUND:
    "The service could not find that model. Check the exact name.",
  PROVIDER_RATE_LIMIT: "Too many requests to the service. Try again later.",
  PROVIDER_TIMEOUT: "The model took too long to answer.",
  PROVIDER_UNREACHABLE:
    "Could not reach the service. Check the URL and whether Ollama is running.",
  PROVIDER_INVALID_RESPONSE: "The service answered in an unexpected format.",
  PROVIDER_INVALID_JSON: "The model answered, but not with valid JSON.",
  PROVIDER_OUTPUT_TRUNCATED:
    "The answer was cut off. Raise the tokens-per-answer limit.",
  EMPTY_PROVIDER_RESPONSE: "The model returned an empty answer.",
  NOT_FOUND: "Not found.",
};

export const tutorialEn: Record<string, string> = {
  tutorial: "Guided tutorial",
  "tutorial.resume": "Resume tutorial",
  "tutorial.restart": "Restart tutorial",
  "tutorial.exit": "Back to start",
  "tutorial.next": "Continue lesson",
  "tutorial.practice": "Practice in a new match",
  "tutorial.label": "GRAIL ACADEMY · GUIDED MATCH",
  "tutorial.mode":
    "Training with scripted decisions. Go at your own pace; opponents only act after you confirm. Progress is kept while the game stays open.",
  "tutorial.chapter": "Chapter",
  "tutorial.chapter.1": "The ritual",
  "tutorial.chapter.2": "The summoning",
  "tutorial.chapter.3": "The first night",
  "tutorial.chapter.4": "Information and resources",
  "tutorial.chapter.5": "Charging the NP",
  "tutorial.chapter.6": "The final showdown",
  "tutorial.result": "What happened",
  "tutorial.execute": "Execute",
  "tutorial.fixed":
    "In this training, follow the highlighted option. In a normal match, every choice is yours.",
  "tutorial.wrongAttack":
    "Here the mentor announced Arts. Buster beats Arts; choose Buster to practice the advantage. In a normal match, the rival's decision stays secret.",
  "tutorial.ritualPreset": "Ritual for this training",
  "tutorial.health":
    "Vitality and Mana are not the same thing: the Servant loses HP in combat; the Master spends Mana on summoning and healing. Mana never regenerates.",
  "tutorial.welcome.title": "Your first Holy Grail War",
  "tutorial.welcome.body":
    "Win by being the last Master with a living Servant. With Artoria Saber at your side, you will face a mentor in a scripted match: summoning → secret destination → one day action → simultaneous combat. We will try all six actions and finish with Excalibur, your Noble Phantasm. This match is separate from your saved wars.",
  "tutorial.trait.title": "1 · The personality you seek",
  "tutorial.trait.body":
    "The desired trait favors compatible Servants: Power, Loyalty, Cunning, Knowledge, Chaos or Resilience. Any spirit removes that preference. We will use Loyalty. Affinity raises a candidate's weight in the draw; it does not pick a character directly.",
  "tutorial.wish.title": "2 · Your wish for the Grail",
  "tutorial.wish.body":
    "The wish attracts heroes with similar motives. Protection favors compassion and loyalty; Knowledge favors curiosity. No wish has affinities of its own too. Our wish will be Protection.",
  "tutorial.alignment.title": "3 · Your alignment",
  "tutorial.alignment.body":
    "The lawful–neutral–chaotic and good–neutral–evil axes shape compatibility. The closer the alignment, the greater the candidate's weight. We will use Lawful good. Alignment grants no combat bonus.",
  "tutorial.catalyst.title": "4 · A link to a legend",
  "tutorial.catalyst.body":
    "A catalyst favors Servant tags: a Royal relic attracts royal figures and knights; an Old manuscript favors writers, mages and artists. No catalyst strengthens the influence of personality, wish and alignment. Our ritual will use a Royal relic.",
  "tutorial.class.title": "5 · A preferred class",
  "tutorial.class.body":
    "Saber, Archer, Lancer, Rider, Caster, Assassin and Berserker are available. Focusing on Saber raises its weight but does not guarantee the class. In this game there is no automatic class advantage: combat uses Buster, Arts and Quick.",
  "tutorial.offering.title": "6 · The price of summoning",
  "tutorial.offering.body":
    "You start with 100 Mana. Low, Medium, High and Extreme offerings cost 10, 25, 45 and 65. Rarity is drawn first; then a Servant of that rarity, weighted by affinity. Extreme offering: 0% 1★, 5% 2★, 20% 3★, 40% 4★ and 35% 5★. We will use Extreme: 35 Mana will remain, with no 5★ guarantee.",
  "tutorial.summon.title": "Perform your first ritual",
  "tutorial.summon.body":
    "Confirm the six choices below. The random sequence is fixed so this lesson always has the same result. Outside training, the seed and every Master's decisions determine the summoning.",
  "tutorial.summon.result":
    "Artoria answered: Saber 5★, bearer of Excalibur. The extreme offering spent 65 Mana and left 35. Artoria is guaranteed only in this fixed-sequence script; in normal matches the same combination guarantees neither a 5★ Servant nor a specific character. Note the B/A/Q stats, the healing efficiency and her Noble Phantasm.",
  "tutorial.destination.title": "Choose before you know where they are",
  "tutorial.destination.body":
    "Your destination is secret and locks when you confirm. You only fight whoever ends the night at the same location. In this first exercise, choose Ashen Harbor; the mentor will go there too. Investigating a Master later does not let you change today's destination.",
  "tutorial.destination.result":
    "Destination confirmed. Now choose a day action. The rival's whereabouts stay hidden until night.",
  "tutorial.travel.title": "A safe day to practice",
  "tutorial.travel.body":
    "Stay at Ashen Harbor. The mentor will move elsewhere during these lessons, so you can try the resources without new attacks. In a normal match, splitting from rivals also avoids combat.",
  "tutorial.travel.result":
    "Destination locked for today. Next, another chance to use your day action.",
  "tutorial.return.title": "Meeting the mentor again",
  "tutorial.return.body":
    "Your NP reached 5/5. Go to Ashen Harbor for the final showdown. The mentor charged their NP too: both of you will attack, even if one falls this round.",
  "tutorial.return.result":
    "The showdown is near. Prepare the terrain before unleashing your NP.",
  "tutorial.PREPARE_TERRAIN.title": "Prepare terrain",
  "tutorial.PREPARE_TERRAIN.body":
    "You get a single action per day. Preparing terrain multiplies your damage by 1.25 in tonight's combat. The effect ends when the next day starts. Use it when you expect to meet opponents at the chosen location.",
  "tutorial.PREPARE_TERRAIN.result":
    "Terrain prepared and positions revealed. The mentor is at the same location: there will be combat. Your 25% damage bonus is already active tonight.",
  "tutorial.combat.title": "Buster → Arts → Quick → Buster",
  "tutorial.combat.body":
    "Buster beats Arts; Arts beats Quick; Quick beats Buster. Advantage multiplies the stat by 1.25, a tie by 1 and disadvantage by 0.75. No type is always better: compare your Servant's stats too. For this exercise, the mentor announced Arts. Choose Buster. Damage on both sides resolves together.",
  "tutorial.combat.result":
    "You dealt damage with advantage and terrain, but you also took the mentor's attack. Check the numbers in the log and your vitality. When facing several rivals, choose one attack per enemy. Taking part in combat also gives a small boost to identity discovery.",
  "tutorial.TRANSFER_MANA.title": "Transfer Mana to heal",
  "tutorial.TRANSFER_MANA.body":
    "Spend 10 Mana to heal the first night's damage. Healing is Mana × the Servant's efficiency × 10, capped at max HP. The full cost applies even when part of the healing exceeds that cap. Mana never regenerates: plan your reserve.",
  "tutorial.TRANSFER_MANA.result":
    "Artoria recovered the 96 HP she lost and spent 10 Mana: 25 remain. The healing could restore 100 HP, but it was capped at max vitality. Check the log. Since the Masters were at different locations, the night ended without combat and a new day began.",
  "tutorial.INVESTIGATE_SERVANT.title": "Investigate a Servant",
  "tutorial.INVESTIGATE_SERVANT.body":
    "Investigate the mentor to learn more about their identity. Mystery reduces the gain: 25 ÷ (1 + Mystery/100). Each Master has their own progress. At 100% you see name, class and rarity and deal 25% more damage to that target. Defeat reveals the Servant to everyone; when the war ends, every identity is revealed.",
  "tutorial.INVESTIGATE_SERVANT.result":
    "The identity bar advanced, but the name is still hidden: it has not reached 100% yet. You do not learn the rival's exact HP, Mana or NP charge. Investigation works at a distance, as long as they do not Hide.",
  "tutorial.INVESTIGATE_MASTER.title": "Investigate a Master",
  "tutorial.INVESTIGATE_MASTER.body":
    "This action yields a clue with two locations: one true and one false, in random order. It does not reveal the Servant's identity and does not let you change the destination you already chose. If the target hides, the investigation fails.",
  "tutorial.INVESTIGATE_MASTER.result":
    "Check the two-location clue in the log. Positions were revealed at nightfall, so you can compare the clue with the mentor's real destination. In a normal war, everyone's day decisions resolve together.",
  "tutorial.HIDE.title": "Hide",
  "tutorial.HIDE.body":
    "Hiding blocks Master and Servant investigations against you today, regardless of resolution order. The mentor will try to investigate you in this lesson. It does not avoid combat or hide the destination revealed at night.",
  "tutorial.HIDE.result":
    "You hid during the day. The mentor's investigation attempt was blocked; the failure notice belongs to their view. At night your destination was revealed as usual. Identities discovered earlier are not erased.",
  "tutorial.USE_LEYLINE.title": "Use a leyline",
  "tutorial.USE_LEYLINE.body":
    "This action adds 1 point to your NP charge, up to 5. It does not restore the Master's Mana reserve. Practice over five safe days and watch the five markers on your Servant's panel.",
  "tutorial.USE_LEYLINE.result":
    "Your NP charge rose by 1. The Mana reserve stays the same. If points are still missing, repeat tomorrow. Once all five markers are lit, you can use the Noble Phantasm in combat.",
  "tutorial.np.title": "Unleash the Noble Phantasm",
  "tutorial.np.body":
    "Artoria is ready to unleash Excalibur: Buster, power ×1.9. With 5 points, the NP replaces every normal attack and hits each enemy at your location. It uses its BAQ type and power multiplier and keeps the terrain and identity bonuses. It spends the whole charge. Anyone who witnesses the NP learns your identity; distant observers gain 40 progress, reduced by Mystery. The bonus from that reveal applies to later fights.",
  "tutorial.np.result":
    "Both NPs resolved simultaneously: even while falling, the mentor dealt damage. You revealed your identities to each other. Eliminating a rival grants 1 NP point to every surviving attacker who contributed, which is why your charge ended at 1 after spending all 5.",
  "tutorial.finish.title": "Finish the showdown",
  "tutorial.finish.body":
    "Keep Buster to finish the showdown. When only one Servant remains alive, their Master wins; if everyone falls together, it is a draw.",
  "tutorial.finish.result":
    "Check the damage, the eliminations and the result in the log.",
  "tutorial.complete.title": "You completed the Grail Academy",
  "tutorial.complete.body":
    "Artoria Saber defeated the mentor with Excalibur. You practiced the ritual, destinations, all six day actions, the BAQ cycle and the NP. In normal wars your rivals' choices are secret: save Mana, investigate identities and pick when to fight. You can also save a war and, once it ends, open its replay from the match panel.",
  TUTORIAL_FOLLOW_GUIDE:
    "Follow the highlighted action for this tutorial step.",
  TUTORIAL_STALE_STEP:
    "This step has already advanced. Go back to the start and continue the tutorial.",
  TUTORIAL_NOT_STARTED: "Start the tutorial from the home page.",
  TUTORIAL_COMPLETE:
    "Tutorial complete. Start a match or restart the training.",
};

export const expansionEn: Record<string, string> = {
  "simulator.useAnswers": "Copy answers to summoning",
  "simulator.applied":
    "The six simulator answers were applied. You can review them before confirming the summoning.",
  "simulator.prepareMatch":
    "Answers copied. Set up a match with a human player; the ritual will be filled in when it starts.",
  "reveal.all": "Every Servant in the war",
  "reveal.finished": "The war is over. Every identity has been revealed.",
  "catalog.title": "Throne of Heroes",
  "catalog.eyebrow": "ARCHIVE OF HEROIC SPIRITS",
  "catalog.intro":
    "Meet every available Servant, compare their stats and find the rituals most likely to call them.",
  "catalog.search": "Search Servant",
  "catalog.searchPlaceholder": "Servant name…",
  "catalog.rarity": "Rarity",
  "catalog.alignment": "Alignment",
  "catalog.noCatalyst": "No catalyst",
  ALL: "All",
  "catalog.empty": "No Servant matches the filters.",
  "catalog.retry": "Try again",
  "catalog.affinities": "Favored traits",
  "catalog.best": "The three most likely rituals",
  "catalog.probabilityHelp":
    "Real chance per summoning: compatible choices carry more weight, capped at 39.9% per Servant. The percentage includes the rarity draw and competition with other candidates. Values are rounded; no combination guarantees the result. These odds apply to new matches; older matches keep the previous rules.",
  "catalog.calculating": "Comparing every ritual combination…",
  "catalog.tryRecipe": "Try in the simulator",
  "catalog.provisional":
    "Editorial descriptions. Stats and NPs are provisional adaptations for this game. On ties, we show three distinct combinations among the most likely.",
  "simulator.title": "Summoning simulator",
  "simulator.eyebrow": "RITUAL LABORATORY",
  "simulator.intro":
    "Change the six answers freely and compare the odds before starting a war.",
  "simulator.noCost":
    "Theoretical simulation: it spends no Mana, summons no Servant and does not touch your matches.",
  "simulator.topFive": "The five most likely answers to your call",
  "simulator.remaining": "Chance of all other Servants:",
  "simulator.chance": "Chance to summon",
  "simulator.tieHelp":
    "The remaining probability belongs to the other candidates. Ties use a stable order; they do not mean draw priority.",
  "combat.result": "Combat resolution",
  "combat.simultaneous":
    "Every attack was calculated before eliminations. Review the result before continuing.",
  "combat.dealt": "Damage dealt",
  "combat.received": "Damage taken",
  "combat.advantage": "Advantage",
  "combat.disadvantage": "Disadvantage",
  "combat.tie": "Type tie",
  "combat.matchup": "BAQ type",
  "combat.notUsed": "not used",
  "combat.after": "After the battle",
  "combat.ownStatus": "Your Servant",
  "combat.survived": "Survived",
  "combat.enemyHealth":
    "Rival vitality is shown as a condition. Their exact HP stays hidden.",
  "combat.npUsers": "Unleashed NP",
  "combat.eliminations": "Eliminated",
  "combat.none": "None",
  continue: "Continue",
  "combat.toResults": "See the war's outcome",
  "combat.toDay": "Next day",
  COMBAT_REVIEW_REQUIRED:
    "Read the combat resolution and click Continue before acting.",
  INVALID_COMBAT_REPORT:
    "This report does not match the current combat. Reopen the match.",
  SERVANT_NOT_FOUND: "Servant not found.",
  theme: "Visual theme",
  "theme.dark": "Dark",
  "theme.light": "Light",
  "theme.parchment": "Parchment",
  "theme.crimson": "Crimson",
  "settings.appearance": "Appearance and language",
  "help.theme":
    "Choose the interface palette. The preview is instant; confirm to keep your preference.",
  "help.locale": "Language of the interface.",
  "help.motion":
    "Reduces animations and transitions for more comfortable navigation.",
  "ollama-cloud": "Ollama Cloud",
  "help.providerId":
    "Unique name for this connection in the lobby. Use letters, numbers, hyphens or underscores. Reusing a name updates the connection.",
  "help.provider":
    "Ollama uses your local model service; Ollama Cloud uses cloud models (through a signed-in local Ollama or https://ollama.com with a key); OpenAI-compatible accepts servers with a compatible API, such as LM Studio.",
  "help.baseUrl":
    "Address of the AI service. Examples: http://localhost:11434 for Ollama (also for :cloud models with a signed-in Ollama), https://ollama.com for Ollama Cloud directly, or http://localhost:1234/v1 for a compatible service.",
  "help.model":
    "Exact identifier of a model available on the service, for example qwen2.5:7b. The game does not download models automatically.",
  "help.apiKey":
    "Optional credential required by the service. It stays only in server memory and must be entered again after a restart. For Ollama Cloud directly, the OLLAMA_API_KEY environment variable is used when this field is empty.",
  "help.maxRequests":
    "Maximum model calls per Agent in each match. When exhausted, a Bot takes over the decisions.",
  "help.maxTokens":
    "Cumulative input and output token budget per Agent and match. When reached, the Bot fallback is used.",
  "help.maxOutputTokens":
    "Token limit per answer. Low values can cut off the JSON and trigger a retry.",
  "help.timeoutMs":
    "Maximum wait per call, in milliseconds. 20000 means 20 seconds; after that, the Bot decides.",
  "help.retries":
    "Extra attempts when the answer fails or contains an invalid action. Zero disables retries.",
  "help.maxToolCalls":
    "Maximum queries to the game's tools during one Agent decision.",
  "help.maxCost":
    "Estimated cost cap per Agent and match, in the currency of the prices below. It can only be tracked when prices are set and the service reports token usage.",
  "help.inputPrice":
    "Price of one million tokens sent to the model. Use the service's rate; leaving it empty makes cost unavailable.",
  "help.outputPrice":
    "Price of one million tokens generated by the model, in the same currency as the input price. Zero means the cost is reported as free.",
};

/** Nomes de Noble Phantasm criados em português, traduzidos pela própria chave. */
export const noblePhantasmEn: Record<string, string> = {
  "Ilusão de Prelati": "Prelati's Illusion",
  "Jardim de Avalon": "Garden of Avalon",
  "Noite Primordial": "Primordial Night",
  "Tempestade dos Quatro Reis": "Storm of the Four Kings",
  "Banquete de Veneno": "Poison Banquet",
  "Névoa de Whitechapel": "Whitechapel Mist",
  "Lança do Sol": "Spear of the Sun",
  "Portões do Submundo": "Gates of the Underworld",
  "Estrela de Vênus": "Star of Venus",
  "Flecha da Dissolução": "Arrow of Dissolution",
  "Templo do Rei Solar": "Temple of the Sun King",
  "Fronteira do Gênio": "Frontier of Genius",
  "Corte do Vazio": "Cut of the Void",
  "Espelho do Submundo": "Mirror of the Underworld",
  "Sabedoria Oculta": "Hidden Wisdom",
  "Árvore Relampejante": "Lightning Tree",
  "Banquete da Raposa": "Fox's Banquet",
  "Donzela de Ferro": "Iron Maiden",
  "Jardim Venenoso": "Poison Garden",
  "Lança Sagrada": "Holy Lance",
  "Sonho de Cavalaria": "Dream of Chivalry",
  "Chuva da Caçadora": "Huntress's Rain",
  "Flecha da Constelação": "Constellation Arrow",
  "Cinturão da Rainha": "Queen's Girdle",
  "Fio do Destino": "Thread of Fate",
  "Teatro Dourado": "Golden Theater",
};
