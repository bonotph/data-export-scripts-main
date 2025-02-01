import { format } from 'date-fns';

import { fetchS3ObjectList } from '../common/awsFetches';
import { saveAoaToXLSX } from '../common/saveToXLSX';
import { PrismaClient as DIG_PrismaClient } from '../../prisma/generated/dig_client';
import { PrismaClient as CF_PrismaClient } from '../../prisma/generated/cf_client';
import { PrismaClient as DB_PrismaClient } from '../../prisma/generated/db_client';

async function fetchS3Samples() {
  const data = await fetchS3ObjectList('hkgi-sample-data-prod', undefined, {
    timer: true,
  });

  return data;
}

function parseSamplesToBatchMap(
  sampleList: Awaited<ReturnType<typeof fetchS3Samples>>,
) {
  const result = new Map<
    string,
    { date: Date; samples: Map<string, { fastq: typeof sampleList }> }
  >();

  const FASTQ_REGEX =
    /^(\w*?)\/(\w*?)\/([a-z][a-z0-9].{9}-[0-9]{3}-LIB[0-9](-[0-9]*)*)_[0-9].fastq.gz/i;

  sampleList.forEach(({ key, lastModified }) => {
    const regexResult = FASTQ_REGEX.exec(key);

    if (!regexResult) return;

    const rootFolder = regexResult[1];
    const folder = regexResult[2];
    const libId = regexResult[3];
    const date = folder.split('_')[1];

    // filter out top-up and BC sampels
    // if (libId.endsWith('-2') || libId.startsWith('BC')) return;
    if (/-\d$/i.exec(libId)) return;
    if (/-R\d$/i.exec(libId)) return;
    if (folder.startsWith('KIT')) return;
    if (libId.startsWith('BC')) return;

    if (
      rootFolder === 'HKGI' &&
      [
        'HKGI_20220909',
        'HKGI_20220628',
        'HKGI_20230116_NOVA0016',
        'HKGI_20221125A',
        'HKGI_20230130_NOVA0013',
        'HKGI_20230420_NOVA0048',
      ].includes(folder)
    )
      return;

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

function parseBatchMapToAoa(
  batchMap: ReturnType<typeof parseSamplesToBatchMap>,
) {
  let total = 0;

  const result = Array.from(batchMap.entries())
    .sort((a, b) => a[1].date.getTime() - b[1].date.getTime())
    .reduce<(string | Date | number)[][]>((acc, cur) => {
      acc.push([
        cur[1].date,
        cur[0],
        cur[1].samples.size,
        (total += cur[1].samples.size),
      ]);
      return acc;
    }, []);

  result.unshift(['date', 'folder', 'count', 'total sequenced']);

  return result;
}

async function fetchDigJobs() {
  const digPrismaClient = new DIG_PrismaClient();
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
    // distinct: ['name'],
    orderBy: {
      stoppedAt: 'asc',
    },
  });

  return jobs.map(({ stoppedAt, ...rest }) => ({
    ...rest,
    stoppedAt: new Date(stoppedAt * 1000),
  }));
}

function parseJobsToDateMap(jobs: Awaited<ReturnType<typeof fetchDigJobs>>) {
  const result = new Map<string, typeof jobs>();

  jobs.forEach((job) => {
    const dateString = format(job.stoppedAt, 'yyyy-MM-dd');
    if (!result.has(dateString)) result.set(dateString, []);
    result.get(dateString)!.push(job);
  });

  return result;
}

function parseJobMapToAoa(jobMap: ReturnType<typeof parseJobsToDateMap>) {
  let total = 0;

  const result = Array.from(jobMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .reduce<(Date | string | number)[][]>((acc, cur) => {
      acc.push([new Date(cur[0]), cur[1].length, (total += cur[1].length)]);
      return acc;
    }, []);

  result.unshift(['date', 'count', 'total processed']);

  return result;
}

async function fetchCFResearchReport() {
  const cfClient = new CF_PrismaClient();

  const reports = await cfClient.file.findMany({
    select: {
      create_at: true,
      patient: {
        select: {
          hkgi_id: true,
          workspacePatient: {
            select: {
              workspace: {
                select: {
                  specimenPrefix: true,
                },
              },
            },
          },
        },
      },
    },
    where: {
      is_deleted: 0,
      type: 'Research Report',
      mime_type: 'application/pdf',
      patient: {
        referHospital: {
          in: ['HKCH', 'PWH', 'QMH', 'HKW'],
        },
      },
      user: {
        hkgi: 1,
      },
    },
    orderBy: {
      create_at: 'asc',
    },
    // distinct: ['patient_id'],
  });

  return reports.map(({ create_at, ...rest }) => ({
    create_at: new Date(create_at * 1000),
    ...rest,
  }));
}

function parseCFReportToDateMap(
  cfReports: Awaited<ReturnType<typeof fetchCFResearchReport>>,
) {
  const result = cfReports.reduce<Map<string, typeof cfReports>>((acc, cur) => {
    const dateString = format(cur.create_at, 'yyyy-MM-dd');

    if (!acc.has(dateString)) acc.set(dateString, []);
    acc.get(dateString)!.push(cur);

    return acc;
  }, new Map());

  return result;
}

function parseReportMapToAoa(
  reportMap: ReturnType<typeof parseCFReportToDateMap>,
) {
  let total = 0;
  const result = Array.from(reportMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .reduce<(Date | number | string)[][]>((acc, cur) => {
      acc.push([new Date(cur[0]), cur[1].length, (total += cur[1].length)]);

      return acc;
    }, []);

  result.unshift(['date', 'count', 'total research report']);

  return result;
}

async function fetchVarAppData() {
  const dbPrismaClient = new DB_PrismaClient();

  const data = await dbPrismaClient.varapp_family.findMany({
    select: {
      file_name: true,
      sample_ids: true,
      mtime: true,
    },
    where: {
      entry_is_deleted: false,
      varapp_family_ignore: {
        is: null,
      },
    },
  });

  return data;

  // const data = VARAPP_DATA.map(({ mtime, ...rest }) => ({
  //   ...rest,
  //   mtime: new Date(mtime),
  // })).filter(
  //   ({ mtime, samples }) =>
  //     mtime >= new Date('2022-03-01') &&
  //     !samples.some((libId) => libId.startsWith('W')),
  // );

  // return data;
}

function parseVarAppToDateMap(
  data: Awaited<ReturnType<typeof fetchVarAppData>>,
) {
  const result = data.reduce<Map<string, typeof data>>((acc, cur) => {
    const dateString = format(cur.mtime, 'yyyy-MM-dd');

    if (!acc.has(dateString)) acc.set(dateString, []);
    acc.get(dateString)!.push(cur);

    return acc;
  }, new Map());

  return result;
}

function parseVarAppMapToAoa(data: ReturnType<typeof parseVarAppToDateMap>) {
  let total = 0;
  const result = Array.from(data.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .reduce<(Date | number | string)[][]>((acc, cur) => {
      const sampleCount = cur[1].reduce<number>((acc, cur) => {
        return acc + cur.sample_ids.length;
      }, 0);

      acc.push([new Date(cur[0]), sampleCount, (total += sampleCount)]);

      return acc;
    }, []);

  result.unshift(['date', 'count', 'total in VarApp']);

  return result;
}

function parseJobsToSampleIdMap(
  jobs: Awaited<ReturnType<typeof fetchDigJobs>>,
) {
  const result = jobs.reduce<Map<string, typeof jobs>>((acc, cur) => {
    if (!acc.has(cur.name)) acc.set(cur.name, []);
    acc.get(cur.name)!.push(cur);

    return acc;
  }, new Map());

  return result;
}

function parseVarAppToSampleIdMap(
  varappData: Awaited<ReturnType<typeof fetchVarAppData>>,
) {
  const result = varappData.reduce<Map<string, typeof varappData>>(
    (acc, cur) => {
      cur.sample_ids.forEach((sampleId) => {
        if (!acc.has(sampleId)) acc.set(sampleId, []);
        acc.get(sampleId)!.push(cur);
      });

      return acc;
    },
    new Map(),
  );

  return result;
}

function parseResearchReportToSampleIdMap(
  researchReports: Awaited<ReturnType<typeof fetchCFResearchReport>>,
) {
  return researchReports.reduce<Map<string, typeof researchReports>>(
    (acc, cur) => {
      const sampleId =
        cur.patient.workspacePatient?.workspace.specimenPrefix +
        cur.patient.hkgi_id.slice(2);

      if (!acc.has(sampleId)) acc.set(sampleId, []);
      acc.get(sampleId)!.push(cur);

      return acc;
    },
    new Map(),
  );
}

function joinSampleBatchesAndJobAndVarAppAndReport(
  samples: ReturnType<typeof parseSamplesToBatchMap>,
  jobMap: ReturnType<typeof parseJobsToSampleIdMap>,
  familyMap: ReturnType<typeof parseVarAppToSampleIdMap>,
  researchReportMap: ReturnType<typeof parseResearchReportToSampleIdMap>,
) {
  const result = new Map<
    string,
    {
      date: Date;
      samples: Map<
        string,
        ((typeof samples extends Map<any, infer V>
          ? V
          : never)['samples'] extends Map<any, infer V>
          ? V
          : never) & {
          digJobs: typeof jobMap extends Map<any, infer V> ? V : never;
          varappFamilies: typeof familyMap extends Map<any, infer V>
            ? V
            : never;
          researchReports: typeof researchReportMap extends Map<any, infer V>
            ? V
            : never;
        }
      >;
    }
  >();

  samples.forEach(({ date, samples }, folder) => {
    if (!result.has(folder)) result.set(folder, { date, samples: new Map() });

    const batchSamples = result.get(folder)!.samples;

    samples.forEach((sample, libId) => {
      if (!batchSamples.has(libId))
        batchSamples.set(libId, {
          fastq: sample.fastq,
          digJobs: [],
          varappFamilies: [],
          researchReports: [],
        });

      const resultSample = batchSamples.get(libId)!;

      const digJobs = jobMap.get(libId);
      if (digJobs) {
        resultSample.digJobs.push(...digJobs);
      }

      const varappLibId = libId.replaceAll('-', '_');
      const varappFamilies = familyMap.get(varappLibId);
      if (varappFamilies) {
        resultSample.varappFamilies.push(...varappFamilies);
      }
    });
  });

  // iterate thru each sample
  Array.from(result.values()).forEach(({ samples }) => {
    samples.forEach(({ researchReports }, libId) => {
      // convert LIB ID to hkgi lab ID
      const researchReportId = libId.slice(0, 8);

      const reports = researchReportMap.get(researchReportId);
      if (!reports) return;

      // find relevant family members via VarApp
      const varappLibId = libId.slice(0, 20).replaceAll('-', '_');
      const varappFamilies = familyMap.get(varappLibId)!;

      // iterate thru each family members
      varappFamilies.forEach(({ sample_ids }) => {
        sample_ids.forEach((sample) => {
          // if current sample is the member, just add the report to itself
          if (sample === varappLibId) {
            researchReports.push(...reports);
          } else {
            const sampleId = sample.replaceAll('_', '-');

            // go thru each sample in result to find the sample to add the report
            Array.from(result.values()).forEach(({ samples }) => {
              const member = samples.get(sampleId);
              if (!member) return;

              member.researchReports.push(...reports);
            });
          }
        });
      });
    });
  });

  return result;
}

type ExcelSheet = (Date | string | number)[][];

function parseDigJobStatToAoa(
  result: ReturnType<typeof joinSampleBatchesAndJobAndVarAppAndReport>,
) {
  const statMap = new Map<string, number>();

  result.forEach(({ samples }) => {
    samples.forEach(({ digJobs }) => {
      if (digJobs.length > 0) {
        const firstJob = digJobs.sort(
          (a, b) => a.stoppedAt.getTime() - b.stoppedAt.getTime(),
        )[0];
        const dateString = format(firstJob.stoppedAt, 'yyyy-MM-dd');

        if (!statMap.has(dateString)) statMap.set(dateString, 0);
        const jobCount = statMap.get(dateString)!;

        statMap.set(dateString, jobCount + 1);
      }
    });
  });

  let totalJobs = 0;
  const resultAoa = Array.from(statMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .reduce<(Date | number | string)[][]>((acc, cur) => {
      acc.push([new Date(cur[0]), cur[1], (totalJobs += cur[1])]);
      return acc;
    }, []);

  resultAoa.unshift(['date', 'count', 'total processed']);

  return resultAoa;
}

function parseSampleResultToStatsAoa(
  result: ReturnType<typeof joinSampleBatchesAndJobAndVarAppAndReport>,
) {
  const sampleDateStat: ExcelSheet = [];

  let totalSamples = 0;
  Array.from(result.entries())
    .sort((a, b) => a[1].date.getTime() - b[1].date.getTime())
    .forEach(([folder, { date, samples }]) => {
      sampleDateStat.push([
        date,
        folder,
        samples.size,
        Array.from(samples.values()).filter(({ digJobs }) => digJobs.length > 0)
          .length,
        Array.from(samples.values()).filter(
          ({ digJobs, varappFamilies }) =>
            digJobs.length > 0 || varappFamilies.length > 0,
        ).length,
        Array.from(samples.values()).filter(
          ({ varappFamilies }) => varappFamilies.length > 0,
        ).length,
        Array.from(samples.values()).filter(
          ({ researchReports }) => researchReports.length > 0,
        ).length,
        (totalSamples += samples.size),
      ]);
    });

  sampleDateStat.unshift([
    'date',
    'folder',
    'count',
    'finished in DIG',
    'processed (DIG || VarApp)',
    'in varapp',
    'has research report',
    'total sequenced',
  ]);

  return sampleDateStat;
}

function parseDIG_StatToAoa(
  result: ReturnType<typeof joinSampleBatchesAndJobAndVarAppAndReport>,
) {
  const statMap = new Map<string, number>();

  result.forEach(({ samples }) => {
    samples.forEach(({ digJobs }) => {
      const firstJob = digJobs.sort(
        (a, b) => a.stoppedAt.getTime() - b.stoppedAt.getTime(),
      )[0];

      if (!firstJob) return;

      const dateString = format(firstJob.stoppedAt, 'yyyy-MM-dd');

      if (!statMap.has(dateString)) statMap.set(dateString, 0);
      const jobCount = statMap.get(dateString)!;

      statMap.set(dateString, jobCount + 1);
    });
  });

  let totalJobs = 0;
  const resultAoa = Array.from(statMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .reduce<(Date | number | string)[][]>((acc, cur) => {
      acc.push([new Date(cur[0]), cur[1], (totalJobs += cur[1])]);
      return acc;
    }, []);

  resultAoa.unshift(['date', 'count', 'total processed by DIG']);

  return resultAoa;
}

function parseJobStatToAoa(
  result: ReturnType<typeof joinSampleBatchesAndJobAndVarAppAndReport>,
) {
  const statMap = new Map<string, number>();

  result.forEach(({ samples }) => {
    samples.forEach(({ digJobs, varappFamilies }) => {
      const firstVarappFamily = varappFamilies.sort(
        (a, b) => a.mtime.getTime() - b.mtime.getTime(),
      )[0];

      const firstJob = digJobs.sort(
        (a, b) => a.stoppedAt.getTime() - b.stoppedAt.getTime(),
      )[0];

      let firstCompleteTime: Date | null = null;

      if (firstVarappFamily && firstJob) {
        firstCompleteTime =
          firstVarappFamily.mtime.getTime() < firstJob.stoppedAt.getTime()
            ? firstVarappFamily.mtime
            : firstJob.stoppedAt;
      } else if (firstJob) {
        firstCompleteTime = firstJob.stoppedAt;
      } else if (firstVarappFamily) {
        firstCompleteTime = firstVarappFamily.mtime;
      }

      if (!firstCompleteTime) return;

      const dateString = format(firstCompleteTime, 'yyyy-MM-dd');

      if (!statMap.has(dateString)) statMap.set(dateString, 0);
      const jobCount = statMap.get(dateString)!;

      statMap.set(dateString, jobCount + 1);
    });
  });

  let totalJobs = 0;
  const resultAoa = Array.from(statMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .reduce<(Date | number | string)[][]>((acc, cur) => {
      acc.push([new Date(cur[0]), cur[1], (totalJobs += cur[1])]);
      return acc;
    }, []);

  resultAoa.unshift(['date', 'count', 'total processed']);

  return resultAoa;
}

function parseVarAppStatToAoa(
  result: ReturnType<typeof joinSampleBatchesAndJobAndVarAppAndReport>,
) {
  const statMap = new Map<string, number>();

  result.forEach(({ samples }) => {
    samples.forEach(({ varappFamilies }) => {
      if (varappFamilies.length > 0) {
        const firstVarappFamily = varappFamilies.sort(
          (a, b) => a.mtime.getTime() - b.mtime.getTime(),
        )[0];

        const dateString = format(firstVarappFamily.mtime, 'yyyy-MM-dd');

        if (!statMap.has(dateString)) statMap.set(dateString, 0);
        const jobCount = statMap.get(dateString)!;

        statMap.set(dateString, jobCount + 1);
      }
    });
  });

  let totalVarapp = 0;
  const resultAoa = Array.from(statMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .reduce<(Date | number | string)[][]>((acc, cur) => {
      acc.push([new Date(cur[0]), cur[1], (totalVarapp += cur[1])]);
      return acc;
    }, []);

  resultAoa.unshift(['date', 'count', 'total in varapp']);

  return resultAoa;
}

function parseReportStatToAoa(
  result: ReturnType<typeof joinSampleBatchesAndJobAndVarAppAndReport>,
) {
  const statMap = new Map<string, number>();

  result.forEach(({ samples }) => {
    samples.forEach(({ researchReports }) => {
      if (researchReports.length > 0) {
        const firstReport = researchReports.sort(
          (a, b) => a.create_at.getTime() - b.create_at.getTime(),
        )[0];

        const dateString = format(firstReport.create_at, 'yyyy-MM-dd');

        if (!statMap.has(dateString)) statMap.set(dateString, 0);
        const jobCount = statMap.get(dateString)!;

        statMap.set(dateString, jobCount + 1);
      }
    });
  });

  let totalReport = 0;
  const resultAoa = Array.from(statMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .reduce<(Date | number | string)[][]>((acc, cur) => {
      acc.push([new Date(cur[0]), cur[1], (totalReport += cur[1])]);
      return acc;
    }, []);

  resultAoa.unshift(['date', 'count', 'total with report']);

  return resultAoa;
}

async function main() {
  const sampleBatches = parseSamplesToBatchMap(await fetchS3Samples());
  const jobMap = parseJobsToSampleIdMap(await fetchDigJobs());
  const familyMap = parseVarAppToSampleIdMap(await fetchVarAppData());
  const researchReportMap = parseResearchReportToSampleIdMap(
    await fetchCFResearchReport(),
  );

  const sampleIds = Array.from(sampleBatches.values())
    .map(({ samples }) => {
      return [...samples.keys()];
    })
    .flat();

  console.log(new Set(sampleIds).size);

  const result = joinSampleBatchesAndJobAndVarAppAndReport(
    sampleBatches,
    jobMap,
    familyMap,
    researchReportMap,
  );

  saveAoaToXLSX(
    [
      {
        data: parseSampleResultToStatsAoa(result),
        name: 'sequenced_pc_samples',
      },
      {
        data: parseDIG_StatToAoa(result),
        name: 'dig',
      },
      {
        data: parseJobStatToAoa(result),
        name: 'processed',
      },
      {
        data: parseVarAppStatToAoa(result),
        name: 'varapp',
      },
      {
        data: parseReportStatToAoa(result),
        name: 'report',
      },
    ],
    `${__dirname}/output/${format(
      new Date(),
      'yyyyMMdd_HHmmss',
    )}_pcSampleOverview.xlsx`,
  );
}

if (require.main === module) {
  main();
}
