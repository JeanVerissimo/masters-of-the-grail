import { Select, Sigil, Portrait } from "./UI.js";
import { Throne, SummoningSimulator, defaultSimulation } from "./Catalog.js";
import { CombatResolution } from "./CombatResolution.js";
import { themes, type Theme } from "../../../packages/shared/src/catalog.js";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  traits,
  wishes,
  alignments,
  catalysts,
  classes,
  offerings,
  profiles,
  type MatchConfig,
  type PlayerView,
  type Intent,
  type SummoningDecision,
  type DayAction,
  type AttackType,
} from "@grail/shared";
import { translate, type Locale } from "@grail/localization";
import { api, AGENTS_ENABLED, LIVE_UPDATES } from "./api.js";
import { Tutorial } from "./Tutorial.js";
import type { TutorialSnapshot } from "../../../packages/shared/src/tutorial.js";

type T = (key: string) => string;
interface MatchResponse {
  id: string;
  view: PlayerView;
  human: boolean;
  busy: boolean;
  combatResolution: boolean;
  agentMetrics: {
    fallback: boolean;
    latencyMs: number;
    provider: string;
    model: string;
  }[];
}
interface Provider {
  id: string;
  kind: string;
  model: string;
}
const initialRitual: SummoningDecision = {
  desiredTrait: "LOYALTY",
  grailWish: "PROTECTION",
  alignment: "LAWFUL_GOOD",
  catalyst: "ROYAL_RELIC",
  classFocus: "SABER",
  manaOffering: "MEDIUM",
};
export function App() {
  const [theme, setTheme] = useState<Theme>("dark");
  const [simulationPreset, setSimulationPreset] = useState(defaultSimulation);
  const [ritualDraft, setRitualDraft] = useState<SummoningDecision | null>(
    null,
  );
  const [tutorial, setTutorial] = useState<TutorialSnapshot | null>(null);
  const [rosterCount, setRosterCount] = useState<number | null>(null);
  const [locale, setLocale] = useState<Locale>("pt-BR"),
    [motion, setMotion] = useState(false),
    [page, setPage] = useState("home"),
    [match, setMatch] = useState<MatchResponse | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [providers, setProviders] = useState<Provider[]>([]),
    [saves, setSaves] = useState<
      { id: string; seed: number; decisions: number }[]
    >([]),
    [ready, setReady] = useState(false);
  const [replay, setReplay] = useState<{
      replay: {
        decisions: unknown[];
        config: { players: { id: string; name: string }[] };
      };
      metrics: Record<
        string,
        { damage: number; npUsage: number; identityDiscoveries: number }
      >;
    } | null>(null),
    [frame, setFrame] = useState<PlayerView | null>(null),
    [step, setStep] = useState(0);
  const t: T = (key) => translate(locale, key);
  async function work(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : "error");
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    void (async () => {
      try {
        await api("/session");
        const settings = await api<{
          locale: Locale;
          reducedMotion: boolean;
          theme: Theme;
        }>("/settings");
        setLocale(settings.locale);
        setMotion(settings.reducedMotion);
        setTheme(settings.theme);
        if (AGENTS_ENABLED) setProviders(await api("/providers"));
        setRosterCount((await api<{ count: number }>("/catalog")).count);
        try {
          setTutorial(await api<TutorialSnapshot>("/tutorial"));
        } catch {
          /* Nenhum treinamento iniciado nesta sessão. */
        }
        setReady(true);
      } catch {
        setError("REQUEST_FAILED");
      }
    })();
  }, []);
  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dataset.reducedMotion = String(motion);
    document.documentElement.dataset.theme = theme;
  }, [locale, motion, theme]);
  useEffect(() => {
    if (!match?.id || !LIVE_UPDATES) return;
    const ws = new WebSocket(
      `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/api/matches/${match.id}/events`,
    );
    ws.onmessage = (e) => {
      const data = JSON.parse(e.data);
      if (data.type === "MATCH_UPDATED") setMatch(data);
    };
    return () => ws.close();
  }, [match?.id]);
  const navigate = (target: string) => {
    setPage(target);
    setNotice("");
    setError("");
    if (target === "archive")
      void work(async () => setSaves(await api("/saves")));
  };
  const advance = (intent?: Intent) =>
    void work(async () => {
      if (!match) return;
      setMatch(
        await api(
          `/matches/${match.id}/advance`,
          "POST",
          intent ? { intent } : {},
        ),
      );
      if (intent?.type === "SUMMON") setRitualDraft(null);
    });
  const openReplay = () =>
    void work(async () => {
      if (!match) return;
      setReplay(await api(`/matches/${match.id}/replay`));
      setFrame(await api(`/matches/${match.id}/replay/0`));
      setStep(0);
      setPage("replay");
    });
  const startTutorial = (restart = false) =>
    void work(async () => {
      setTutorial(
        await api<TutorialSnapshot>(
          "/tutorial",
          restart || !tutorial ? "POST" : "GET",
          restart || !tutorial ? {} : undefined,
        ),
      );
      setPage("tutorial");
    });
  return (
    <>
      <header>
        <button className="brand" onClick={() => navigate("home")}>
          <span className="brand-symbol">♜</span>
          <span>
            {t("title")}
            <small>{t("eyebrow")}</small>
          </span>
        </button>
        <nav>
          <button
            className={page === "throne" ? "active" : ""}
            onClick={() => navigate("throne")}
          >
            {t("catalog.title")}
          </button>
          <button
            className={page === "simulation" ? "active" : ""}
            onClick={() => navigate("simulation")}
          >
            {t("simulator.title")}
          </button>
          {match && (
            <button
              className={page === "game" ? "active" : ""}
              onClick={() => navigate("game")}
            >
              {t("war")}
            </button>
          )}
          <button
            className={page === "archive" ? "active" : ""}
            onClick={() => navigate("archive")}
          >
            {t("archive")}
          </button>
          <button
            className={page === "settings" ? "active" : ""}
            onClick={() => navigate("settings")}
          >
            {t("settings")}
          </button>
          <span className="online-dot" title={t("offline")} />
        </nav>
      </header>
      {error && (
        <div role="alert" className="notification error">
          {t(error)}
          <button onClick={() => setError("")}>×</button>
        </div>
      )}
      {notice && (
        <div role="status" className="notification">
          {t(notice)}
        </div>
      )}
      <main aria-busy={busy}>
        {page === "home" && (
          <section className="hero">
            <div className="hero-copy">
              <p className="eyebrow">I · {t("eyebrow")}</p>
              <h1>
                HOLY
                <br />
                <em>GRAIL</em> WAR
              </h1>
              <p className="subtitle">{t("subtitle")}</p>
              <p className="muted hero-description">{t("about")}</p>
              <button
                className="primary"
                disabled={!ready}
                onClick={() => navigate("lobby")}
              >
                {t("setup")} <span>↗</span>
              </button>
              <button
                className="tutorial-home-button"
                disabled={!ready || busy}
                onClick={() => startTutorial()}
              >
                <span aria-hidden="true">◇</span>{" "}
                {t(
                  tutorial && !tutorial.complete
                    ? "tutorial.resume"
                    : "tutorial",
                )}
              </button>
              <div className="hero-facts">
                <span>
                  {rosterCount ?? "—"} <small>{t("roster")}</small>
                </span>
                <span>
                  07 <small>{t("classes")}</small>
                </span>
                <span>
                  ∞ <small>{t("replay")}</small>
                </span>
              </div>
            </div>
            <div className="hero-art">
              <div className="orbit" />
              <Sigil />
              <span className="art-caption">{t("offline")}</span>
            </div>
          </section>
        )}
        {page === "throne" && (
          <Throne
            t={t}
            onSimulate={(decision) => {
              setSimulationPreset(decision);
              navigate("simulation");
            }}
          />
        )}
        {page === "simulation" && (
          <SummoningSimulator
            key={JSON.stringify(simulationPreset)}
            initial={simulationPreset}
            t={t}
            onInspect={() => navigate("throne")}
            onUse={(decision) => {
              setSimulationPreset(decision);
              setRitualDraft(decision);
              const awaitingSummon =
                match?.human &&
                match.view.phase === "SUMMONING" &&
                !match.view.ready;
              navigate(awaitingSummon ? "game" : "lobby");
              setNotice(
                awaitingSummon ? "simulator.applied" : "simulator.prepareMatch",
              );
            }}
          />
        )}
        {page === "tutorial" && tutorial && (
          <Tutorial
            snapshot={tutorial}
            t={t}
            busy={busy}
            onAdvance={(intent) =>
              void work(async () =>
                setTutorial(
                  await api<TutorialSnapshot>("/tutorial/advance", "POST", {
                    revision: tutorial.revision,
                    ...(intent ? { intent } : {}),
                  }),
                ),
              )
            }
            onExit={() => navigate("home")}
            onRestart={() => startTutorial(true)}
            onPlay={() => navigate("lobby")}
            renderBoard={(controls) => (
              <Game
                view={tutorial.view}
                t={t}
                busy={busy}
                human
                onIntent={() => {}}
                onReplay={() => {}}
                decisionSlot={controls}
              />
            )}
          />
        )}
        {page === "lobby" && (
          <Lobby
            t={t}
            providers={providers}
            busy={busy}
            onCreate={(config) =>
              void work(async () => {
                setMatch(await api("/matches", "POST", config));
                setPage("game");
              })
            }
          />
        )}
        {page === "settings" && (
          <section className="page narrow">
            <p className="eyebrow">{t("settings")}</p>
            <h2>{t("settings.appearance")}</h2>
            <div className="panel theme-panel">
              <h3>{t("theme")}</h3>
              <p className="field-help">{t("help.theme")}</p>
              <div className="theme-picker">
                {themes.map((value) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={theme === value}
                    className={`theme-choice theme-preview-${value}`}
                    onClick={() => setTheme(value)}
                  >
                    <span className="theme-swatch" aria-hidden="true" />
                    {t(`theme.${value}`)} {theme === value ? "✓" : ""}
                  </button>
                ))}
              </div>
            </div>
            <div className="panel settings-row">
              <Select
                label="locale"
                help={t("help.locale")}
                value={locale}
                options={["pt-BR", "en-US"]}
                t={t}
                onChange={(v) => setLocale(v as Locale)}
              />
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={motion}
                  onChange={(e) => setMotion(e.target.checked)}
                />
                <span>
                  {t("motion")}
                  <small className="field-help">{t("help.motion")}</small>
                </span>
              </label>
              <button
                disabled={busy}
                onClick={() =>
                  void work(async () => {
                    await api("/settings", "PUT", {
                      locale,
                      reducedMotion: motion,
                      theme,
                    });
                    setNotice("settingsSaved");
                  })
                }
              >
                {t("confirm")}
              </button>
            </div>
            {AGENTS_ENABLED && (
              <>
                <h2>{t("providers")}</h2>
                <p className="muted">{t("providerHelp")}</p>
                <ProviderForm
                  t={t}
                  busy={busy}
                  onSave={(body) =>
                    void work(async () => {
                      setProviders(await api("/providers", "POST", body));
                      setNotice("settingsSaved");
                    })
                  }
                />
                {providers.map((p) => (
                  <div className="panel provider-row" key={p.id}>
                    <div className="provider-info">
                      <strong>{p.id}</strong>
                      <p className="muted">
                        {p.kind} · {p.model}
                      </p>
                    </div>
                    <button
                      disabled={busy}
                      onClick={() =>
                        void work(async () => {
                          await api(`/providers/${p.id}/test`, "POST", {});
                          setNotice("connected");
                        })
                      }
                    >
                      {t("test")}
                    </button>
                    <button
                      className="danger"
                      disabled={busy}
                      onClick={() => {
                        if (!confirm(`${t("deleteProviderConfirm")} ${p.id}?`))
                          return;
                        void work(async () => {
                          setProviders(
                            await api(`/providers/${p.id}`, "DELETE", {}),
                          );
                          setNotice("providerDeleted");
                        });
                      }}
                    >
                      {t("deleteProvider")}
                    </button>
                  </div>
                ))}
              </>
            )}
          </section>
        )}
        {page === "archive" && (
          <section className="page narrow">
            <p className="eyebrow">{t("eyebrow")}</p>
            <h2>{t("archive")}</h2>
            {!saves.length && <p className="muted">{t("noSaves")}</p>}
            {saves.map((s) => (
              <div className="panel provider-row" key={s.id}>
                <div>
                  <strong>
                    {t("seed")} {s.seed}
                  </strong>
                  <p className="muted">
                    {s.decisions} {t("replayStep")} · {s.id.slice(0, 8)}
                  </p>
                </div>
                <button
                  disabled={busy}
                  onClick={() =>
                    void work(async () => {
                      setMatch(await api(`/matches/${s.id}/load`, "POST", {}));
                      setPage("game");
                    })
                  }
                >
                  {t("resume")}
                </button>
              </div>
            ))}
          </section>
        )}
        {page === "game" && match && (
          <>
            <div className="game-toolbar">
              <p className="eyebrow">
                {t("day")}{" "}
                {String(
                  match.combatResolution && match.view.lastCombat
                    ? match.view.lastCombat.day
                    : match.view.day,
                ).padStart(2, "0")}{" "}
                <span> / </span>{" "}
                {t(match.combatResolution ? "combat.result" : match.view.phase)}
              </p>
              <button
                disabled={busy}
                onClick={() =>
                  void work(async () => {
                    await api(`/matches/${match.id}/save`, "POST", {});
                    setNotice("saved");
                  })
                }
              >
                {t("save")}
              </button>
            </div>
            {match.combatResolution && match.view.lastCombat ? (
              <CombatResolution
                view={match.view}
                t={t}
                busy={busy}
                onContinue={() =>
                  void work(async () => {
                    setMatch(
                      await api<MatchResponse>(
                        `/matches/${match.id}/combat/continue`,
                        "POST",
                        { day: match.view.lastCombat!.day },
                      ),
                    );
                  })
                }
              />
            ) : match.view.phase === "SUMMONING" ? (
              !match.human ? (
                <section className="panel">
                  <h2>{t("SUMMONING")}</h2>
                  <button
                    className="primary"
                    disabled={busy}
                    onClick={() => advance()}
                  >
                    {t("advance")}
                  </button>
                </section>
              ) : (
                <Ritual
                  key={`${match.id}-${JSON.stringify(ritualDraft)}`}
                  initial={ritualDraft ?? initialRitual}
                  copied={!!ritualDraft}
                  t={t}
                  busy={busy}
                  onSubmit={(decision) => advance({ type: "SUMMON", decision })}
                />
              )
            ) : (
              <Game
                t={t}
                view={match.view}
                busy={busy}
                human={match.human}
                onIntent={advance}
                onReplay={openReplay}
              />
            )}
            {AGENTS_ENABLED && (
              <details className="telemetry">
                <summary>
                  {t("telemetry")} · {match.agentMetrics.length} {t("requests")}
                </summary>
                <p>
                  {t("fallbacks")}:{" "}
                  {match.agentMetrics.filter((m) => m.fallback).length}
                </p>
                {match.agentMetrics.slice(-5).map((m, i) => (
                  <p key={i}>
                    {m.provider} / {m.model} · {m.latencyMs} ms
                  </p>
                ))}
              </details>
            )}
          </>
        )}
        {page === "replay" && match && replay && frame && (
          <section className="page">
            <div className="provider-row">
              <h2>{t("replay")}</h2>
              <button
                onClick={() => {
                  const blob = new Blob([JSON.stringify(replay, null, 2)], {
                    type: "application/json",
                  });
                  const url = URL.createObjectURL(blob),
                    a = document.createElement("a");
                  a.href = url;
                  a.download = `grail-${match.id}.json`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
              >
                {t("download")}
              </button>
            </div>
            <label className="field">
              {t("replayStep")} {step} / {replay.replay.decisions.length}
              <input
                type="range"
                min="0"
                max={replay.replay.decisions.length}
                value={step}
                onChange={(e) => {
                  const next = Number(e.target.value);
                  setStep(next);
                  void api<PlayerView>(`/matches/${match.id}/replay/${next}`)
                    .then(setFrame)
                    .catch(() => setError("error"));
                }}
              />
            </label>
            <div className="panel">
              <h3>
                {t("day")} {frame.day} · {t(frame.phase)}
              </h3>
              <Journal view={frame} t={t} />
            </div>
            <div className="results-grid">
              {Object.entries(replay.metrics).map(([id, m]) => (
                <div className="panel" key={id}>
                  <h3>
                    {replay.replay.config.players.find((p) => p.id === id)
                      ?.name ?? id}
                  </h3>
                  <p>
                    {t("damage")}: {m.damage}
                  </p>
                  <p>
                    {t("np")}: {m.npUsage}
                  </p>
                  <p>
                    {t("IDENTITY_DISCOVERED")}: {m.identityDiscoveries}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
      <footer>
        <span>
          {t("title")} <span className="muted">/ {__APP_VERSION__}</span>
        </span>
        <span>{t("principle")}</span>
      </footer>
    </>
  );
}
function Lobby({
  t,
  providers,
  busy,
  onCreate,
}: {
  t: T;
  providers: Provider[];
  busy: boolean;
  onCreate: (c: MatchConfig) => void;
}) {
  const [seed, setSeed] = useState(2026),
    [count, setCount] = useState(3),
    [locations, setLocations] = useState(4),
    [players, setPlayers] = useState<MatchConfig["players"]>(
      Array.from({ length: 8 }, (_, i) => ({
        id: `master-${i + 1}`,
        name: i === 0 ? "Master" : "Master " + (i + 1),
        kind: i === 0 ? "HUMAN" : "BOT",
        profile: profiles[i % profiles.length],
      })),
    );
  const update = (i: number, patch: Partial<MatchConfig["players"][number]>) =>
    setPlayers((old) =>
      old.map((p, index) => (index === i ? { ...p, ...patch } : p)),
    );
  return (
    <section className="page">
      <p className="eyebrow">{t("eyebrow")}</p>
      <h2>{t("lobby")}</h2>
      <p className="muted">{t("lobbyDescription")}</p>
      <div className="setup-grid">
        <div className="panel">
          <label className="field">
            {t("seed")}
            <input
              type="number"
              min="0"
              max="4294967295"
              value={seed}
              onChange={(e) => setSeed(Number(e.target.value))}
            />
          </label>
          <label className="field">
            {t("players")}
            <input
              type="number"
              min="2"
              max="8"
              value={count}
              onChange={(e) =>
                setCount(Math.min(8, Math.max(2, Number(e.target.value))))
              }
            />
          </label>
          <label className="field">
            {t("locations")}
            <input
              type="number"
              min="2"
              max="8"
              value={locations}
              onChange={(e) => setLocations(Number(e.target.value))}
            />
          </label>
          <Sigil small />
        </div>
        <div>
          {players.slice(0, count).map((p, i) => (
            <div className="panel lobby-player" key={p.id}>
              <span className="number">0{i + 1}</span>
              <label className="field">
                <span>{t("name")}</span>
                <input
                  aria-label={`${t("name")} ${i + 1}`}
                  maxLength={40}
                  value={p.name}
                  onChange={(e) => update(i, { name: e.target.value })}
                />
              </label>
              <Select
                label="players"
                value={p.kind.toLowerCase()}
                options={[
                  ...(i === 0 ? ["human"] : []),
                  "bot",
                  ...(AGENTS_ENABLED ? ["agent"] : []),
                ]}
                t={t}
                onChange={(v) =>
                  update(i, {
                    kind: v.toUpperCase() as "HUMAN" | "BOT" | "AGENT",
                  })
                }
              />
              {p.kind !== "HUMAN" && (
                <Select
                  label="profile"
                  value={p.profile}
                  options={profiles}
                  t={t}
                  onChange={(v) =>
                    update(i, { profile: v as typeof p.profile })
                  }
                />
              )}
              {p.kind === "AGENT" && (
                <label className="field">
                  <span>{t("provider")}</span>
                  <select
                    value={p.providerId ?? ""}
                    onChange={(e) =>
                      update(i, { providerId: e.target.value || undefined })
                    }
                  >
                    <option value="">{t("providerMissing")}</option>
                    {providers.map((p) => (
                      <option value={p.id} key={p.id}>
                        {p.id} · {p.model}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
          ))}
        </div>
      </div>
      <div className="action-footer">
        <span className="muted">{t("offline")}</span>
        <button
          className="primary"
          disabled={busy}
          onClick={() =>
            onCreate({
              seed,
              players: players.slice(0, count),
              locationCount: locations,
            })
          }
        >
          {t("play")} ↗
        </button>
      </div>
    </section>
  );
}
function ProviderForm({
  t,
  busy,
  onSave,
}: {
  t: T;
  busy: boolean;
  onSave: (body: unknown) => void;
}) {
  const [id, setId] = useState("local"),
    [kind, setKind] = useState("ollama"),
    [baseUrl, setBaseUrl] = useState("http://localhost:11434"),
    [model, setModel] = useState(""),
    [key, setKey] = useState("");
  const [limits, setLimits] = useState({
    maxRequests: 200,
    maxTokens: 200000,
    maxOutputTokens: 1000,
    timeoutMs: 20000,
    retries: 1,
    maxToolCalls: 3,
  });
  const [maxCost, setMaxCost] = useState(""),
    [inputPrice, setInputPrice] = useState(""),
    [outputPrice, setOutputPrice] = useState("");
  return (
    <form
      className="panel provider-form"
      onSubmit={(e) => {
        e.preventDefault();
        onSave({
          id,
          kind,
          baseUrl,
          model,
          apiKey: key || undefined,
          limits: { ...limits, maxCost: maxCost ? Number(maxCost) : undefined },
          inputPricePerMillion: inputPrice ? Number(inputPrice) : undefined,
          outputPricePerMillion: outputPrice ? Number(outputPrice) : undefined,
        });
        setKey("");
      }}
    >
      <label className="field">
        {t("providerId")}
        <input
          required
          pattern="[a-zA-Z0-9_-]{1,64}"
          value={id}
          onChange={(e) => setId(e.target.value)}
        />
        <small className="field-help">{t("help.providerId")}</small>
      </label>
      <Select
        t={t}
        label="provider"
        help={t("help.provider")}
        value={kind}
        options={["ollama", "ollama-cloud", "openai-compatible"]}
        onChange={(v) => {
          setKind(v);
          setBaseUrl(
            v === "ollama"
              ? "http://localhost:11434"
              : v === "ollama-cloud"
                ? "https://ollama.com"
                : "http://localhost:1234/v1",
          );
        }}
      />
      <label className="field">
        {t("baseUrl")}
        <input
          required
          type="url"
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
        />
        <small className="field-help">{t("help.baseUrl")}</small>
      </label>
      <label className="field">
        {t("model")}
        <input
          required
          value={model}
          placeholder={t("modelPlaceholder")}
          onChange={(e) => setModel(e.target.value)}
        />
        <small className="field-help">{t("help.model")}</small>
      </label>
      <label className="field">
        {t("apiKey")}
        <input
          type="password"
          autoComplete="off"
          value={key}
          onChange={(e) => setKey(e.target.value)}
        />
        <small className="field-help">{t("help.apiKey")}</small>
      </label>
      <details className="provider-limits">
        <summary>{t("limits")}</summary>
        {Object.entries(limits).map(([name, value]) => (
          <label className="field" key={name}>
            {t(name)}
            <input
              type="number"
              min="0"
              value={value}
              onChange={(e) =>
                setLimits({ ...limits, [name]: Number(e.target.value) })
              }
            />
            <small className="field-help">{t(`help.${name}`)}</small>
          </label>
        ))}
        <label className="field">
          {t("maxCost")}
          <input
            type="number"
            min="0"
            step="0.01"
            value={maxCost}
            onChange={(e) => setMaxCost(e.target.value)}
          />
          <small className="field-help">{t("help.maxCost")}</small>
        </label>
        <label className="field">
          {t("inputPrice")}
          <input
            type="number"
            min="0"
            step="0.01"
            value={inputPrice}
            onChange={(e) => setInputPrice(e.target.value)}
          />
          <small className="field-help">{t("help.inputPrice")}</small>
        </label>
        <label className="field">
          {t("outputPrice")}
          <input
            type="number"
            min="0"
            step="0.01"
            value={outputPrice}
            onChange={(e) => setOutputPrice(e.target.value)}
          />
          <small className="field-help">{t("help.outputPrice")}</small>
        </label>
      </details>
      <button type="submit" disabled={busy}>
        {t("connect")}
      </button>
    </form>
  );
}
function Ritual({
  initial,
  copied,
  t,
  busy,
  onSubmit,
}: {
  initial: SummoningDecision;
  copied: boolean;
  t: T;
  busy: boolean;
  onSubmit: (d: SummoningDecision) => void;
}) {
  const [decision, setDecision] = useState(initial);
  const options = {
    desiredTrait: traits,
    grailWish: wishes,
    alignment: alignments,
    catalyst: catalysts,
    classFocus: ["NONE", ...classes],
    manaOffering: offerings,
  };
  return (
    <section className="ritual-grid">
      <div className="ritual-art">
        <p className="eyebrow">{t("ritual")}</p>
        <Sigil />
        <p className="muted">{t("ritualDescription")}</p>
      </div>
      <div className="panel">
        <h2>{t("SUMMONING")}</h2>
        {copied && (
          <p className="hint" role="status">
            {t("simulator.applied")}
          </p>
        )}
        <div className="ritual-fields">
          {Object.entries(options).map(([key, list], i) => (
            <Select
              key={key}
              label={key}
              value={decision[key as keyof SummoningDecision]}
              options={list}
              t={(k) =>
                k === key ? `${String(i + 1).padStart(2, "0")} · ${t(k)}` : t(k)
              }
              onChange={(v) => setDecision({ ...decision, [key]: v })}
            />
          ))}
        </div>
        <p className="hint">{t("ritualOdds")}</p>
        <p className="hint gold">{t("manaWarning")}</p>
        <button
          className="primary full"
          disabled={busy}
          onClick={() => onSubmit(decision)}
        >
          {busy ? t("busy") : t("summon")} ◇
        </button>
      </div>
    </section>
  );
}
function Game({
  view,
  t,
  busy,
  human,
  onIntent,
  onReplay,
  decisionSlot,
}: {
  view: PlayerView;
  t: T;
  busy: boolean;
  human: boolean;
  onIntent: (i?: Intent) => void;
  onReplay: () => void;
  decisionSlot?: ReactNode;
}) {
  const p = view.self,
    s = p.servant!;
  const conclusionTitle = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (view.phase === "FINISHED") conclusionTitle.current?.focus();
  }, [view.phase]);
  return (
    <div className="game-grid">
      <aside className="servant-panel panel">
        <p className="eyebrow">{t("ownServant")}</p>
        <Portrait key={s.id} servant={s} />
        <span className="stars">{"★".repeat(s.rarity)}</span>
        <h2>{s.trueName}</h2>
        <p className="muted">{t(s.noblePhantasm.name)}</p>
        <Resource label={t("hp")} value={p.hp} max={s.maxHp} />
        <Resource label={t("mana")} value={p.mana} max={100} />
        <div className="np-meter">
          <span>
            {t("np")} · {p.np}/5
          </span>
          <div>
            {Array.from({ length: 5 }, (_, i) => (
              <i key={i} className={p.np > i ? "charged" : ""} />
            ))}
          </div>
        </div>
        <div className="stats">
          <span>
            B <b>{s.buster}</b>
          </span>
          <span>
            A <b>{s.arts}</b>
          </span>
          <span>
            Q <b>{s.quick}</b>
          </span>
        </div>
        <dl className="servant-details">
          <div>
            <dt>{t("manaEfficiency")}</dt>
            <dd>{s.manaEfficiency}</dd>
          </div>
          <div>
            <dt>{t("mystery")}</dt>
            <dd>{s.mystery}</dd>
          </div>
          <div>
            <dt>{t("np")}</dt>
            <dd>
              {t(s.noblePhantasm.type)} ×{s.noblePhantasm.power}
            </dd>
          </div>
        </dl>
        {p.location && (
          <p className="hint">
            {t("locked")}: {t(p.location)}
          </p>
        )}
      </aside>
      <div className="game-center">
        {decisionSlot ??
          (view.phase === "FINISHED" ? (
            <div className="panel conclusion">
              <Sigil small />
              <p className="eyebrow">{t("victory")}</p>
              <h2 ref={conclusionTitle} tabIndex={-1}>
                {view.winner
                  ? `${t("winner")}: ${view.winner === p.id ? p.name : view.enemies.find((e) => e.id === view.winner)?.name}`
                  : t("draw")}
              </h2>
              <button className="primary" onClick={onReplay}>
                {t("replay")}
              </button>
            </div>
          ) : !p.alive || !human ? (
            <div className="panel">
              <h2>{t(p.alive ? view.phase : "eliminated")}</h2>
              <p className="muted">{!p.alive ? t("spectating") : t("about")}</p>
              <button
                className="primary"
                disabled={busy}
                onClick={() => onIntent()}
              >
                {busy ? t("busy") : t("advance")}
              </button>
            </div>
          ) : (
            <DecisionPanel
              key={`${view.day}-${view.phase}`}
              view={view}
              t={t}
              busy={busy}
              onIntent={onIntent}
            />
          ))}
        {view.phase === "FINISHED" && (
          <section className="panel">
            <h2>{t("reveal.all")}</h2>
            <p className="muted">{t("reveal.finished")}</p>
            <ul className="revealed-roster">
              {[
                {
                  id: p.id,
                  name: p.name,
                  trueName: s.trueName,
                  class: s.class,
                  rarity: s.rarity,
                },
                ...view.enemies,
              ].map((entry) => (
                <li key={entry.id}>
                  <span className="muted">
                    {entry.name}
                    {entry.id === view.winner ? ` · ${t("winner")}` : ""}
                  </span>
                  <strong>{entry.trueName ?? t("unknown")}</strong>
                  <span>
                    {entry.class ? t(entry.class) : ""} ·{" "}
                    {"★".repeat(entry.rarity ?? 0)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
        <div className="panel">
          <p className="eyebrow">{t("journal")}</p>
          <Journal view={view} t={t} />
        </div>
      </div>
      <aside className="rivals">
        <p className="eyebrow">{t("rivals")}</p>
        {view.enemies.map((e) => (
          <div
            className={`panel enemy ${!e.alive ? "defeated" : ""}`}
            key={e.id}
          >
            <span className="enemy-icon">{e.alive ? "◇" : "×"}</span>
            <h3>{e.name}</h3>
            <p>{e.trueName ?? t("unknown")}</p>
            <p className="muted">
              {t(e.condition)}
              {e.location ? ` · ${t(e.location)}` : ""}
            </p>
            <Resource label={t("identity")} value={e.identity} max={100} />
          </div>
        ))}
      </aside>
    </div>
  );
}
function Resource({
  label,
  value,
  max,
}: {
  label: string;
  value: number;
  max: number;
}) {
  return (
    <div className="resource">
      <div>
        <span>{label}</span>
        <b>
          {Math.round(value)} <small>/ {max}</small>
        </b>
      </div>
      <progress aria-label={label} value={value} max={max} />
    </div>
  );
}
function DecisionPanel({
  view,
  t,
  busy,
  onIntent,
}: {
  view: PlayerView;
  t: T;
  busy: boolean;
  onIntent: (i?: Intent) => void;
}) {
  const [destination, setDestination] = useState(view.locations[0]),
    [action, setAction] = useState<DayAction["type"]>("USE_LEYLINE"),
    [target, setTarget] = useState(view.enemies.find((e) => e.alive)?.id ?? ""),
    [amount, setAmount] = useState(Math.min(view.self.mana, 15)),
    [useNP, setNP] = useState(false),
    [attacks, setAttacks] = useState<Record<string, AttackType>>(
      Object.fromEntries(view.combatTargets.map((id) => [id, "BUSTER"])),
    );
  let body: ReactNode;
  let intent: Intent | undefined;
  if (view.phase === "LOCATION") {
    intent = { type: "LOCATION", location: destination };
    body = (
      <>
        <h2>{t("locationTitle")}</h2>
        <p className="muted">{t("locationDescription")}</p>
        <div className="locations">
          {view.locations.map((id, i) => (
            <button
              key={id}
              className={`location-card location-${i % 4} ${destination === id ? "selected" : ""}`}
              onClick={() => setDestination(id)}
            >
              <span className="location-number">0{i + 1}</span>
              <svg viewBox="0 0 150 80" aria-hidden="true">
                <path
                  d={
                    i % 2
                      ? "M20 70H130M35 70V35H65V70M85 70V20H110V70M78 20H117L98 4Z"
                      : "M10 70H140M25 70V45H55V70M65 70V25H95V70M105 70V50H130V70M58 25H102L80 8Z"
                  }
                />
              </svg>
              <strong>{t(id)}</strong>
              <span>{destination === id ? "◆" : "◇"}</span>
            </button>
          ))}
        </div>
      </>
    );
  } else if (view.phase === "DAY_ACTION") {
    const dayAction: DayAction =
      action === "TRANSFER_MANA"
        ? { type: action, amount }
        : action === "INVESTIGATE_MASTER" || action === "INVESTIGATE_SERVANT"
          ? { type: action, target }
          : { type: action };
    intent = { type: "DAY_ACTION", action: dayAction };
    body = (
      <>
        <h2>{t("dayTitle")}</h2>
        <p className="muted">{t("dayDescription")}</p>
        <div className="day-actions">
          {(
            [
              "INVESTIGATE_SERVANT",
              "INVESTIGATE_MASTER",
              "TRANSFER_MANA",
              "PREPARE_TERRAIN",
              "HIDE",
              "USE_LEYLINE",
            ] as const
          ).map((a) => (
            <button
              disabled={a === "TRANSFER_MANA" && view.self.mana === 0}
              className={action === a ? "selected" : ""}
              key={a}
              onClick={() => setAction(a)}
            >
              <strong>{t(a)}</strong>
              <small>{t(`help.${a}`)}</small>
            </button>
          ))}
        </div>
        {action.startsWith("INVESTIGATE") && (
          <label className="field">
            {t("target")}
            <select value={target} onChange={(e) => setTarget(e.target.value)}>
              {view.enemies
                .filter((e) => e.alive)
                .map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
            </select>
          </label>
        )}
        {action === "TRANSFER_MANA" && (
          <label className="field">
            {t("amount")}
            <input
              type="number"
              min="1"
              max={view.self.mana}
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
            />
          </label>
        )}
      </>
    );
  } else {
    intent = view.combatTargets.length
      ? {
          type: "COMBAT",
          decision: {
            useNP,
            attacks: useNP
              ? []
              : view.combatTargets.map((target) => ({
                  target,
                  type: attacks[target],
                })),
          },
        }
      : undefined;
    body = (
      <>
        <h2>{t("combatTitle")}</h2>
        <p className="muted">
          {t(view.combatTargets.length ? "combatDescription" : "noBattle")}
        </p>
        {view.combatTargets.map((target) => (
          <div className="combat-row" key={target}>
            <strong>{view.enemies.find((e) => e.id === target)?.name}</strong>
            <div>
              {(["BUSTER", "ARTS", "QUICK"] as const).map((type) => (
                <button
                  disabled={useNP}
                  key={type}
                  className={`${type.toLowerCase()} ${attacks[target] === type ? "selected" : ""}`}
                  onClick={() => setAttacks({ ...attacks, [target]: type })}
                >
                  {t(type)}
                </button>
              ))}
            </div>
          </div>
        ))}
        {view.combatTargets.length > 0 && (
          <label className="np-choice">
            <input
              type="checkbox"
              disabled={view.self.np < 5}
              checked={useNP}
              onChange={(e) => setNP(e.target.checked)}
            />
            <span>
              {t("npUse")} <small>{t("npHelp")}</small>
            </span>
          </label>
        )}
      </>
    );
  }
  return (
    <section className="panel decision-panel">
      {body}
      <button
        className="primary full"
        disabled={busy || view.ready}
        onClick={() => onIntent(intent)}
      >
        {busy ? t("busy") : t(intent ? "confirm" : "advance")} ↗
      </button>
    </section>
  );
}
function Journal({ view, t }: { view: PlayerView; t: T }) {
  const name = (id?: string) =>
    id === view.self.id
      ? view.self.name
      : (view.enemies.find((p) => p.id === id)?.name ?? "");
  return (
    <div className="journal">
      {!view.events.length ? (
        <p>{t("noEvents")}</p>
      ) : (
        view.events
          .slice(-30)
          .reverse()
          .map((e) => (
            <div className="event" key={e.sequence}>
              <span className="event-day">
                {String(e.day).padStart(2, "0")}
              </span>
              <div>
                <strong>{t(e.type)}</strong>
                <p>
                  {name(e.actor)}
                  {e.target ? ` → ${name(e.target)}` : ""}
                  {e.detail
                    ? ` · ${e.detail.split("|").map(t).join(" / ")}`
                    : ""}
                  {e.value !== undefined
                    ? ` · ${Math.round(e.value * 10) / 10}`
                    : ""}
                </p>
              </div>
            </div>
          ))
      )}
    </div>
  );
}
