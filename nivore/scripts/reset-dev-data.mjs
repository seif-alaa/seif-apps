// Deletes the development store so it is re-seeded on next request. Development only.
import { rmSync } from "node:fs";
import path from "node:path";
const dir = path.resolve(process.env.NIVORE_DATA_DIR ?? ".data");
rmSync(dir, { recursive: true, force: true });
console.log(`Removed ${dir}. Sample data will be re-created on the next request.`);
