import { leesLessen } from "./lessen-regels";

/**
 * Check the lesson files against the schema and the writing guide:
 *
 *   npm run check:lessen --workspace=taal            # all of them
 *   npm run check:lessen --workspace=taal -- fase-3  # only files whose path contains this
 */
const filter = process.argv[2];
const gelezen = leesLessen().filter((g) => !filter || g.file.replace(/\\/g, "/").includes(filter));
let fout = 0;
for (const g of gelezen) {
  if (g.fouten.length === 0) continue;
  fout++;
  console.log(`✖ ${g.file}`);
  for (const f of g.fouten) console.log(`    ${f}`);
}
console.log(`${gelezen.length} lessons, ${fout} with problems`);
process.exit(fout ? 1 : 0);
