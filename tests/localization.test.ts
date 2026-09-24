import { it, expect } from "vitest";
import { translate, untranslatedKeys } from "@grail/localization";
import { servants } from "../data/servants/index.js";
import { descriptions } from "../data/servants/descriptions.js";
import { descriptionsEn } from "../data/servants/descriptions.en.js";

it("translates every interface text to English", () => {
  expect(untranslatedKeys()).toEqual([]);
});

it("has English descriptions and NP names for every Servant", () => {
  for (const servant of servants) {
    expect(descriptionsEn[servant.id], servant.id).toBeTruthy();
    expect(descriptions[servant.id], servant.id).toBeTruthy();
    // Nomes de NP em português têm tradução; nomes próprios seguem iguais.
    const name = servant.noblePhantasm.name;
    if (/[ãõçáéíóúâêôà]| d[aeo]s? /i.test(name))
      expect(translate("en-US", name), name).not.toBe(name);
  }
});
