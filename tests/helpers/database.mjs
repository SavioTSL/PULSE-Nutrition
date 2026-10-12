import { PGlite } from "@electric-sql/pglite";
export async function testDatabase() {
  const engine = await PGlite.create();
  let queue = Promise.resolve();
  const run = (fn) => {
    const value = queue.then(fn);
    queue = value.catch(() => {});
    return value;
  };
  return {
    query: (sql, args) => run(() => engine.query(sql, args)),
    transaction: (fn) =>
      run(async () => {
        await engine.query("BEGIN");
        try {
          const result = await fn({
            query: (sql, args) => engine.query(sql, args),
          });
          await engine.query("COMMIT");
          return result;
        } catch (error) {
          await engine.query("ROLLBACK");
          throw error;
        }
      }),
    close: () => engine.close(),
  };
}
