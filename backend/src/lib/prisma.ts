import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';
import { env } from '../config/env';

/** Cliente Prisma único. Prisma 7 usa un driver adapter (pg) en lugar de un motor binario. */
const pool = new Pool({ connectionString: env.DATABASE_URL });
export const prisma = new PrismaClient({ adapter: new PrismaPg(pool), log: env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'] });
