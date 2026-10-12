import { getDatabase, initializeDatabase } from "../server/db.js";
const db = getDatabase();
if (!db)
  throw new Error(
    "Configure DATABASE_URL no ambiente seguro antes de executar.",
  );
try {
  await initializeDatabase(db);
  console.log(
    "Banco inicializado. Produtos demonstrativos têm estoque zero e não podem receber cobranças.",
  );
} finally {
  await db.close();
}
