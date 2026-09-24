import { useEffect, useRef, useState, type ReactNode } from "react";
import type { TutorialSnapshot } from "../../../packages/shared/src/tutorial.js";
import { attackTypes, type Intent } from "@grail/shared";

const ritualFields = [
  "desiredTrait",
  "grailWish",
  "alignment",
  "catalyst",
  "classFocus",
  "manaOffering",
];
const ritualValues = [
  "LOYALTY",
  "PROTECTION",
  "LAWFUL_GOOD",
  "ROYAL_RELIC",
  "SABER",
  "EXTREME",
];
const dayActions = [
  "INVESTIGATE_SERVANT",
  "INVESTIGATE_MASTER",
  "TRANSFER_MANA",
  "PREPARE_TERRAIN",
  "HIDE",
  "USE_LEYLINE",
];

export function Tutorial({
  snapshot,
  t,
  busy,
  onAdvance,
  onExit,
  onRestart,
  onPlay,
  renderBoard,
}: {
  snapshot: TutorialSnapshot;
  t: (key: string) => string;
  busy: boolean;
  onAdvance: (intent?: Intent) => void;
  onExit: () => void;
  onRestart: () => void;
  onPlay: () => void;
  renderBoard: (controls: ReactNode) => ReactNode;
}) {
  const {
    lesson,
    chapter,
    chapters,
    review,
    complete,
    expectedIntent: intent,
    view,
  } = snapshot;
  const title = useRef<HTMLHeadingElement>(null);
  const [wrongAttack, setWrongAttack] = useState(false);
  useEffect(() => {
    title.current?.focus();
    setWrongAttack(false);
  }, [snapshot.revision]);
  const coach = (
    <section className="panel tutorial-coach" aria-labelledby="lesson-title">
      <p className="eyebrow">
        {review ? t("tutorial.result") : t(`tutorial.chapter.${chapter}`)}
      </p>
      <h2 id="lesson-title" tabIndex={-1} ref={title}>
        {t(`tutorial.${lesson}.title`)}
      </h2>
      <p className="tutorial-explanation">
        {t(`tutorial.${lesson}.${review ? "result" : "body"}`)}
      </p>
      {view.self.servant && lesson === "summon" && review && (
        <p className="hint">{t("tutorial.health")}</p>
      )}
      {view.phase === "SUMMONING" && lesson !== "welcome" && (
        <div
          className="tutorial-ritual"
          aria-label={t("tutorial.ritualPreset")}
        >
          {ritualFields.map((field, index) => (
            <div
              key={field}
              className={
                lesson ===
                ["trait", "wish", "alignment", "catalyst", "class", "offering"][
                  index
                ]
                  ? "highlight"
                  : ""
              }
            >
              <span>{t(field)}</span>
              <strong>{t(ritualValues[index])}</strong>
            </div>
          ))}
        </div>
      )}
      {intent && !review && (
        <>
          <p className="hint">{t("tutorial.fixed")}</p>
          {intent.type === "LOCATION" ? (
            <div className="tutorial-options">
              {view.locations.map((location) => (
                <button
                  key={location}
                  className={location === intent.location ? "primary" : ""}
                  disabled={busy || location !== intent.location}
                  onClick={() => onAdvance(intent)}
                >
                  {t(location)}
                </button>
              ))}
            </div>
          ) : intent.type === "DAY_ACTION" ? (
            <div className="tutorial-options">
              {dayActions.map((action) => (
                <button
                  key={action}
                  className={action === intent.action.type ? "primary" : ""}
                  disabled={busy || action !== intent.action.type}
                  onClick={() => onAdvance(intent)}
                >
                  {t(action)}
                  {action === "TRANSFER_MANA" && intent.action.type === action
                    ? ` · ${intent.action.amount} ${t("mana")}`
                    : ""}
                </button>
              ))}
            </div>
          ) : intent.type === "COMBAT" && !intent.decision.useNP ? (
            <div className="tutorial-options">
              {attackTypes.map((type) => (
                <button
                  key={type}
                  className={type === "BUSTER" ? "primary" : ""}
                  disabled={busy}
                  onClick={() =>
                    type === "BUSTER" ? onAdvance(intent) : setWrongAttack(true)
                  }
                >
                  {t(type)}
                </button>
              ))}
            </div>
          ) : (
            <button
              className="primary"
              disabled={busy}
              onClick={() => onAdvance(intent)}
            >
              {intent.type === "SUMMON"
                ? t("summon")
                : `${t("tutorial.execute")} · ${t("np")}`}
            </button>
          )}
          {wrongAttack && (
            <p role="status" className="hint">
              {t("tutorial.wrongAttack")}
            </p>
          )}
        </>
      )}
      {!intent && !complete && (
        <button className="primary" disabled={busy} onClick={() => onAdvance()}>
          {t("tutorial.next")} →
        </button>
      )}
      {complete && (
        <>
          <div className="tutorial-checklist">
            {dayActions.map((action) => (
              <span key={action}>✓ {t(action)}</span>
            ))}
          </div>
          <button className="primary" disabled={busy} onClick={onPlay}>
            {t("tutorial.practice")} ↗
          </button>
        </>
      )}
    </section>
  );
  return (
    <section className="page tutorial-page">
      <div className="tutorial-toolbar">
        <div>
          <p className="eyebrow">{t("tutorial.label")}</p>
          <p className="muted">
            {t("tutorial.chapter")} {chapter} / {chapters}
            {view.day > 0 ? ` · ${t("day")} ${view.day}` : ""}
          </p>
        </div>
        <div className="tutorial-toolbar-actions">
          <button disabled={busy} onClick={onRestart}>
            {t("tutorial.restart")}
          </button>
          <button disabled={busy} onClick={onExit}>
            {t("tutorial.exit")}
          </button>
        </div>
      </div>
      <ol className="tutorial-chapters" aria-label={t("tutorial.chapter")}>
        {Array.from({ length: chapters }, (_, i) => (
          <li
            key={i}
            className={
              i + 1 === chapter ? "current" : i + 1 < chapter ? "done" : ""
            }
            aria-current={i + 1 === chapter ? "step" : undefined}
          >
            <span>{i + 1 < chapter || complete ? "✓" : `0${i + 1}`}</span>
            {t(`tutorial.chapter.${i + 1}`)}
          </li>
        ))}
      </ol>
      <p className="muted tutorial-mode">{t("tutorial.mode")}</p>
      {view.self.servant ? (
        renderBoard(coach)
      ) : (
        <div className="tutorial-intro">
          {coach}
          <aside className="panel tutorial-map">
            <p className="eyebrow">{t("tutorial")}</p>
            <div className="tutorial-emblem" aria-hidden="true">
              ✧
            </div>
            <ol>
              {["SUMMONING", "LOCATION", "DAY_ACTION", "COMBAT"].map(
                (phase, i) => (
                  <li key={phase}>
                    <span>0{i + 1}</span>
                    {t(phase)}
                  </li>
                ),
              )}
            </ol>
            <p className="muted">{t("tutorial.health")}</p>
          </aside>
        </div>
      )}
    </section>
  );
}
