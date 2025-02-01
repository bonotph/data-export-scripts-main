import { format } from 'date-fns';
import { PrismaClient } from '../../prisma/generated/dig_client';
import { fetchS3ObjectList } from '../common/awsFetches';
import { fetchAndCheckAwsFiles } from './awsFetches';
import { saveAoaToXLSX } from '../common/saveToXLSX';

export interface backupStatsType {
  digTotalJobCount: number;
  incompleteJobsCount: number;
  incompleteFilesCount: number;
  digTotalSize: number;
  s3TotalSize: number;
  digStats: Map<string, number>;
  s3Stats: Map<string, number>;
}

const digPrismaClient = new PrismaClient();

async function fetchDigBackupJobFiles(workspace: string) {
  const chunkSize = 1000;

  type jobInfo = {
    id: string;
    name: string;
    file: {
      id: string;
      name: string;
      createdAt: number;
      size: bigint | null;
    }[];
  };

  console.time(`fetch from dig workspace: ${workspace}`);

  let index = 0;
  let result: jobInfo[] = [];
  while (true) {
    let resultChunk: jobInfo[] = await digPrismaClient.job.findMany({
      skip: index,
      take: chunkSize,
      select: {
        name: true,
        id: true,
        file: {
          select: {
            id: true,
            name: true,
            size: true,
            createdAt: true,
          },
          where: {
            AND: [
              {
                name: {
                  not: {
                    endsWith: '.bam',
                  },
                },
              },
              {
                name: {
                  not: {
                    endsWith: '.bai',
                  },
                },
              },
            ],
            isDeleted: false,
          },
        },
      },
      where: {
        isDeleted: false,
        project: {
          isDeleted: false,
          workspace: {
            name: workspace,
          },
        },
        queueId: {
          not: 'Development',
        },
        status: 2,
        pipeline: {
          name: 'fq2vcf+SV',
        },
      },
    });
    result.push(...resultChunk);

    if (resultChunk.length < chunkSize) break;
    index += chunkSize;
  }

  console.timeEnd(`fetch from dig workspace: ${workspace}`);

  return result.map(({ file, ...rest }) => {
    return {
      ...rest,
      file: file.map(({ size, createdAt, ...rest }) => {
        return {
          ...rest,
          size: Number(size),
          createdAt: new Date(createdAt * 1000),
        };
      }),
    };
  });
}

function checkCurrentBackupStatus(backupStats: backupStatsType) {
  const {
    digTotalSize,
    s3TotalSize,
    digTotalJobCount,
    incompleteJobsCount,
    incompleteFilesCount,
  } = backupStats;

  console.log(`total size in dig: ${digTotalSize * 1e-12} TB`);
  console.log(`total size in s3: ${s3TotalSize * 1e-12} TB`);
  if (digTotalSize - s3TotalSize > 0)
    console.log(`backlog (size): ${(digTotalSize - s3TotalSize) * 1e-9} GB`);

  console.log(`total job count in dig: ${digTotalJobCount}`);

  if (incompleteJobsCount > 0) {
    console.log(`incomplete job count: ${incompleteJobsCount}`);
    console.log(`incomplete file count: ${incompleteFilesCount}`);
  }

  console.log(
    `backup percent (size): ${
      Math.floor((s3TotalSize / digTotalSize) * 10000) / 100
    } %`,
  );
}

function parseStatsToAoa(stats: Map<string, number>) {
  let total = 0;
  const result: (Date | string | number)[][] = Array.from(stats.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, count]) => {
      return [new Date(date), count, (total += count)];
    });

  result.unshift(['date', 'count', 'total']);

  return result;
}

async function fetchAndCheckWorkspaceBackup(workspace: string) {
  console.log(`checking Workspace: ${workspace}`);

  const digFiles = await fetchDigBackupJobFiles(workspace);
  const digFileMap = new Map<string, { size: number; jobId: string }>();
  const incompleteJobs = new Map<string, number>();

  const backupStats: backupStatsType = {
    digTotalJobCount: 0,
    incompleteJobsCount: 0,
    incompleteFilesCount: 0,
    digTotalSize: 0,
    s3TotalSize: 0,
    digStats: new Map(),
    s3Stats: new Map(),
  };

  digFiles.forEach(({ id: jobId, file }) => {
    incompleteJobs.set(jobId, file.length);
    file.forEach(({ id, size, createdAt }) => {
      digFileMap.set(id, { size, jobId });

      // update dig file size and create log
      backupStats.digTotalSize += size;
      const dateString = format(createdAt, 'yyyy-MM-dd');
      if (!backupStats.digStats.has(dateString))
        backupStats.digStats.set(dateString, 0);
      backupStats.digStats.set(
        dateString,
        backupStats.digStats.get(dateString)! + size,
      );
    });
  });
  backupStats.digTotalJobCount = digFiles.length;

  await fetchAndCheckAwsFiles(
    workspace,
    digFileMap,
    incompleteJobs,
    backupStats,
  );
  backupStats.incompleteJobsCount = incompleteJobs.size;
  backupStats.incompleteFilesCount = Array.from(incompleteJobs.values()).reduce(
    (a, b) => a + b,
    0,
  );

  checkCurrentBackupStatus(backupStats);
  console.log('');

  return { ...backupStats };
}

async function main() {
  const testingStats = await fetchAndCheckWorkspaceBackup('Testing');
  const hkgiStats = await fetchAndCheckWorkspaceBackup('HKGI');
  const cposStats = await fetchAndCheckWorkspaceBackup('CPOS');

  const digTotalSize =
    testingStats.digTotalSize + hkgiStats.digTotalSize + cposStats.digTotalSize;

  const s3TotalSize =
    testingStats.s3TotalSize + hkgiStats.s3TotalSize + cposStats.s3TotalSize;

  const digTotalJobCount =
    testingStats.digTotalJobCount +
    hkgiStats.digTotalJobCount +
    cposStats.digTotalJobCount;

  const incompleteJobCount =
    testingStats.incompleteJobsCount +
    hkgiStats.incompleteJobsCount +
    cposStats.incompleteJobsCount;

  console.log('Total');
  console.log(`total size in dig: ${digTotalSize * 1e-12} TB`);
  console.log(`total size in s3: ${s3TotalSize * 1e-12} TB`);

  if (digTotalSize - s3TotalSize > 0)
    console.log(`backlog (size): ${(digTotalSize - s3TotalSize) * 1e-9} GB`);

  console.log(`total job count in dig: ${digTotalJobCount}`);

  if (incompleteJobCount > 0) {
    console.log(`incomplete job count: ${incompleteJobCount}`);
  }

  console.log(
    `backup percent (size): ${
      Math.floor((s3TotalSize / digTotalSize) * 10000) / 100
    } %`,
  );

  saveAoaToXLSX(
    [
      {
        data: parseStatsToAoa(testingStats.digStats),
        name: 'testing_dig',
      },
      {
        data: parseStatsToAoa(testingStats.s3Stats),
        name: 'testing_s3',
      },
      {
        data: parseStatsToAoa(hkgiStats.digStats),
        name: 'hkgi_dig',
      },
      {
        data: parseStatsToAoa(hkgiStats.s3Stats),
        name: 'hkgi_s3',
      },
      {
        data: parseStatsToAoa(cposStats.digStats),
        name: 'cpos_dig',
      },
      {
        data: parseStatsToAoa(cposStats.s3Stats),
        name: 'cpos_s3',
      },
    ],
    `${__dirname}/output/${format(
      new Date(),
      'yyyyMMdd_HHmmss',
    )}_digBackupStats.xlsx`,
  );
}

if (require.main === module) {
  main();
}
