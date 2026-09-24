import type { PlayerView } from "@grail/shared";
export type {
  PlayerController,
  PlayerView,
  CombatView,
  SummoningView,
} from "@grail/shared";
export interface ViewSource {
  playerView(playerId: string): PlayerView;
}
export class PlayerViewService {
  constructor(private readonly source: ViewSource) {}
  forPlayer(playerId: string) {
    return this.source.playerView(playerId);
  }
}
