import XLSX from 'xlsx';
import { PrismaClient } from '../../prisma/generated/dig_client';
import { saveAoaToXLSX } from '../common/saveToXLSX';
import { format } from 'date-fns';

const digPrismaClient = new PrismaClient();

const inputFile = XLSX.readFile(`${__dirname}/input/input.xlsx`);

const sheetData: {
  'Sequencing Run #': string;
  'Batch#': string;
  'Family #': number;
  'Sample ID': string;
  'Ref ID ': string;
  Relationship: string;
}[] = XLSX.utils.sheet_to_json(inputFile.Sheets[inputFile.SheetNames[0]]);

const data = sheetData.map((row) => {
  return {
    run: row['Sequencing Run #'],
    batch: row['Batch#'],
    family: row['Family #'],
    sampleId: row['Sample ID'],
    refId: row['Ref ID '],
    relationship: row['Relationship'],
  };
});

async function fetchJob(sampleId: string) {
  const result = await digPrismaClient.job.findMany({
    select: {
      name: true,
      startedAt: true,
      stoppedAt: true,
      project: {
        select: {
          name: true,
          workspace: {
            select: {
              name: true,
            },
          },
        },
      },
      pipeline: {
        select: {
          name: true,
          version: true,
        },
      },
      status: true,
    },
    where: {
      AND: {
        name: {
          startsWith: sampleId,
        },
        AND: [
          {
            name: {
              not: {
                endsWith: '-2',
              },
            },
          },
          {
            name: {
              not: {
                endsWith: '-M2',
              },
            },
          },
        ],
      },
      project: {
        OR: [
          {
            name: {
              startsWith: 'CPOS',
            },
          },
          {
            name: {
              startsWith: 'HKGI',
            },
          },
        ],
        NOT: {
          OR: [
            {
              name: {
                endsWith: 'training',
              },
            },
            {
              name: {
                equals: 'HKGI_20230420_NOVA0048',
              },
            },
          ],
        },
        workspace: {
          name: {
            in: ['CPOS', 'HKGI'],
          },
        },
      },
    },
  });

  return result.map(({ startedAt, stoppedAt, ...rest }) => {
    return {
      ...rest,
      startedAt: new Date(startedAt * 1000),
      stoppedAt: new Date(stoppedAt * 1000),
    };
  });
}

async function main() {
  const result: (string | Date | number | undefined)[][] = [];

  for (const row of data) {
    const { sampleId, batch, family, refId, run, relationship } = row;

    const jobs = await fetchJob(sampleId);

    const rowOutput = [run, batch, family, sampleId, refId, relationship];

    if (jobs.length > 0) {
      result.push(
        ...jobs.map(
          ({ name, startedAt, stoppedAt, status, project, pipeline }) => {
            return [
              ...rowOutput,
              project.workspace.name,
              project.name,
              name,
              startedAt,
              stoppedAt,
              status,
              pipeline.name,
              pipeline.version,
            ];
          },
        ),
      );
    } else {
      result.push(rowOutput);
    }
  }

  result.unshift([
    'Sequencing Run #',
    'Batch#',
    'Family #',
    'Sample ID',
    'Ref ID ',
    'Relationship',
    'DIG workspace',
    'DIG project',
    'DIG job name',
    'DIG job startedAt',
    'DIG job stoppedAt',
    'DIG job status',
    'DIG pipeline name',
    'DIG pipeline version',
  ]);

  saveAoaToXLSX(
    [
      {
        data: result,
      },
    ],
    `${__dirname}/output/${format(
      new Date(),
      'yyyyMMdd_HHmmss',
    )}_reanalysis_pipeline.xlsx`,
  );
}

main();
