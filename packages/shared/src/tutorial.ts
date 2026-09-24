import type { Intent, PlayerView } from "./index.js";

export interface TutorialSnapshot {
  revision: number;
  lesson: string;
  chapter: number;
  chapters: number;
  review: boolean;
  complete: boolean;
  expectedIntent: Intent | null;
  view: PlayerView;
}
