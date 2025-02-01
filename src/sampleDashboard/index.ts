import _awsSamples from './input_data/awsProcessedSamples.json';
import _s3Samples from './input_data/s3SequencedSamples.json';
import _digJobs from './input_data/digJobs.json';

import { format } from 'date-fns';
import { saveAoaToXLSX } from '../common/saveToXLSX';
import type { AWS_Files, T_DIG_JOBS } from './types';
import { PrismaClient } from '../../prisma/generated/dig_client';
import { fetchS3ObjectList } from '../common/awsFetches';
import { parseAwsJobsToMap } from '../AWS_samples';

async function fetchS3Samples() {
  const result = await fetchS3ObjectList('hkgi-sample-data-prod', undefined, {
    timer: true,
    debug: true,
  });

  return result.map(({ lastModified, ...rest }) => ({
    ...rest,
    lastModified: new Date(lastModified),
  }));
}

async function fetchDIGJobs() {
  const dig_client = new PrismaClient();

  const result = await dig_client.job.findMany({
    select: {
      name: true,
      status: true,
      createdAt: true,
      startedAt: true,
      stoppedAt: true,
      nodesStatus: true,
      project: {
        select: {
          name: true,
        },
      },
      pipeline: {
        select: {
          name: true,
          version: true,
        },
      },
    },
    where: {
      isDeleted: {
        equals: false,
      },
      project: {
        workspace: {
          name: {
            in: ['CPOS', 'HKGI'],
          },
        },
      },
      pipeline: {
        name: {
          equals: 'fq2vcf+SV',
        },
      },
    },
  });

  return result.map(
    ({ status, createdAt, startedAt, stoppedAt, nodesStatus, ...rest }) => {
      const parsedNodes = nodesStatus
        ? (JSON.parse(nodesStatus) as {
            [key: string]: { elapsedTime: string };
          })
        : undefined;

      const totalElapsed =
        parsedNodes &&
        Object.values(parsedNodes).reduce<number>(
          (acc, { elapsedTime }) => acc + Number(elapsedTime),
          0,
        );

      return {
        ...rest,
        status: status,
        createdAt: new Date(createdAt * 1000),
        startedAt: !!startedAt ? new Date(startedAt * 1000) : undefined,
        stoppedAt: !!stoppedAt ? new Date(stoppedAt * 1000) : undefined,
        elapsed: !!totalElapsed ? totalElapsed : undefined,
      };
    },
  );
}

function parseSamplesToBatchMap(files: AWS_Files) {
  const result = new Map<
    string,
    { date: Date; samples: Map<string, { fastq: AWS_Files }> }
  >();

  const FASTQ_REGEX =
    /(.*)\/([a-z]{4}_\d{8}.*)\/([a-z][a-z0-9].{9}-[0-9]{3}-LIB[0-9](-[0-9]*)*)_[0-9].fastq.gz/i;

  files.forEach(({ key, lastModified }) => {
    const regexResult = FASTQ_REGEX.exec(key);

    if (!regexResult) return;

    const rootFolder = regexResult[1];
    const folder = regexResult[2];
    const libId = regexResult[3];
    const date = folder.split('_')[1];

    // if (rootFolder === 'HKGI') {
    //   // for NOVA suffix, filter out
    //   if (projectFolder.includes('NOVA')) {
    //     if (projectFolder === 'HKGI_20230116_NOVA0016') {
    //       return;
    //     }
    //   } else if (
    //     !['HKGI_20221007', 'HKGI_20221018', 'HKGI_20221125B'].includes(
    //       projectFolder,
    //     )
    //   ) {
    //     return;
    //   }
    // }

    if (!result.has(folder))
      result.set(folder, {
        date: new Date(
          parseInt(date.slice(0, 4)),
          parseInt(date.slice(4, 6)) - 1,
          parseInt(date.slice(6, 8)),
        ),
        samples: new Map(),
      });

    const batch = result.get(folder)!.samples;
    if (!batch.has(libId)) batch.set(libId, { fastq: [] });
    batch.get(libId)!.fastq.push({ key, lastModified });
  });

  return result;
}

function parseBatchMapToStatsAoa(batches: ReturnType<typeof joinSampleAndJob>) {
  const result = Array.from(batches.entries())
    .sort((a, b) => a[1].date.getTime() - b[1].date.getTime())
    .map(([folderName, { date, samples }]) => {
      const awsJobCount = Array.from(samples.values()).filter(
        ({ awsJobs }) => awsJobs.length > 0,
      ).length;

      const digJobCount = Array.from(samples.values()).filter(
        ({ digJobs }) =>
          digJobs.filter(({ status }) => status === 2).length > 0,
      ).length;

      return [
        date,
        folderName.slice(0, 4),
        '',
        Array.from(samples.keys()).some((libId) => libId.startsWith('BC'))
          ? 'BC'
          : 'PC',
        folderName,
        samples.size,
        awsJobCount - samples.size === 0 || digJobCount - samples.size === 0
          ? 1
          : 0,
        awsJobCount,
        digJobCount,
      ];
    });

  result.unshift([
    'date',
    'SSP',
    'batch',
    'sample type',
    'folder',
    'sample count',
    'germline pipeline processed?',
    'aws processed jobs',
    'dig finished jobs',
  ]);

  return result;
}

function parseSamplesToAoa(
  batchesMap: ReturnType<typeof parseSamplesToBatchMap>,
) {
  const result: (Date | string | number)[][] = [];
  Array.from(batchesMap.entries())
    .sort((a, b) => a[1].date.getTime() - b[1].date.getTime())
    .forEach(([folderName, { date, samples }]) => {
      samples.forEach(({ fastq }, libId) => {
        result.push([date, folderName, libId, fastq.length]);
      });
    });

  result.unshift(['date', 'folder', 'lib Id', 'fastq count']);

  return result;
}

function parseDIG_Jobs(jobs: T_DIG_JOBS) {
  return jobs.map(
    ({ status, createdAt, startedAt, stoppedAt, nodesStatus, ...rest }) => {
      const parsedNodes = nodesStatus
        ? (JSON.parse(nodesStatus) as {
            [key: string]: { elapsedTime: string };
          })
        : undefined;

      const totalElapsed =
        parsedNodes &&
        Object.values(parsedNodes).reduce<number>(
          (acc, { elapsedTime }) => acc + Number(elapsedTime),
          0,
        );

      return {
        ...rest,
        status: status,
        createdAt: new Date(createdAt * 1000),
        startedAt: !!startedAt ? new Date(startedAt * 1000) : undefined,
        stoppedAt: !!stoppedAt ? new Date(stoppedAt * 1000) : undefined,
        elapsed: !!totalElapsed ? totalElapsed : undefined,
      };
    },
  );
}

function parseDIG_JobsToJobMap(jobs: ReturnType<typeof parseDIG_Jobs>) {
  const result = new Map<string, Map<string, typeof jobs>>();

  jobs.forEach(({ name, project, ...rest }) => {
    if (!result.has(project.name)) result.set(project.name, new Map());

    const projectFolder = result.get(project.name)!;

    if (!projectFolder.has(name)) projectFolder.set(name, []);
    projectFolder.get(name)!.push({ name, project, ...rest });
  });

  return result;
}

function joinSampleAndJob(
  sampleMap: ReturnType<typeof parseSamplesToBatchMap>,
  digJobMap: ReturnType<typeof parseDIG_JobsToJobMap>,
  awsJobMap: ReturnType<typeof parseAwsJobsToMap>,
) {
  const result = new Map<
    typeof sampleMap extends Map<infer K, any> ? K : never,
    {
      date: Date;
      samples: Map<
        string,
        ((typeof sampleMap extends Map<any, infer I>
          ? I
          : never)['samples'] extends Map<any, infer I>
          ? I
          : never) & {
          digJobs: (
            typeof digJobMap extends Map<any, infer I> ? I : never
          ) extends Map<any, infer I>
            ? I
            : never;
          awsJobs: typeof awsJobMap extends Map<any, infer I> ? I : never;
        }
      >;
    }
  >();

  sampleMap.forEach(({ date, samples }, folderName) => {
    result.set(folderName, { date, samples: new Map() });
    const folder = result.get(folderName)!;

    samples.forEach(({ fastq }, libId) => {
      folder.samples.set(libId, { fastq, digJobs: [], awsJobs: [] });

      const sample = folder.samples.get(libId)!;

      // join dig jobs
      const projectFolder = digJobMap.get(folderName);

      if (projectFolder) {
        const sampleJob = projectFolder.get(libId);
        if (sampleJob) {
          sample.digJobs = sampleJob;
        }
      }

      // join aws jobs
      const awsJobs = awsJobMap.get(libId);
      if (awsJobs) {
        sample.awsJobs = awsJobs;
      }
    });
  });

  return result;
}

async function main() {
  console.time('read input');
  const AWS_PROCESSED_SAMPLES: AWS_Files = (_awsSamples as any[]).map(
    ({ lastModified, ...rest }) => ({
      ...rest,
      lastModified: new Date(lastModified),
    }),
  );

  const S3_SEQUENCED_SAMPLES: AWS_Files = (_s3Samples as any[]).map(
    ({ lastModified, ...rest }) => ({
      ...rest,
      lastModified: new Date(lastModified),
    }),
  );

  const DIG_JOBS = parseDIG_Jobs(_digJobs);
  console.timeEnd('read input');

  // const [S3_SEQUENCED_SAMPLES, DIG_JOBS] = await Promise.all([
  //   fetchS3Samples(),
  //   fetchDIGJobs(),
  // ]);

  console.time('parse to maps');
  const sequencedBatches = parseSamplesToBatchMap(S3_SEQUENCED_SAMPLES);
  const digJobMap = parseDIG_JobsToJobMap(DIG_JOBS);
  const awsJobMap = parseAwsJobsToMap(AWS_PROCESSED_SAMPLES);
  console.timeEnd('parse to maps');

  console.time('join maps');
  const joinedSampleJobs = joinSampleAndJob(
    sequencedBatches,
    digJobMap,
    awsJobMap,
  );
  console.timeEnd('join maps');

  saveAoaToXLSX(
    [
      {
        data: parseBatchMapToStatsAoa(joinedSampleJobs),
      },
      {
        data: parseSamplesToAoa(sequencedBatches),
      },
    ],
    `${__dirname}/output/${format(
      new Date(),
      'yyyyMMdd_HHmmss',
    )}_dashboard.xlsx`,
  );
}

main();
