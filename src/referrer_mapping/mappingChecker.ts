import { PrismaClient } from '../../prisma/generated/cf_client';
import { prismaFetches } from '../common/prismaFetches';
import { saveAoaToXLSX } from '../common/saveToXLSX';
import { fetchParticipantReferrer } from './fetcher';
import _NAME_MAPPING from './input_data/mapping.json';

const cf_prisma = new PrismaClient();
const NAME_MAPPING_TYPED = _NAME_MAPPING as { [key: string]: string };

async function main() {
  console.time('fetch from DB');
  const [data]: [Awaited<ReturnType<typeof fetchParticipantReferrer>>] =
    await prismaFetches(cf_prisma, [fetchParticipantReferrer]);
  console.timeEnd('fetch from DB');

  console.log(data.length);

  const result: {
    hkgi_id: string;
    pc_id: string;
    referrerType: string;
    referrerName: string;
    mappedName: string;
    mappedToUser?: boolean;
    duplicateDelete?: boolean;
  }[] = [];

  console.time('processing result');
  data.forEach(({ hkgi_id, pc_id, referringNonUsers, referringUsers }) => {
    const mappedSet = new Set();
    referringNonUsers.forEach(({ referrer, type }) => {
      if (referrer in NAME_MAPPING_TYPED) {
        const mappedName = NAME_MAPPING_TYPED[referrer];

        result.push({
          hkgi_id,
          pc_id,
          referrerName: referrer,
          referrerType: type,
          mappedName: mappedName,
          mappedToUser: referringUsers.some(
            ({ user: { displayName }, type: userType }) =>
              displayName === referrer && type === userType,
          ),
          duplicateDelete:
            referringNonUsers.some(({ referrer }) => referrer === mappedName) ||
            mappedSet.has(mappedName + type),
        });

        mappedSet.add(mappedName + type);
      }
    });
  });
  console.timeEnd('processing result');

  // console.log(JSON.stringify(result, null, 2));
  console.log(result.length);

  const resultAoa = result.map(
    ({
      hkgi_id,
      pc_id,
      referrerName,
      mappedName,
      referrerType,
      mappedToUser,
      duplicateDelete,
    }) => {
      return [
        hkgi_id,
        pc_id,
        referrerName,
        mappedName,
        referrerType,
        mappedToUser,
        duplicateDelete,
      ];
    },
  );

  resultAoa.unshift([
    'HKGI ID',
    'PC ID',
    'from',
    'to',
    'type',
    'mapped to user',
    'duplicate delete',
  ]);

  saveAoaToXLSX(
    [
      {
        data: resultAoa,
      },
    ],
    `${__dirname}/output/result.xlsx`,
  );
}

if (require.main === module) {
  main();
}
