import { PrismaClient as DIG_PrismaClient } from '../../prisma/generated/dig_client';

const samples = [
  'A0001956B01-001-LIB1',
  'A0001959B01-001-LIB1',
  'A0001966B01-001-LIB1',
  'A0001967B01-001-LIB1',
  'A0001968B01-001-LIB1',
  'A0001970B01-001-LIB1',
  'A0001978B01-001-LIB1',
  'A0001989B03-001-LIB1',
  'A0001990B01-001-LIB1',
  'A0001991B01-001-LIB1',
  'A0002030B01-001-LIB1',
  'A0002058B01-001-LIB1',
  'A0002062B01-001-LIB1',
  'A0002067B01-001-LIB1',
  'A0002072B01-001-LIB1',
  'A0002073B01-001-LIB1',
  'A0002096B01-001-LIB1',
  'B0001944B01-001-LIB1',
  'B0001945B01-001-LIB1',
  'B0001957B01-001-LIB1',
  'B0001958B01-001-LIB1',
  'B0001960B01-001-LIB1',
  'B0001983B01-001-LIB1',
  'B0002013B01-001-LIB1',
  'B0002014B01-001-LIB1',
  'B0002017B01-001-LIB1',
  'B0002015B01-001-LIB1',
  'B0002016B01-001-LIB1',
  'B0002018B01-001-LIB1',
  'B0002020B01-001-LIB1',
  'B0002019B01-001-LIB1',
  'B0002050B01-001-LIB1',
  'B0002051B01-001-LIB1',
  'B0002057B01-001-LIB1',
  'B0002063B01-001-LIB1',
  'B0002064B01-001-LIB1',
  'B0002065B01-001-LIB1',
  'C0001941B01-001-LIB1',
  'C0001942B01-001-LIB1',
  'C0001974B01-001-LIB1',
  'C0001979B01-001-LIB1',
  'C0001985B01-001-LIB1',
  'C0002000B01-001-LIB1',
  'C0002001B01-001-LIB1',
  'C0002002B01-001-LIB1',
  'C0002003B01-001-LIB1',
  'C0002038B01-001-LIB1',
  'C0002054B01-001-LIB1',
];

const dig_prisma = new DIG_PrismaClient();

async function main() {
  const digSamples = await dig_prisma.job.findMany({
    select: {
      name: true,
      project: {
        select: {
          name: true,
        },
      },
      status: true,
    },
    where: {
      isDeleted: {
        equals: false,
      },
      project: {
        workspace: {
          name: {
            in: ['CPOS'],
          },
        },
      },
    },
  });

  const result: any[] = [];
  // console.log(samples.length);
  // console.log(new Set(samples).size);
  // samples.forEach((sample) => {
  //   if (!digSamples.some((job) => job.name === sample)) {
  //     console.log(sample);
  //   }
  // });
  const sampleSet = new Set(samples);
  digSamples.forEach((job) => {
    if (sampleSet.has(job.name)) {
      result.push(job);
    }
  });

  console.log(result);
  console.log(result.length);
}

main();
