import { useEffect, useRef, useState } from "react";
import {
  traits,
  wishes,
  alignments,
  catalysts,
  classes,
  offerings,
  type SummoningDecision,
} from "@grail/shared";
import type {
  CatalogEntry,
  SummoningChance,
  SummoningRecipe,
} from "../../../packages/shared/src/catalog.js";
import { api } from "./api.js";
import { Portrait, Select } from "./UI.js";
type T = (key: string) => string;
const ritualOptions = {
  desiredTrait: traits,
  grailWish: wishes,
  alignment: alignments,
  catalyst: catalysts,
  classFocus: ["NONE", ...classes],
  manaOffering: offerings,
};
export const defaultSimulation: SummoningDecision = {
  desiredTrait: "LOYALTY",
  grailWish: "PROTECTION",
  alignment: "LAWFUL_GOOD",
  catalyst: "ROYAL_RELIC",
  classFocus: "SABER",
  manaOffering: "MEDIUM",
};
export const percent = (n: number) =>
  new Intl.NumberFormat(document.documentElement.lang, {
    style: "percent",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
function useCatalog() {
  const [entries, setEntries] = useState<CatalogEntry[]>([]),
    [error, setError] = useState(false),
    [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setError(false);
    void api<CatalogEntry[]>("/servants")
      .then((v) => {
        if (active) setEntries(v);
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, [attempt]);
  return { entries, error, retry: () => setAttempt((v) => v + 1) };
}
export function Throne({
  t,
  onSimulate,
}: {
  t: T;
  onSimulate: (d: SummoningDecision) => void;
}) {
  const { entries, error, retry } = useCatalog();
  const [query, setQuery] = useState(""),
    [servantClass, setClass] = useState("ALL"),
    [rarity, setRarity] = useState("ALL"),
    [selected, setSelected] = useState("artoria");
  const [recipes, setRecipes] = useState<SummoningRecipe[] | null>(null),
    [recipeError, setRecipeError] = useState(false),
    [attempt, setAttempt] = useState(0);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    let active = true;
    setRecipes(null);
    setRecipeError(false);
    void api<SummoningRecipe[]>(`/servants/${selected}/rituals`)
      .then((value) => {
        if (active) setRecipes(value);
      })
      .catch(() => {
        if (active) setRecipeError(true);
      });
    return () => {
      active = false;
    };
  }, [selected, attempt]);
  const entry = entries.find((e) => e.servant.id === selected);
  const normalize = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  const filtered = entries.filter(
    ({ servant: s }) =>
      (servantClass === "ALL" || s.class === servantClass) &&
      (rarity === "ALL" || s.rarity === Number(rarity)) &&
      normalize(s.trueName).includes(normalize(query)),
  );
  return (
    <section className="page throne-page">
      <p className="eyebrow">{t("catalog.eyebrow")}</p>
      <h1>{t("catalog.title")}</h1>
      <p className="muted">{t("catalog.intro")}</p>
      <div className="catalog-filters panel">
        <label className="field">
          <span>{t("catalog.search")}</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("catalog.searchPlaceholder")}
          />
        </label>
        <Select
          label="classes"
          value={servantClass}
          options={["ALL", ...classes]}
          onChange={setClass}
          t={t}
        />
        <Select
          label="catalog.rarity"
          value={rarity}
          options={["ALL", "1", "2", "3", "4", "5"]}
          onChange={setRarity}
          t={t}
        />
        <p className="muted" role="status">
          {filtered.length} / {entries.length} {t("roster")}
        </p>
      </div>
      {error ? (
        <p role="alert">
          {t("REQUEST_FAILED")}{" "}
          <button onClick={retry}>{t("catalog.retry")}</button>
        </p>
      ) : !entries.length ? (
        <p role="status">{t("loading")}</p>
      ) : (
        <div className="catalog-layout">
          <div className="catalog-grid" aria-label={t("catalog.title")}>
            {!filtered.length && <p>{t("catalog.empty")}</p>}
            {filtered.map(({ servant: s }) => (
              <button
                key={s.id}
                className={`catalog-card ${s.id === selected ? "selected" : ""}`}
                aria-pressed={s.id === selected}
                onClick={() => {
                  setSelected(s.id);
                  heading.current?.focus();
                }}
              >
                <span className="catalog-monogram" aria-hidden="true">
                  {s.trueName
                    .split(" ")
                    .map((n) => n[0])
                    .slice(0, 2)
                    .join("")}
                </span>
                <span className="stars">{"★".repeat(s.rarity)}</span>
                <strong>{s.trueName}</strong>
                <small>{t(s.class)}</small>
              </button>
            ))}
          </div>
          {entry && (
            <article className="panel servant-dossier">
              <div className="dossier-hero">
                <Portrait key={entry.servant.id} servant={entry.servant} />
                <div>
                  <p className="eyebrow">
                    {t(entry.servant.class)} ·{" "}
                    {"★".repeat(entry.servant.rarity)}
                  </p>
                  <h2 ref={heading} tabIndex={-1}>
                    {entry.servant.trueName}
                  </h2>
                  <p>
                    {document.documentElement.lang === "en-US"
                      ? (entry.descriptionEn ?? entry.description)
                      : entry.description}
                  </p>
                </div>
              </div>
              <dl className="dossier-stats">
                {(
                  [
                    ["hp", entry.servant.maxHp],
                    ["BUSTER", entry.servant.buster],
                    ["ARTS", entry.servant.arts],
                    ["QUICK", entry.servant.quick],
                    ["manaEfficiency", entry.servant.manaEfficiency],
                    ["mystery", entry.servant.mystery],
                  ] as const
                ).map(([key, value]) => (
                  <div key={key}>
                    <dt>{t(key)}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
              <div className="dossier-np">
                <p className="eyebrow">{t("np")}</p>
                <h3>{t(entry.servant.noblePhantasm.name)}</h3>
                <p>
                  {t(entry.servant.noblePhantasm.type)} · ×
                  {entry.servant.noblePhantasm.power}
                </p>
              </div>
              <p className="muted">
                {t("catalog.alignment")}: {t(entry.servant.summoning.alignment)}
              </p>
              <p className="muted">
                {t("catalog.affinities")}:{" "}
                {entry.servant.summoning.desiredTraits.map(t).join(" · ")}
              </p>
              <h3>{t("catalog.best")}</h3>
              <p className="field-help">{t("catalog.probabilityHelp")}</p>
              {recipeError ? (
                <p role="alert">
                  {t("REQUEST_FAILED")}{" "}
                  <button onClick={() => setAttempt((v) => v + 1)}>
                    {t("catalog.retry")}
                  </button>
                </p>
              ) : !recipes ? (
                <p role="status">{t("catalog.calculating")}</p>
              ) : (
                recipes.map((recipe, index) => (
                  <div className="recipe" key={index}>
                    <div className="recipe-heading">
                      <span>0{index + 1}</span>
                      <strong>{percent(recipe.probability)}</strong>
                    </div>
                    <dl>
                      {Object.entries(recipe.decision).map(([key, value]) => (
                        <div key={key}>
                          <dt>{t(key)}</dt>
                          <dd>
                            {t(
                              key === "catalyst" && value === "NONE"
                                ? "catalog.noCatalyst"
                                : value,
                            )}
                          </dd>
                        </div>
                      ))}
                    </dl>
                    <button onClick={() => onSimulate(recipe.decision)}>
                      {t("catalog.tryRecipe")} ↗
                    </button>
                  </div>
                ))
              )}
              <p className="field-help">{t("catalog.provisional")}</p>
            </article>
          )}
        </div>
      )}
    </section>
  );
}
export function SummoningSimulator({
  t,
  initial = defaultSimulation,
  onInspect,
  onUse,
}: {
  t: T;
  initial?: SummoningDecision;
  onInspect?: () => void;
  onUse: (decision: SummoningDecision) => void;
}) {
  const { entries, error, retry } = useCatalog();
  const [decision, setDecision] = useState(initial),
    [result, setResult] = useState<{
      top: SummoningChance[];
      remainingProbability: number;
    } | null>(null),
    [failed, setFailed] = useState(false),
    [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setResult(null);
    setFailed(false);
    void api<{ top: SummoningChance[]; remainingProbability: number }>(
      "/summoning/simulate",
      "POST",
      decision,
    )
      .then((v) => {
        if (active) setResult(v);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, [decision, attempt]);
  return (
    <section className="page">
      <p className="eyebrow">{t("simulator.eyebrow")}</p>
      <h1>{t("simulator.title")}</h1>
      <p className="muted">{t("simulator.intro")}</p>
      <div className="simulator-layout">
        <div className="panel simulator-choices">
          <h2>{t("ritual")}</h2>
          {Object.entries(ritualOptions).map(([key, options]) => (
            <Select
              key={key}
              label={key}
              value={decision[key as keyof SummoningDecision]}
              options={options}
              onChange={(v) => setDecision((d) => ({ ...d, [key]: v }))}
              t={t}
            />
          ))}
          <p className="hint">{t("simulator.noCost")}</p>
          <button className="primary full" onClick={() => onUse(decision)}>
            {t("simulator.useAnswers")} ↗
          </button>
          {onInspect && (
            <button onClick={onInspect}>{t("catalog.title")}</button>
          )}
        </div>
        <div
          className="panel simulator-results"
          aria-live="polite"
          aria-busy={!result && !failed}
        >
          <h2>{t("simulator.topFive")}</h2>
          <p className="field-help">{t("catalog.probabilityHelp")}</p>
          {error || failed ? (
            <p role="alert">
              {t("REQUEST_FAILED")}{" "}
              <button
                onClick={() => {
                  retry();
                  setAttempt((v) => v + 1);
                }}
              >
                {t("catalog.retry")}
              </button>
            </p>
          ) : !result || !entries.length ? (
            <p>{t("loading")}</p>
          ) : (
            <>
              {result.top.map((row, index) => {
                const s = entries.find(
                  (e) => e.servant.id === row.servantId,
                )!.servant;
                return (
                  <div className="chance-row" key={s.id}>
                    <span className="chance-rank">0{index + 1}</span>
                    <div>
                      <h3>{s.trueName}</h3>
                      <span className="muted">
                        {t(s.class)} · {"★".repeat(s.rarity)}
                      </span>
                      <progress
                        aria-label={`${t("simulator.chance")} ${s.trueName}`}
                        max={1}
                        value={row.probability}
                      />
                    </div>
                    <strong>{percent(row.probability)}</strong>
                  </div>
                );
              })}
              <p className="simulator-remaining">
                {t("simulator.remaining")}{" "}
                <strong>{percent(result.remainingProbability)}</strong>
              </p>
              <p className="hint">{t("simulator.tieHelp")}</p>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
