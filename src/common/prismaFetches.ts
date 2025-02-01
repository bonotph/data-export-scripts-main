import {
  PrismaClient as CF_PrismaClient,
  PrismaPromise as CF_PrismaPromise,
} from '../../prisma/generated/cf_client';
import {
  PrismaClient as DIG_PrismaClient,
  PrismaPromise as DIG_PrismaPromise,
} from '../../prisma/generated/dig_client';

type PrismaClient = CF_PrismaClient | DIG_PrismaClient;

type PrismaPromise<T> = CF_PrismaPromise<T> | DIG_PrismaPromise<T>;

/**
 * Handles an array of prisma fetches and fetches them concurrently,
 * via Promise.all
 * @param fetches
 * @param options
 * @returns
 */
export async function prismaFetches(
  prismaClient: PrismaClient,
  fetches: ((prisma: any) => PrismaPromise<any>)[],
  options: {
    timer?: boolean;
  } = { timer: false },
) {
  let data: any;

  if (options.timer) console.time('fetch data from db');

  try {
    data = await Promise.all(fetches.map((fetch) => fetch(prismaClient)));
  } catch (err) {
    console.log(err);
    await prismaClient.$disconnect();
    process.exit(1);
  }
  await prismaClient.$disconnect();

  if (options.timer) console.timeEnd('fetch data from db');

  return data;
}
