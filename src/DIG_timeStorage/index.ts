import { format } from 'date-fns';
import { PrismaClient } from '../../prisma/generated/dig_client';
import { saveAoaToXLSX } from '../common/saveToXLSX';

const digClient = new PrismaClient();

async function fetch_fq2vcf_jobs() {
  return digClient.job.findMany({
    select: {
      name: true,
      createdAt: true,
      startedAt: true,
      stoppedAt: true,
      pipeline: {
        select: {
          name: true,
          version: true,
        },
      },
      nodesStatus: true,
      file: {
        select: {
          size: true,
        },
        where: {
          isDeleted: {
            equals: false,
          },
        },
      },
    },
    where: {
      name: {
        contains: 'LIB',
      },
      isDeleted: {
        equals: false,
      },
      status: {
        equals: 2,
      },
      pipeline: {
        name: {
          equals: 'fq2vcf+SV',
        },
      },
      project: {
        name: {
          notIn: ['pre_production_testing', 'test_78x'],
        },
        workspace: {
          name: {
            in: ['HKGI', 'CPOS'],
          },
        },
      },
    },
    orderBy: {
      stoppedAt: 'desc',
    },
  });
}

async function fetch_fjcalling_jobs() {
  return digClient.job.findMany({
    select: {
      name: true,
      createdAt: true,
      startedAt: true,
      stoppedAt: true,
      pipeline: {
        select: {
          name: true,
          version: true,
        },
      },
      nodesStatus: true,
      file: {
        select: {
          size: true,
        },
        where: {
          isDeleted: {
            equals: false,
          },
        },
      },
      job_input_file: {
        select: {
          file: {
            select: {
              name: true,
              size: true,
            },
          },
        },
        where: {
          file: {
            isDeleted: {
              equals: false,
            },
            name: {
              endsWith: '.g.vcf.gz.tar',
            },
          },
        },
      },
    },
    where: {
      isDeleted: {
        equals: false,
      },
      status: {
        equals: 2,
      },
      pipeline: {
        name: {
          contains: 'fjcalling+upload2s3',
        },
      },
      project: {
        workspace: {
          name: {
            in: ['Joint Calling'],
          },
        },
      },
    },
    orderBy: {
      stoppedAt: 'desc',
    },
  });
}

async function fetch_congenica_jobs() {
  return digClient.job.findMany({
    select: {
      name: true,
      createdAt: true,
      startedAt: true,
      stoppedAt: true,
      pipeline: {
        select: {
          name: true,
          version: true,
        },
      },
      nodesStatus: true,
      file: {
        select: {
          size: true,
        },
        where: {
          isDeleted: {
            equals: false,
          },
        },
      },
      job_input_file: {
        select: {
          file: {
            select: {
              name: true,
              size: true,
            },
          },
        },
        where: {
          file: {
            isDeleted: {
              equals: false,
            },
            AND: [
              {
                name: {
                  endsWith: '.vcf',
                },
              },
              {
                name: {
                  not: {
                    endsWith: 'final.vcf',
                  },
                },
              },
            ],
          },
        },
      },
    },
    where: {
      isDeleted: {
        equals: false,
      },
      status: {
        equals: 2,
      },
      // project: {
      //   workspace: {
      //     name: {
      //       in: ['Congenica Staging'],
      //     },
      //   },
      //   name: '2023-05-29',
      // },
      pipeline: {
        name: {
          contains: 'Congenica',
        },
      },
    },
    orderBy: {
      stoppedAt: 'desc',
    },
  });
}

function parse_fq2vcf_jobs(
  jobs: Awaited<ReturnType<typeof fetch_fq2vcf_jobs>>,
) {
  return jobs.map(
    ({ createdAt, startedAt, stoppedAt, nodesStatus, file, ...rest }) => {
      const parsedNodeStatus = JSON.parse(nodesStatus as string) as {
        [key: string]: { elapsedTime: string; status: string };
      };

      const elapsed = Object.values(parsedNodeStatus).reduce(
        (acc, { elapsedTime }) => acc + parseInt(elapsedTime),
        0,
      );

      return {
        ...rest,
        createdAt: new Date(createdAt * 1000),
        startedAt: new Date(startedAt * 1000),
        stoppedAt: new Date(stoppedAt * 1000),
        elapsed,
        file: file.map(({ size }) => ({ size: Number(size) * 1e-9 })),
      };
    },
  );
}

function parse_fjcalling_jobs(
  jobs: Awaited<ReturnType<typeof fetch_fjcalling_jobs>>,
) {
  return jobs.map(
    ({ createdAt, startedAt, stoppedAt, nodesStatus, file, ...rest }) => {
      const parsedNodeStatus = JSON.parse(nodesStatus as string) as {
        [key: string]: { elapsedTime: string; status: string };
      };

      const elapsed = Object.values(parsedNodeStatus).reduce(
        (acc, { elapsedTime }) => acc + parseInt(elapsedTime),
        0,
      );

      return {
        ...rest,
        createdAt: new Date(createdAt * 1000),
        startedAt: new Date(startedAt * 1000),
        stoppedAt: new Date(stoppedAt * 1000),
        elapsed,
        file: file.map(({ size }) => ({ size: Number(size) * 1e-9 })),
      };
    },
  );
}

function parse_congenica_jobs(
  jobs: Awaited<ReturnType<typeof fetch_fjcalling_jobs>>,
) {
  return jobs.map(
    ({ createdAt, startedAt, stoppedAt, nodesStatus, file, ...rest }) => {
      const parsedNodeStatus = JSON.parse(nodesStatus as string) as {
        [key: string]: { elapsedTime: string; status: string };
      };

      const elapsed = Object.values(parsedNodeStatus).reduce(
        (acc, { elapsedTime }) => acc + parseInt(elapsedTime),
        0,
      );

      return {
        ...rest,
        createdAt: new Date(createdAt * 1000),
        startedAt: new Date(startedAt * 1000),
        stoppedAt: new Date(stoppedAt * 1000),
        elapsed,
        nodeStatus: Object.entries(parsedNodeStatus).map(
          ([name, nodeStatus]) => ({
            name,
            ...nodeStatus,
          }),
        ),
        file: file.map(({ size }) => ({ size: Number(size) * 1e-9 })),
      };
    },
  );
}

function parse_fq2vcf_jobsToAoa(jobs: ReturnType<typeof parse_fq2vcf_jobs>) {
  const data: (string | number | Date)[][] = jobs.map(
    ({ pipeline, name, createdAt, startedAt, stoppedAt, elapsed, file }) => [
      pipeline.name,
      pipeline.version,
      name,
      /.*-lib\d-\d/i.exec(name) ? 1 : 0,
      createdAt,
      startedAt,
      stoppedAt,
      elapsed,
      file.reduce((acc, { size }) => acc + size, 0),
    ],
  );

  data.unshift([
    'pipeline name',
    'pipeline version',
    'job name',
    'is top-up?',
    'created at',
    'started at',
    'stopped at',
    'elapsed(s)',
    'total output file size(GB)',
  ]);

  return data;
}

function parse_fjcalling_JobsToAoa(
  jobs: ReturnType<typeof parse_fjcalling_jobs>,
) {
  const data: (string | number | Date)[][] = jobs.map(
    ({
      pipeline,
      name,
      createdAt,
      startedAt,
      stoppedAt,
      elapsed,
      file,
      job_input_file,
    }) => [
      pipeline.name,
      pipeline.version,
      name,
      createdAt,
      startedAt,
      stoppedAt,
      job_input_file.length,
      elapsed,
      file.reduce((acc, { size }) => acc + size, 0),
    ],
  );

  data.unshift([
    'pipeline name',
    'pipeline version',
    'job name',
    'created at',
    'started at',
    'stopped at',
    'input sample count',
    'elapsed(s)',
    'total output file size(GB)',
  ]);

  return data;
}

function parse_congenica_JobsToAoa(
  jobs: ReturnType<typeof parse_congenica_jobs>,
) {
  const data: (string | number | Date)[][] = jobs.map(
    ({
      pipeline,
      name,
      createdAt,
      startedAt,
      stoppedAt,
      elapsed,
      file,
      job_input_file,
      nodeStatus,
    }) => [
      pipeline.name,
      pipeline.version,
      name,
      createdAt,
      startedAt,
      stoppedAt,
      job_input_file.length,
      elapsed,
      file.reduce((acc, { size }) => acc + size, 0),
      ...nodeStatus.map(({ name }) => name),
      ...nodeStatus.map(({ elapsedTime }) => elapsedTime),
    ],
  );

  data.unshift([
    'pipeline name',
    'pipeline version',
    'job name',
    'created at',
    'started at',
    'stopped at',
    'input sample count',
    'elapsed(s)',
    'total output file size(GB)',
  ]);

  return data;
}

async function main() {
  console.time('fetch from dig db');
  const [fq2vcf_jobs, fjcalling_jobs, congenica_jobs] = await Promise.all([
    parse_fq2vcf_jobs(await fetch_fq2vcf_jobs()),
    parse_fjcalling_jobs(await fetch_fjcalling_jobs()),
    parse_congenica_jobs(await fetch_congenica_jobs()),
  ]);
  console.timeEnd('fetch from dig db');

  console.log(fq2vcf_jobs.length);
  console.log(fjcalling_jobs.length);
  console.log(congenica_jobs.length);

  saveAoaToXLSX(
    [
      { data: parse_fq2vcf_jobsToAoa(fq2vcf_jobs), name: 'fq2vcf' },
      {
        data: parse_fjcalling_JobsToAoa(fjcalling_jobs),
        name: 'fjcalling',
      },
      {
        data: parse_congenica_JobsToAoa(congenica_jobs),
        name: 'congenica',
      },
    ],
    `${__dirname}/output/${format(
      new Date(),
      'yyyyMMdd_HHmmss',
    )}_dig_resources.xlsx`,
  );
}

if (require.main === module) {
  main();
}
