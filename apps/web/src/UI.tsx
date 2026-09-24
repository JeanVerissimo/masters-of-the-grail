import { useState } from "react";
import type { ServantDefinition } from "@grail/shared";
type T = (key: string) => string;
export function Select({
  label,
  value,
  options,
  onChange,
  t,
  help,
}: {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (v: string) => void;
  t: T;
  help?: string;
}) {
  return (
    <label className="field">
      <span>{t(label)}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o} value={o}>
            {t(label === "catalyst" && o === "NONE" ? "catalog.noCatalyst" : o)}
          </option>
        ))}
      </select>
      {help && <small className="field-help">{help}</small>}
    </label>
  );
}
export function Sigil({ small = false }: { small?: boolean }) {
  return (
    <svg
      className={small ? "sigil small" : "sigil"}
      viewBox="0 0 300 300"
      aria-hidden="true"
    >
      <circle cx="150" cy="150" r="126" />
      <circle cx="150" cy="150" r="113" />
      <circle cx="150" cy="150" r="82" />
      <path d="M150 23 260 214 40 214Z M150 277 40 86 260 86Z" />
      <path
        className="cup"
        d="M112 112H188L177 155 150 177 123 155Z M150 177V209 M124 210H176 M112 121H96L104 150 128 159 M188 121H204L196 150 172 159"
      />
      <circle cx="150" cy="23" r="4" />
      <circle cx="40" cy="214" r="4" />
      <circle cx="260" cy="214" r="4" />
    </svg>
  );
}
export function Portrait({ servant }: { servant: ServantDefinition }) {
  const [failed, setFailed] = useState(
    () => !__PORTRAITS__.includes(servant.id),
  );
  return (
    <div className={`portrait rarity-${servant.rarity}`}>
      {!failed ? (
        <img
          src={`${import.meta.env.BASE_URL}servants/${servant.id}.webp`}
          alt={servant.trueName}
          onError={() => setFailed(true)}
        />
      ) : (
        <>
          <Sigil />
          <span className="portrait-initial">
            {servant.trueName
              .split(" ")
              .map((s) => s[0])
              .slice(0, 2)
              .join("")}
          </span>
        </>
      )}
      <span className="portrait-class">{servant.class}</span>
    </div>
  );
}
