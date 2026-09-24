/* global process, console, fetch, setTimeout */
// Segura o Vite até o servidor local responder. Sem isso, o navegador aberto
// cedo recebe ECONNREFUSED do proxy e a tela inicial mostra falha.
const port = process.env.PORT ?? 3001;
const url = `http://127.0.0.1:${port}/api/session`;
const deadline = Date.now() + 60000;
while (Date.now() < deadline) {
  try {
    await fetch(url);
    process.exit(0);
  } catch {
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
}
console.error(`Servidor não respondeu em ${url} após 60 s.`);
process.exit(1);
