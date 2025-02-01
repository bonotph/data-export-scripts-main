import { format } from 'date-fns';
import { saveAoaToXLSX } from '../common/saveToXLSX';
import { fetchS3ObjectList } from './awsFetches';
import { AWSResult } from './types';
import { PrismaClient as DIG_PrismaClient } from '../../prisma/generated/dig_client';

function parseSampleMap(data: AWSResult) {
  const result: typeof data = new Map();

  data.forEach(({ lastModified }, key) => {
    const regexPattern =
      /.*([a-z][a-z0-9].{9}-[0-9]{3}-LIB[0-9](-[0-9]*)*).*/gi;
    const regExpResults = regexPattern.exec(key);

    if (!regExpResults) return;
    if (!(lastModified <= new Date('2023-04-06'))) return;

    const libId = regExpResults[1];
    if (result.has(libId)) {
      const existingDate = result.get(libId)!;
      result.set(libId, {
        lastModified:
          existingDate.lastModified > lastModified
            ? existingDate.lastModified
            : lastModified,
      });
    } else {
      result.set(libId, { lastModified });
    }
  });

  return result;
}

function parseFolderSamples(data: AWSResult) {
  const folderMap = new Map<
    string,
    { sampleId: string; mandatoryQC: string; monitorQC: string; manta: string }
  >();
  const sampleIdMap = new Map<
    string,
    { folders: Set<string>; mandatoryQC: Set<string>; monitorQC: Set<string> }
  >();

  data.forEach(({ lastModified }, fileKey) => {
    const regexPattern =
      /solo-pipeline-prod\/(.*?)\/.*([a-z][a-z0-9].{9}-[0-9]{3}-LIB[0-9](-[0-9]*)*)_*(Mandatory_Bam_QC)*(Monitor_Bam_QC)*.*/gi;

    const regExpResults = regexPattern.exec(fileKey);

    if (!regExpResults) return;

    const folder = regExpResults[1];
    const libId = regExpResults[2];
    const mandatoryQC = regExpResults[4];
    const monitorQC = regExpResults[5];

    if (!folderMap.has(folder)) {
      folderMap.set(folder, {} as any);
    }

    folderMap.get(folder)!.sampleId = libId;

    if (!sampleIdMap.has(libId)) {
      sampleIdMap.set(libId, {
        folders: new Set(),
        mandatoryQC: new Set(),
        monitorQC: new Set(),
      });
    }

    const sampleEntry = sampleIdMap.get(libId);
    sampleEntry!.folders.add(folder);
    if (mandatoryQC) {
      sampleEntry!.mandatoryQC.add(folder);
    }
    if (monitorQC) {
      sampleEntry!.monitorQC.add(folder);
    }
  });

  return [folderMap, sampleIdMap] as const;
}

// async function main() {
//   const awsFileList = await fetchS3ObjectList(
//     'pipeline-dev-nathan',
//     'solo-pipeline-prod/',
//     { timer: true },
//   );

//   console.log(awsFileList.size);

//   console.time('parse aws file list to map');
//   const parsedSamples = parseSampleMap(awsFileList);

//   const [folderMap, sampleIdMap] = parseFolderSamples(awsFileList);
//   console.timeEnd('parse aws file list to map');

//   console.time('map to AOA');
//   const awsFilesAoa: (string | Date)[][] = [];
//   awsFileList.forEach(({ lastModified }, key) => {
//     awsFilesAoa.push([lastModified, key]);
//   });

//   awsFilesAoa.unshift(['Last Modified', 'Object key']);

//   const resultAoa: (string | Date)[][] = [];
//   parsedSamples.forEach(({ lastModified }, key) => {
//     resultAoa.push([lastModified, key]);
//   });
//   resultAoa.unshift(['Last Modified', 'Lib ID']);

//   const folderSamplesAoa: (string | number)[][] = [];
//   folderMap.forEach((samples, folder) => {
//     folderSamplesAoa.push([
//       folder,
//       samples.size,
//       Array.from(samples).join(', '),
//     ]);
//   });
//   folderSamplesAoa.unshift(['folder', 'samples count', 'samples']);

//   const sampleFoldersAoa: (string | number)[][] = [];
//   sampleIdMap.forEach(({ folders, mandatoryQC, monitorQC }, sampleId) => {
//     sampleFoldersAoa.push([
//       sampleId,
//       folders.size,
//       Array.from(folders).join(', '),
//       mandatoryQC.size,
//       Array.from(mandatoryQC).join(', '),
//       monitorQC.size,
//       Array.from(monitorQC).join(', '),
//     ]);
//   });
//   sampleFoldersAoa.unshift([
//     'sampleId',
//     'folders count',
//     'folders',
//     'mandatory qc',
//     'mandatory qc folder',
//     'monitor qc',
//     'monitor qc folder',
//   ]);
//   console.timeEnd('map to AOA');

//   console.time('save to xlsx');
//   saveAoaToXLSX(
//     [
//       { data: resultAoa, name: 'processed_samples' },
//       { data: awsFilesAoa, name: 'aws_object_list' },
//       { data: folderSamplesAoa, name: 'folder_samples' },
//       { data: sampleFoldersAoa, name: 'samples_folder' },
//     ],
//     `${__dirname}/output/${format(
//       new Date(),
//       'yyyyMMdd_HHmmss',
//     )}_aws_result.xlsx`,
//   );
//   console.timeEnd('save to xlsx');
// }

async function fetchDIGJobs() {
  const dig_client = new DIG_PrismaClient();

  const db_result = await dig_client.job.findMany({
    select: {
      name: true,
      stoppedAt: true,
    },
    where: {
      name: {
        contains: 'LIB',
      },
      status: {
        equals: 2,
      },
      isDeleted: false,
      project: {
        // OR: [
        //   {
        //     name: {
        //       startsWith: 'CPOS',
        //     },
        //   },
        //   {
        //     name: {
        //       startsWith: 'KIT',
        //     },
        //   },
        // ],
        workspace: {
          name: {
            in: ['CPOS', 'HKGI'],
            // equals: 'CPOS',
          },
        },
      },
    },
  });

  return db_result
    .map(({ stoppedAt, ...rest }) => ({
      ...rest,
      stoppedAt: new Date(stoppedAt * 1000),
    }))
    .sort((a, b) => a.stoppedAt.getTime() - b.stoppedAt.getTime());
}

async function main1() {
  const awsFileList = await fetchS3ObjectList(
    'pipeline-dev-nathan',
    'solo-pipeline-prod/',
    { timer: true },
  );

  const sequencedSamples = parseSampleMap(awsFileList);
  // console.log(sequencedSamples.size);

  const digJobs = await fetchDIGJobs();

  const result = new Set([
    ...sequencedSamples.keys(),
    ...digJobs.map(({ name }) => name),
  ]);

  console.log(result);
  console.log(result.size);
}

// main();
main1();
