import _, { rest } from 'lodash';
import { PrismaClient as CfPrismaClient } from '../../../prisma/generated/cf_client';
import MAPPING_DATA from './mapping.json';
import { saveAoaToXLSX } from '../../common/saveToXLSX';
import { format } from 'date-fns';

const REFERRER_MAPPING = MAPPING_DATA as { [key: string]: string };

const cfPrismaClient = new CfPrismaClient();

function replaceAndTrim(input: string) {
  return input
    .replaceAll(/[^a-z0-9\.,]/gi, ' ')
    .replaceAll(/\s+/g, ' ')
    .trim();
}

async function fetchReferrerUser() {
  const result = await cfPrismaClient.user.findMany({
    select: {
      id: true,
      displayName: true,
    },
    where: {
      referees: {
        some: {
          isDeleted: 0,
          patient: {
            referHospital: {
              notIn: ['SB'],
            },
          },
        },
      },
    },
  });

  return result.map(({ displayName, ...rest }) => {
    return {
      ...rest,
      displayName: replaceAndTrim(displayName),
    };
  });
}

async function fetchWorkspaceReferrer() {
  const result = await cfPrismaClient.workspace.findMany({
    select: {
      name: true,
      clinicians: true,
    },
    where: {
      name: {
        notIn: ['SB'],
      },
    },
  });

  return result
    .map(({ clinicians, ...rest }) => {
      return {
        ...rest,
        clinicians: (clinicians as string[]).map(replaceAndTrim),
      };
    })
    .filter(({ clinicians }) => clinicians.length > 0);
}

function parseUserReferrerToAoa(
  referrer: Awaited<ReturnType<typeof fetchReferrerUser>>,
) {
  const result = referrer
    .filter(
      ({ displayName }) => displayName.toLocaleLowerCase() in REFERRER_MAPPING,
    )
    .map(({ id, displayName }) => {
      return [
        'User',
        id,
        displayName,
        REFERRER_MAPPING[displayName.toLocaleLowerCase()],
      ];
    })
    .sort((a, b) => a[2].localeCompare(b[2]));

  result.unshift(['Table', 'User ID', 'From', 'To']);

  return result;
}

function parseWorkspaceReferrerToAoa(
  referrer: Awaited<ReturnType<typeof fetchWorkspaceReferrer>>,
) {
  const result = referrer.reduce<string[][]>((acc, { clinicians, name }) => {
    const entries = clinicians
      .filter((clinician) => clinician.toLocaleLowerCase() in REFERRER_MAPPING)
      .map((clinician) => [
        'Workspace Clinicians',
        name,
        clinician,
        REFERRER_MAPPING[clinician.toLocaleLowerCase()],
      ])
      .sort((a, b) => a[2].localeCompare(b[2]));

    return acc.concat(entries);
  }, []);

  result.unshift(['Table', 'Workspace', 'From', 'To']);

  return result;
}

async function fetchReferringNonUser() {
  const result = await cfPrismaClient.referringNonUser.findMany({
    select: {
      patient_id: true,
      referrer: true,
      isDeleted: true,
      patient: {
        select: {
          referHospital: true,
        },
      },
      create_at: true,
    },
  });

  return result.map(({ referrer, ...rest }) => {
    return {
      ...rest,
      referrer: replaceAndTrim(referrer),
    };
  });
}

function parseReferringNonUserToAoa(
  referrer: Awaited<ReturnType<typeof fetchReferringNonUser>>,
) {
  const result = referrer
    .filter(({ referrer }) => referrer.toLocaleLowerCase() in REFERRER_MAPPING)
    .map(({ patient_id, referrer, isDeleted, patient, create_at }) => [
      'Referring Non User',
      patient_id,
      referrer,
      REFERRER_MAPPING[referrer.toLocaleLowerCase()],
      isDeleted,
      patient.referHospital,
      new Date(create_at * 1000),
    ]);

  result.unshift([
    'Table',
    'Patient ID',
    'From',
    'To',
    'isDeleted',
    'workspace',
    'create_at',
  ]);

  return result;
}

async function main() {
  const [referrerUser, workspaceReferrer, referringNonUser] = await Promise.all(
    [fetchReferrerUser(), fetchWorkspaceReferrer(), fetchReferringNonUser()],
  );

  // const temp = referringNonUser.filter(({ referrer }) =>
  //   replaceAndTrim(referrer)
  //     .toLocaleLowerCase()
  //     .includes('Dr Au Wai Man Candice'.toLocaleLowerCase()),
  // );

  // console.log(temp);
  saveAoaToXLSX(
    [
      {
        data: parseUserReferrerToAoa(referrerUser),
        name: 'User Changes',
      },
      {
        data: parseWorkspaceReferrerToAoa(workspaceReferrer),
        name: 'Workspace Changes',
      },
      {
        data: parseReferringNonUserToAoa(referringNonUser),
        name: 'ReferringNonUser Changes',
      },
    ],
    `${__dirname}/output/${format(
      new Date(),
      'yyyyMMdd_HHmmss',
    )}_referrerMapping.xlsx`,
  );
}

if (require.main === module) {
  main();
}
