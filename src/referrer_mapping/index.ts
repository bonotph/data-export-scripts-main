import { PrismaClient } from '../../prisma/generated/cf_client';
import { prismaFetches } from '../common/prismaFetches';
import { saveAoaToXLSX } from '../common/saveToXLSX';
import { fetchParticipantReferrer } from './fetcher';
import MAPPED_NAMES from './input_data/mapped_name.json';

const MAPPED_NAME_SET = new Set(MAPPED_NAMES);

const cf_prisma = new PrismaClient();

async function main() {
  console.time('fetch from DB');
  const [data]: [Awaited<ReturnType<typeof fetchParticipantReferrer>>] =
    await prismaFetches(cf_prisma, [fetchParticipantReferrer]);
  // console.log(JSON.stringify(data, null, 2));
  console.timeEnd('fetch from DB');

  console.log(data.length);

  const result: {
    hkgi_id: string;
    pc_id: string;
    referrerName: string;
  }[] = [];

  console.time('processing result');
  data.forEach(({ hkgi_id, pc_id, referringNonUsers }) => {
    referringNonUsers.forEach(({ referrer }) => {
      if (!MAPPED_NAME_SET.has(referrer)) {
        result.push({
          hkgi_id,
          pc_id,
          referrerName: referrer,
        });
      }
    });
  });
  console.timeEnd('processing result');

  // console.log(JSON.stringify(result, null, 2));
  console.log(result.length);

  const resultAoa = result.map(({ hkgi_id, pc_id, referrerName }) => [
    hkgi_id,
    pc_id,
    referrerName,
  ]);

  resultAoa.unshift(['HKGI ID', 'PC ID', 'from']);

  saveAoaToXLSX([{ data: resultAoa }], `${__dirname}/output/needMap.xlsx`);
}

if (require.main === module) {
  main();
}
