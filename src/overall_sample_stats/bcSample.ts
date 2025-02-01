import _, { kebabCase } from 'lodash';
import { PrismaClient as DbPrismaClient } from '../../prisma/generated/db_client';
import { PrismaClient as DigPrismaClient } from '../../prisma/generated/dig_client';

async function fetchFastqFiles() {
  const dbPrismaClient = new DbPrismaClient();

  return dbPrismaClient.s3_fastq_file.findMany({
    select: {
      file_key: true,
      last_modified: true,
    },
    where: {
      entry_is_deleted: false,
      s3_fastq_file_ignore: {
        is: null,
      },
    },
  });
}

const FASTQ_REGEX =
  /^(\w*?)\/(\w*?)\/([a-z][a-z0-9].{9}-[0-9]{3}-LIB[0-9](-[0-9]*)*)_[0-9].fastq.gz/i;

function parseFastqFilesToBatchMap(
  data: Awaited<ReturnType<typeof fetchFastqFiles>>,
) {
  const parsedData = data.reduce<
    { folder: string; libId: string; file_key: string; last_modified: Date }[]
  >((acc, { file_key, last_modified }) => {
    const regexResult = FASTQ_REGEX.exec(file_key);

    if (!regexResult) return acc;

    const folder = regexResult[2];
    const libId = regexResult[3];

    if (/-\d$/i.exec(libId)) return acc;
    if (/-R\d$/i.exec(libId)) return acc;
    if (!libId.startsWith('BC')) return acc;

    acc.push({
      folder,
      libId,
      file_key,
      last_modified,
    });

    return acc;
  }, []);

  const folders = _.groupBy(parsedData, 'folder');

  const batches = Object.entries(folders).map(([folder, files]) => {
    const dateString = folder.split('_')[1].slice(0, 7);

    return {
      folder,
      date: new Date(
        `${dateString.slice(0, 4)}-${dateString.slice(4, 6)}-${dateString.slice(
          6,
          8,
        )}`,
      ),
      samples: _(files).groupBy('libId').value(),
    };
  });

  const batchMap = new Map(
    batches.map(({ folder, date, samples }) => {
      return [
        folder,
        {
          date,
          samples: new Map(
            Object.entries(samples).map(([libId, files]) => {
              return [
                libId,
                {
                  fastq: files.map(({ file_key, last_modified }) => ({
                    key: file_key,
                    last_modified,
                  })),
                },
              ];
            }),
          ),
        },
      ];
    }),
  );

  return batchMap;
}

async function fetchDigJobs() {
  const digPrismaClient = new DigPrismaClient();
  const jobs = await digPrismaClient.job.findMany({
    select: {
      name: true,
      stoppedAt: true,
    },
    where: {
      name: {
        contains: 'LIB',
        not: {
          startsWith: 'BC',
          endsWith: '-2',
        },
      },
      isDeleted: false,
      status: 2,
      project: {
        workspace: {
          name: {
            in: ['HKGI', 'CPOS'],
          },
        },
      },
      pipeline: {
        name: {
          contains: 'fq2vcf',
        },
      },
    },
    orderBy: {
      stoppedAt: 'asc',
    },
  });

  return jobs.map(({ stoppedAt, ...rest }) => ({
    ...rest,
    stoppedAt: new Date(stoppedAt * 1000),
  }));
}

async function main() {
  const batchMap = parseFastqFilesToBatchMap(await fetchFastqFiles());

  // const batchCount = batchMap.length;
  // const sampleCount = _.sum(
  //   batchMap.map(({ samples }) => Object.keys(samples).length),
  // );

  // console.log(JSON.stringify(batchMap, null, 2));
  // console.log(batchCount);
  // console.log(sampleCount);
}

if (require.main === module) {
  main();
}
