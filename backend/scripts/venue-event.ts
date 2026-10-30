/**
 * Crea uno de los recintos reales con su evento sin pasar por el seed completo.
 *   npm run venue:event -- cuscatlan|beele|bocelli              crea el recinto si su evento no existe
 *   npm run venue:event -- cuscatlan|beele|bocelli --dry-run    solo valida y muestra el conteo
 *   npm run venue:event -- cuscatlan|beele|bocelli --crowd      regenera el JSON de público en frontend/public/models
 * Nunca reemplaza un evento existente: conserva su inventario, reservas y ventas.
 */
import 'dotenv/config';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { prisma } from '../src/lib/prisma';
import { buildCuscatlan, seedCuscatlan, FINAL_EVENT_ID } from '../prisma/seeds/cuscatlan';
import { buildBeele, seedBeele, BEELE_EVENT_ID } from '../prisma/seeds/beele';
import { buildBocelli, seedBocelli, BOCELLI_EVENT_ID } from '../prisma/seeds/bocelli';

const VENUES = {
  cuscatlan: { eventId: FINAL_EVENT_ID, build: buildCuscatlan, seed: seedCuscatlan, crowd: 'cuscatlan-crowd.json' },
  beele: { eventId: BEELE_EVENT_ID, build: buildBeele, seed: seedBeele, crowd: 'beele-crowd.json' },
  bocelli: { eventId: BOCELLI_EVENT_ID, build: buildBocelli, seed: seedBocelli, crowd: 'bocelli-crowd.json' },
};

async function main() {
  const name = process.argv.slice(2).find((a) => !a.startsWith('--')) as keyof typeof VENUES | undefined;
  const venue = name && VENUES[name];
  if (!venue) { console.error(`Uso: npm run venue:event -- ${Object.keys(VENUES).join('|')} [--dry-run] [--crowd]`); process.exit(2); }
  const { seats, crowd } = venue.build();
  console.log(`${name}: ${seats.length} lugares (${seats.filter((s) => s.row !== 'GA').length} numerados)`);
  if (process.argv.includes('--crowd')) {
    writeFileSync(resolve(__dirname, '../../frontend/public/models', venue.crowd), JSON.stringify(crowd));
    console.log(`Público actualizado: frontend/public/models/${venue.crowd}`);
  }
  if (process.argv.includes('--dry-run')) return;
  if (await prisma.event.findUnique({ where: { id: venue.eventId } })) { console.log(`El evento ${venue.eventId} ya existe; se conserva su inventario.`); return; }
  const r = await venue.seed(prisma);
  console.log(`Creado: evento ${r.eventId}, recinto ${r.venueId}, ${r.seats} lugares.`);
}

main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
