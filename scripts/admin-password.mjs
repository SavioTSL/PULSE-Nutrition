import { passwordHash } from "../server/security.js";
if (!process.stdin.isTTY) {
  console.error(
    "Execute em um terminal interativo; a senha não deve ser passada por argumentos.",
  );
  process.exit(1);
}
process.stdout.write("Nova senha administrativa (mínimo 12 caracteres): ");
process.stdin.setRawMode(true);
process.stdin.resume();
let password = "";
process.stdin.on("data", (chunk) => {
  for (const char of chunk.toString()) {
    if (char === "\u0003") process.exit(130);
    if (char === "\r" || char === "\n") {
      process.stdin.setRawMode(false);
      process.stdout.write("\n");
      if (password.length < 12) {
        console.error("Use ao menos 12 caracteres.");
        process.exit(1);
      }
      console.log(
        "Defina ADMIN_PASSWORD_HASH nas variáveis seguras da hospedagem:",
      );
      console.log(passwordHash(password));
      process.exit(0);
    }
    if (char === "\u007f") password = password.slice(0, -1);
    else if (password.length < 128) password += char;
  }
});
