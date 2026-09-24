import { useEffect, useRef } from "react";
import type { PlayerView } from "@grail/shared";
export function CombatResolution({
  view,
  busy,
  onContinue,
  t,
}: {
  view: PlayerView;
  busy: boolean;
  onContinue: () => void;
  t: (key: string) => string;
}) {
  const report = view.lastCombat!;
  const title = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    title.current?.focus();
  }, [report.day]);
  const name = (id: string) =>
    id === view.self.id
      ? view.self.name
      : (view.enemies.find((e) => e.id === id)?.name ?? id);
  const revealedName = (id: string) => {
    const servant =
      id === view.self.id
        ? view.self.servant?.trueName
        : view.enemies.find((e) => e.id === id)?.trueName;
    return servant ? `${name(id)} · ${servant}` : name(id);
  };
  const outgoing = report.hits
      .filter((h) => h.actor === view.self.id)
      .reduce((sum, h) => sum + h.value, 0),
    incoming = report.hits
      .filter((h) => h.target === view.self.id)
      .reduce((sum, h) => sum + h.value, 0);
  return (
    <section className="page combat-resolution">
      <p className="eyebrow">
        {t("day")} {report.day} · {t(report.location)}
      </p>
      <h1 tabIndex={-1} ref={title}>
        {t("combat.result")}
      </h1>
      <p className="muted">{t("combat.simultaneous")}</p>
      <div className="combat-totals">
        {[
          ["combat.dealt", outgoing],
          ["combat.received", incoming],
          [
            "hp",
            `${report.self.hpBefore} → ${report.self.hpAfter} / ${report.self.maxHp}`,
          ],
          ["np", `${report.self.npBefore} → ${report.self.npAfter} / 5`],
        ].map(([key, value]) => (
          <div className="panel" key={key}>
            <span>{t(String(key))}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
      <div className="combat-hits">
        {report.hits.map((hit, i) => (
          <article
            className={`panel combat-hit ${hit.actor === view.self.id ? "outgoing" : "incoming"}`}
            key={i}
          >
            <div className="combat-hit-heading">
              <h3>
                {name(hit.actor)} → {name(hit.target)}
              </h3>
              <strong>−{hit.value} HP</strong>
            </div>
            <p>
              {t(hit.attackType)} × {t(hit.opponentType)} ·{" "}
              {t(
                hit.matchup > 1
                  ? "combat.advantage"
                  : hit.matchup < 1
                    ? "combat.disadvantage"
                    : "combat.tie",
              )}
            </p>
            <div className="combat-modifiers">
              <span>
                {t("combat.matchup")} ×{hit.matchup}
              </span>
              <span>
                {t("PREPARE_TERRAIN")} ×{hit.terrainMultiplier}
              </span>
              <span>
                {t("identity")} ×{hit.identityMultiplier}
              </span>
              <span>
                {t("np")}{" "}
                {hit.useNP ? `×${hit.npMultiplier}` : t("combat.notUsed")}
              </span>
            </div>
          </article>
        ))}
      </div>
      <div className="panel">
        <h2>{t("combat.after")}</h2>
        <p>
          {t("combat.ownStatus")}:{" "}
          {t(view.self.alive ? "combat.survived" : "eliminated")}
        </p>
        {report.opponents.map((enemy) => (
          <p key={enemy.id}>
            <strong>{enemy.name}</strong> · {enemy.trueName ?? t("unknown")} ·{" "}
            {t(enemy.condition)}
          </p>
        ))}
        <p className="field-help">{t("combat.enemyHealth")}</p>
        <p>
          {t("combat.npUsers")}:{" "}
          {report.npUsers.length
            ? report.npUsers.map(name).join(", ")
            : t("combat.none")}
        </p>
        <p>
          {t("combat.eliminations")}:{" "}
          {report.eliminated.length
            ? report.eliminated.map(revealedName).join(", ")
            : t("combat.none")}
        </p>
        {report.finished && (
          <p className="gold">
            {report.winner
              ? `${t("winner")}: ${name(report.winner)}`
              : t("draw")}
          </p>
        )}
      </div>
      <button className="primary full" disabled={busy} onClick={onContinue}>
        {t("continue")} ·{" "}
        {t(view.phase === "FINISHED" ? "combat.toResults" : "combat.toDay")}
      </button>
    </section>
  );
}
