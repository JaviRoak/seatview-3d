/**
 * Importa un recinto desde un archivo JSON.
 *   npm run venue:import -- ruta/al/recinto.json
 *   npm run venue:import -- ruta/al/recinto.json --dry-run   (solo valida)
 */
import 'dotenv/config';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { validateVenueDefinition, importVenue } from '../src/lib/venue/import';
import { prisma } from '../src/lib/prisma';

async function main() {
  const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const dryRun = process.argv.includes('--dry-run');
  if (!args[0]) { console.error('Uso: npm run venue:import -- archivo.json [--dry-run]'); process.exit(2); }
  const path = resolve(args[0]);
  let json: unknown;
  try { json = JSON.parse(readFileSync(path, 'utf8')); } catch (e) { console.error(`No se pudo leer o parsear ${path}: ${(e as Error).message}`); process.exit(2); }
  const v = validateVenueDefinition(json);
  if (!v.ok) {
    console.error(`El archivo tiene ${v.errors.length} error(es):`);
    for (const e of v.errors) console.error('  • ' + e);
    process.exit(1);
  }
  console.log(`✓ Definición válida: "${v.value.venue.name}" · ${v.value.zones.length} zonas · ${v.value.seats ? v.value.seats.length + ' asientos explícitos' : 'asientos generados desde layout'} · ${v.value.events.length} evento(s)`);
  if (dryRun) return;
  const report = await importVenue(v.value);
  console.log(`✓ Importado: venueId=${report.venueId} · ${report.zones} zonas · ${report.seats} asientos · ${report.events} eventos`);
  for (const w of report.warnings) console.warn('  ⚠ ' + w);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
