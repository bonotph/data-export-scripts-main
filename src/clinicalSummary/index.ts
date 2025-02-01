import { format } from 'date-fns';
import { PrismaClient } from '../../prisma/generated/cf_client';
import { saveAoaToXLSX } from '../common/saveToXLSX';

const prismaClient = new PrismaClient();

const CF_PC = ['HKCH', 'PWH', 'QMH', 'HKW', 'NTE'];

// fetch list of participants from CF MySQL
async function fetchParticipants() {
  const dbResult = await prismaClient.patient.findMany({
    include: {
      hpoTerms: {
        select: {
          hpo: true,
        },
      },
      cancer: {
        select: {
          clinicalSummary: true,
        },
      },
      undiagnosed: {
        select: {
          clinicalSummary: true,
        },
      },
    },
    where: {
      workspacePatient: {
        workspace: {
          name: {
            in: CF_PC,
          },
        },
      },
    },
    orderBy: {
      create_at: 'desc',
    },
  });

  return dbResult.map(({ create_at, ...rest }) => {
    return {
      ...rest,
      create_at: new Date(create_at * 1000),
    };
  });
}

// parse the result into array of array to save as xlsx
function parseResultToAoa(data: Awaited<ReturnType<typeof fetchParticipants>>) {
  const result: (Date | string | number | undefined | null)[][] = data.map(
    ({
      create_at,
      hkgi_id,
      pc_id,
      isProband,
      referHospital,
      healthStatus,
      sex,
      status,
      cancer,
      undiagnosed,
    }) => {
      return [
        create_at,
        hkgi_id,
        pc_id,
        referHospital,
        status,
        sex ? sex : 'NULL',
        healthStatus ? healthStatus : 'NULL',
        isProband ? isProband : 'NULL',
        undiagnosed?.clinicalSummary ? undiagnosed.clinicalSummary : 'NULL',
        cancer?.clinicalSummary ? cancer.clinicalSummary : 'NULL',
      ];
    },
  );

  result.unshift([
    'Profile Created At',
    'HKGI ID',
    'PC ID',
    'Refer Hospital',
    'Status',
    'Sex',
    'Health Status',
    'Is Proband',
    'Undiagnosed Clinical Summary',
    'Cancer Clinical Summary',
  ]);

  return result;
}

// main function
async function main() {
  const participants = await fetchParticipants();

  saveAoaToXLSX(
    [
      {
        data: parseResultToAoa(participants),
      },
    ],
    `${__dirname}/output/${format(
      new Date(),
      'yyMMdd_HHmmss',
    )}_clinicalSummary.xlsx`,
  );
}

if (require.main === module) {
  main();
}
