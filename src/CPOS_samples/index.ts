import { format } from 'date-fns';
import { PrismaClient as DIG_PrismaClient } from '../../prisma/generated/dig_client';
import { fetchS3ObjectList } from '../common/awsFetches';
import { saveAoaToXLSX } from '../common/saveToXLSX';

function JOB_STATUS(num: number) {
  switch (num) {
    case 0:
      return 'New';
    case 1:
      return 'Running';
    case 2:
      return 'Finished';
    case 4:
      return 'Stopped';
    case 8:
      return 'Failed';
    case 16:
      return 'Pending';
    case 32:
      return 'Stopping';
    case 64:
      return 'Pausing';
    case 128:
      return 'Paused';
    default:
      return 'Unknown';
  }
}

const dig_client = new DIG_PrismaClient();

async function fetchJobs() {
  const dbResults = await dig_client.job.findMany({
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
      name: {
        contains: 'LIB',
      },
      status: {
        not: {
          equals: 8,
        },
      },
      isDeleted: {
        equals: false,
      },
      project: {
        name: {
          startsWith: 'CPOS',
        },
      },
      pipeline: {
        name: {
          equals: 'fq2vcf+SV',
        },
      },
    },
  });

  return dbResults.map(
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
        status: JOB_STATUS(status),
        createdAt: new Date(createdAt * 1000),
        startedAt: !!startedAt ? new Date(startedAt * 1000) : undefined,
        stoppedAt: !!stoppedAt ? new Date(stoppedAt * 1000) : undefined,
        elapsed: !!totalElapsed ? totalElapsed : undefined,
      };
    },
  );
}

/**
 * Parse the provide S3 object list to a nested map
 * @param s3objects
 * @returns Map<Date string, Map<libId, { ...sample properties }>
 */
function parseS3ObjectsToMap(
  s3objects: Awaited<ReturnType<typeof fetchS3ObjectList>>,
) {
  const result = new Map<
    string,
    Map<string, { fastq_fileKeys: string[]; isTopUp: boolean; folder: string }>
  >();

  const regExp =
    /(.*)\/(.*_.*)\/([a-z][a-z0-9].{9}-[0-9]{3}-LIB[0-9](-[0-9]*)*)_[0-9].fastq.gz/i;

  s3objects.forEach(({ key }) => {
    const regExpResults = regExp.exec(key);

    // return if file not matches the specified format
    if (!regExpResults) return;

    const rootFolder = regExpResults[1];
    const projectFolder = regExpResults[2];
    const libId = regExpResults[3];
    const isTopUp = !!regExpResults[4]; // check if the file is a top-up
    const date = projectFolder.split('_')[1];

    if (date.length < 8) return;
    // for CPOS folder
    if (rootFolder !== 'CPOS') return;
    // filter out project folder not starts with CPOS and test data earlier than 2021-11-30
    if (
      !projectFolder.startsWith('CPOS') ||
      date.localeCompare('20211130') < 0
    ) {
      return;
    }

    if (
      !libId.startsWith('BC') &&
      date.localeCompare('20230301') < 0 &&
      !['20221018'].includes(date)
    )
      return;

    const formattedDateString = `${date.slice(0, 4)}/${date.slice(
      4,
      6,
    )}/${date.slice(6, 8)}`;

    // if the date has not been added yet
    if (!result.has(formattedDateString)) {
      result.set(formattedDateString, new Map());
    }

    const existingSpecimens = result.get(formattedDateString)!;

    // if the lib ID has not been added yet
    if (!existingSpecimens.has(libId)) {
      existingSpecimens.set(libId, {
        fastq_fileKeys: [],
        isTopUp,
        folder: `${rootFolder}/${projectFolder}`,
      });
    }

    existingSpecimens.get(libId)!.fastq_fileKeys.push(key);
  });

  return result;
}

/**
 * Parse the list of dig jobs into a map
 * @param jobs
 * @returns Map<$projectName/$libId, jobs>
 */
function parseJobsToMap(jobs: Awaited<ReturnType<typeof fetchJobs>>) {
  const result = new Map<string, typeof jobs>();

  jobs.forEach((job) => {
    const { name, project } = job;

    const key = `${project.name}/${name}`;
    if (!result.has(key)) {
      result.set(key, []);
    }
    result.get(key)!.push(job);
  });

  return result;
}

function parseSampleJobs(
  dateSampleMap: ReturnType<typeof parseS3ObjectsToMap>,
  jobMap: ReturnType<typeof parseJobsToMap>,
) {
  const result = new Map<
    string,
    Map<
      string,
      ((typeof dateSampleMap extends Map<any, infer I> ? I : never) extends Map<
        any,
        infer I
      >
        ? I
        : never) & { jobs: Awaited<ReturnType<typeof fetchJobs>> }
    >
  >();

  dateSampleMap.forEach((samples, date) => {
    const resultSamples: typeof result extends Map<any, infer I> ? I : never =
      new Map();

    samples.forEach((sample, libId) => {
      const digJobs = jobMap.get(`${sample.folder.split('/')[1]}/${libId}`);
      const sampleJobs = !!digJobs
        ? digJobs.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
        : [];

      resultSamples.set(libId, { ...sample, jobs: sampleJobs });
    });
    result.set(date, resultSamples);
  });

  return result;
}

function parseSampleStats(sampleMap: ReturnType<typeof parseSampleJobs>) {
  const result = new Map<string, number>();

  sampleMap.forEach((samples, date) => {
    result.set(date, samples.size);
  });

  return new Map(Array.from(result).sort());
}

function parseJobStats(sampleJobMap: ReturnType<typeof parseSampleJobs>) {
  const result = new Map<string, { reRuns: number; count: number }>();

  // for each date
  sampleJobMap.forEach((samples) => {
    // for each sample
    samples.forEach(({ jobs }) => {
      // for each job, count all, including reruns
      const processedJobs = jobs.filter(({ status }) => status === 'Finished');

      if (processedJobs.length <= 0) return;

      const firstRun = processedJobs[0];
      const dateString = format(firstRun.stoppedAt!, 'yyyy-MM-dd');

      if (!result.has(dateString)) {
        result.set(dateString, { reRuns: 0, count: 0 });
      }
      const jobCount = result.get(dateString)!;

      result.set(dateString, { ...jobCount, count: jobCount.count + 1 });

      if (processedJobs.length > 1) {
        const reRunJobs = processedJobs.slice(1);

        reRunJobs.forEach((job) => {
          const dateString = format(job.stoppedAt!, 'yyyy-MM-dd');

          if (!result.has(dateString)) {
            result.set(dateString, { reRuns: 0, count: 0 });
          }
          const jobCount = result.get(dateString)!;

          result.set(dateString, { ...jobCount, reRuns: jobCount.reRuns + 1 });
        });
      }
    });
  });

  return new Map(Array.from(result).sort());
}

function parseSampleJobsToAoa(
  sampleJobMap: ReturnType<typeof parseSampleJobs>,
) {
  const result: (Date | string | number | undefined)[][] = [];

  sampleJobMap.forEach((samples, date) => {
    samples.forEach((sample, libId) => {
      const sampleRow = [
        new Date(date),
        sample.folder,
        libId,
        libId.split('-')[0],
        sample.fastq_fileKeys.length,
        sample.isTopUp ? 1 : 0,
      ];

      const jobs = sample.jobs.map(
        ({ name, project, pipeline, status, stoppedAt, elapsed }, index) => [
          ...sampleRow,
          name,
          project.name,
          // pipeline.name,
          // pipeline.version,
          status,
          stoppedAt,
          // elapsed,
          // index === 0 ? 0 : 1,
        ],
      );

      if (jobs.length > 0) {
        result.push(...jobs);
      } else {
        result.push(sampleRow);
      }
    });
  });

  result.unshift([
    'CPOS Upload Date',
    'Folder',
    'Lib ID',
    'Sample ID',
    'fastq count',
    'is top-up?',
    'DIG Job Name',
    'DIG Project Name',
    // 'DIG Pipeline',
    // 'DIG Pipeline Version',
    'DIG Job Status',
    'DIG Job Stopped At',
    // 'DIG Job Elapsed',
    // 'is re-run?',
  ]);

  return result;
}

function parseSampleStatToAoa(
  sampleStats: ReturnType<typeof parseSampleStats>,
) {
  const result: (Date | number | string)[][] = [];

  let total = 0;
  sampleStats.forEach((count, date) => {
    total += count;
    result.push([new Date(date), count, total]);
  });
  result.unshift(['CPOS Upload Date', 'Count', 'Total Input']);

  return result;
}

function parseSampleJobStatToAoa(
  sampleStats: ReturnType<typeof parseJobStats>,
) {
  const result: (Date | number | string)[][] = [];

  let totalProcessed = 0,
    totalReRuns = 0;
  sampleStats.forEach(({ reRuns, count }, date) => {
    if (count === 0) return;

    totalProcessed += count;
    totalReRuns += reRuns;
    result.push([
      new Date(date),
      count,
      // reRuns,
      totalProcessed,
      // totalReRuns,
      // totalProcessed + totalReRuns,
    ]);
  });
  result.unshift([
    'DIG Finished Date',
    'Processed',
    // 'Re-runs',
    'Total Processed',
    // 'Total Re-runs',
    // 'Total Finished',
  ]);

  return result;
}

async function main() {
  console.time('fetching data');
  const [digJobs, awsSamples] = await Promise.all([
    fetchJobs(),
    fetchS3ObjectList('hkgi-sample-data-prod'),
  ]);
  console.timeEnd('fetching data');

  console.time('parse sample map');
  const sampleMap = parseS3ObjectsToMap(awsSamples);
  console.timeEnd('parse sample map');

  console.time('parse job map');
  const jobMap = parseJobsToMap(digJobs);
  console.timeEnd('parse job map');

  console.time('parse sample job map');
  const sampleMapWithJobs = parseSampleJobs(sampleMap, jobMap);
  console.timeEnd('parse sample job map');

  console.time('parse data stats');
  const sampleStats = parseSampleStats(sampleMapWithJobs);
  const sampleJobStats = parseJobStats(sampleMapWithJobs);
  console.timeEnd('parse data stats');

  console.time('save data');
  saveAoaToXLSX(
    [
      {
        data: parseSampleStatToAoa(sampleStats),
      },
      {
        data: parseSampleJobStatToAoa(sampleJobStats),
      },
      {
        data: parseSampleJobsToAoa(sampleMapWithJobs),
      },
    ],
    `${__dirname}/output/${format(
      new Date(),
      'yyyyMMdd',
    )}_CPOS_input_DIG_processed.xlsx`,
  );
  console.timeEnd('save data');
}

main();
