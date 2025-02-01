import { format } from 'date-fns';
import _ from 'lodash';

import { PrismaClient } from '../../prisma/generated/cf_client';
import { fetchS3ObjectList } from '../common/awsFetches';
import { saveAoaToXLSX } from '../common/saveToXLSX';

const cf_prismaClient = new PrismaClient();

async function fetchCfReferrerHpo() {
  return cf_prismaClient.patient.findMany({
    select: {
      hkgi_id: true,
      pc_id: true,
      status: true,
      healthStatus: true,
      isProband: true,
      hpoTerms: {
        select: {
          hpo: true,
        },
      },
      referringUsers: {
        select: {
          user: {
            select: {
              displayName: true,
            },
          },
        },
        where: {
          isDeleted: 0,
        },
      },
      referringNonUsers: {
        select: {
          referrer: true,
        },
        where: {
          isDeleted: 0,
        },
      },
    },
    where: {
      referHospital: {
        notIn: ['SB'],
      },
      OR: [
        {
          referringNonUsers: {
            some: {
              isDeleted: 0,
              OR: [
                {
                  referrer: {
                    contains: 'yap hang',
                  },
                },
                {
                  referrer: {
                    contains: 'hung fat tse',
                  },
                },
              ],
            },
          },
        },
        {
          referringUsers: {
            some: {
              isDeleted: 0,
              OR: [
                {
                  user: {
                    displayName: {
                      contains: 'yap hang',
                    },
                  },
                },
                {
                  user: {
                    displayName: {
                      contains: 'hung fat tse',
                    },
                  },
                },
              ],
            },
          },
        },
      ],
    },
    orderBy: {
      hkgi_id: 'desc',
    },
  });
}

async function fetchS3Samples() {
  const objectList = await fetchS3ObjectList('hkgi-sample-data-prod');

  const result = new Map<string, string[]>();

  const FASTQ_REGEX =
    /^(\w*?)\/(\w*?)\/([a-z][a-z0-9].{9}-[0-9]{3}-LIB[0-9](-[0-9]*)*)_[0-9].fastq.gz/i;

  objectList.forEach(({ key }) => {
    const regexResult = FASTQ_REGEX.exec(key);

    if (!regexResult) return;

    const folder = regexResult[2];
    const libId = regexResult[3];
    const samplePrefix = libId.slice(0, 8);

    if (folder === 'HKGI_20230420_NOVA0048') return;

    if (!result.has(samplePrefix)) result.set(samplePrefix, []);
    result.get(samplePrefix)!.push(`${folder}/${libId}`);
  });

  return result;
}

const SPECIMEN_PREFIX = {
  QM: 'A0',
  HW: 'A1',
  CH: 'B0',
  PW: 'C0',
} as { [key: string]: string };

function parseResultToAoa(
  patients: Awaited<ReturnType<typeof fetchCfReferrerHpo>>,
  sampleMap: Awaited<ReturnType<typeof fetchS3Samples>>,
) {
  const result: (string | number | null)[][] = [];

  result.push([
    'HKGI ID',
    'PC ID',
    'is Proband?',
    'status',
    'health status',
    'HPO terms',
    'referring user',
    'referring non-user',
    'sample prefix',
    'sequenced lib ID',
  ]);

  patients.forEach(
    ({
      hkgi_id,
      pc_id,
      isProband,
      status,
      healthStatus,
      hpoTerms,
      referringUsers,
      referringNonUsers,
    }) => {
      const samplePrefix = `${
        SPECIMEN_PREFIX[pc_id.slice(0, 2)]
      }${hkgi_id.slice(2)}`;

      result.push([
        hkgi_id,
        pc_id,
        isProband,
        status,
        healthStatus,
        hpoTerms ? (hpoTerms.hpo as string[]).join(', ') : null,
        referringUsers
          .map(({ user: { displayName } }) => displayName)
          .join(', '),
        referringNonUsers.map(({ referrer }) => referrer).join(', '),
        samplePrefix,
        sampleMap.has(samplePrefix)
          ? _.uniq(sampleMap.get(samplePrefix)!).join(', ')
          : null,
      ]);
    },
  );

  return result;
}

async function main() {
  const patients = await fetchCfReferrerHpo();

  const s3SampleMap = await fetchS3Samples();

  // console.log(JSON.stringify(patients, null, 2));
  console.log(patients.length);
  // console.log(s3SampleSet);
  // console.log(s3SampleSet.size);
  saveAoaToXLSX(
    [
      {
        data: parseResultToAoa(patients, s3SampleMap),
      },
    ],
    `${__dirname}/output/${format(
      new Date(),
      'yyyyMMdd_HHmmss',
    )}_referrerHpoSamples.xlsx`,
  );
}

if (require.main === module) {
  main();
}
