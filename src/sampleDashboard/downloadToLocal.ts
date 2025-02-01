import fs from 'node:fs/promises';
import { PrismaClient } from '../../prisma/generated/dig_client';
import { fetchS3ObjectList } from '../common/awsFetches';

async function saveS3processedSamples() {
  const data = await fetchS3ObjectList(
    'pipeline-dev-nathan',
    'solo-pipeline-prod/',
    {
      timer: true,
      debug: true,
    },
  );

  await fs.writeFile(
    `${__dirname}/input_data/awsFiles.json`,
    JSON.stringify(data),
  );
}

async function saveS3sequencedSamples() {
  const data = await fetchS3ObjectList('hkgi-sample-data-prod', undefined, {
    timer: true,
    debug: true,
  });

  await fs.writeFile(
    `${__dirname}/input_data/s3SequencedSamples.json`,
    JSON.stringify(data),
  );
}

export async function saveDIGJobs() {
  const dig_prisma = new PrismaClient();
  const data = await dig_prisma.job.findMany({
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

  await fs.writeFile(
    `${__dirname}/input_data/digJobs.json`,
    JSON.stringify(data),
  );

  return data;
}

async function main() {
  await saveS3sequencedSamples();
  await saveDIGJobs();
}

if (require.main === module) {
  main();
}
