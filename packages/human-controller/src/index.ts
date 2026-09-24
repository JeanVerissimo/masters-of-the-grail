import {
  intentSchema,
  type PlayerController,
  type PlayerView,
  type Intent,
} from "@grail/shared";
export class HumanController implements PlayerController {
  #input: Intent | null = null;
  submit(input: unknown) {
    this.#input = intentSchema.parse(input);
  }
  async decide(_view: PlayerView) {
    if (!this.#input) throw new Error("WAITING_FOR_HUMAN");
    const intent = this.#input;
    this.#input = null;
    return intent;
  }
}
