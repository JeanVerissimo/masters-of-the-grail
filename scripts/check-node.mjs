/* global process, console */
// Falha cedo, com instrução clara, quando o Node é antigo demais.
// Sem isso, o erro aparece depois como ERR_REQUIRE_ESM ou avisos do Vite.
const [major, minor] = process.versions.node.split(".").map(Number);
if (major < 22 || (major === 22 && minor < 13)) {
  console.error(
    [
      "",
      `Holy Grail War precisa do Node.js 22.13 ou superior (recomendado: 24 LTS). Versão atual: ${process.version}.`,
      `Holy Grail War requires Node.js 22.13 or newer (recommended: 24 LTS). Current version: ${process.version}.`,
      "",
      "  https://nodejs.org/",
      "  Windows: winget install OpenJS.NodeJS.LTS",
      "  nvm:     nvm install 24  (depois/then: nvm use 24)",
      "",
    ].join("\n"),
  );
  process.exit(1);
}
