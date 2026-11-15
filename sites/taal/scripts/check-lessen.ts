import { controleerLinks, leesGrammatica, leesLessen } from "./lessen-regels";

/**
 * Check the lesson and grammar files against the schema and the writing guide,
 * and the lessons' links to the grammar:
 *
 *   npm run check:lessen --workspace=taal            # all of them
 *   npm run check:lessen --workspace=taal -- fase-3  # only files whose path contains this
 */
const filter = process.argv[2];
const pad = (f: string) => f.replace(/\\/g, "/");
const lessen = leesLessen();
const grammatica = leesGrammatica();
controleerLinks(lessen, grammatica);
const gelezen = [...lessen, ...grammatica.map((g) => ({ ...g, file: `grammatica/${pad(g.file)}` }))].filter((g) => !filter || pad(g.file).includes(filter));
let fout = 0;
for (const g of gelezen) {
  if (g.fouten.length === 0) continue;
  fout++;
  console.log(`✖ ${g.file}`);
  for (const f of g.fouten) console.log(`    ${f}`);
}
console.log(`${lessen.length} lessons and ${grammatica.length} grammar topics; checked ${gelezen.length}, ${fout} with problems`);
process.exit(fout ? 1 : 0);
