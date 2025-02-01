import { format } from 'date-fns';
import { saveAoaToXLSX } from '../common/saveToXLSX';
import { fetchS3ObjectList } from '../common/awsFetches';

function parseS3ObjectListToAoa(
  objects: Awaited<ReturnType<typeof fetchS3ObjectList>>,
) {
  const result = objects.map(({ key, lastModified }) => [lastModified, key]);

  result.unshift(['last modified', 's3 key']);

  return result;
}

function parseObjectsToFolderMap(
  objects: Awaited<ReturnType<typeof fetchS3ObjectList>>,
) {
  const result = new Map<
    string,
    {
      libId?: string;
      alignment: string[];
      haplotypeCaller: string[];
      surveyor: string[];
      survindel2: string[];
      str: {
        vcf: string[];
        reviewer: string[];
      };
      qc: string[];
      smallVariant: string[];
      cnv: string[];
      manta: string[];
    }
  >();

  const regexPattern = /solo-pipeline-prod\/(.*?)\/(.*)/i;
  const libIdPattern = /.*([a-z][a-z0-9].{9}-[0-9]{3}-LIB[0-9](-[0-9]*)*)(.*)/i;
  const cnvPattern =
    /CNV_calls\/[a-z][a-z0-9].{9}-[0-9]{3}-LIB[0-9](-[0-9]*)*.cnv.vcf/i;

  objects.forEach(({ key, lastModified }) => {
    const regExpResults = regexPattern.exec(key);

    if (!regExpResults) return;

    const folder = regExpResults[1];
    const remainingPath = regExpResults[2];

    if (!result.has(folder)) {
      result.set(folder, {
        alignment: [],
        haplotypeCaller: [],
        surveyor: [],
        survindel2: [],
        str: {
          vcf: [],
          reviewer: [],
        },
        qc: [],
        smallVariant: [],
        cnv: [],
        manta: [],
      });
    }

    const resultFolder = result.get(folder)!;
    const libIdResult = libIdPattern.exec(regExpResults[2]);

    if (libIdResult) {
      // add lib id
      const libId = libIdResult[1];
      resultFolder.libId = libId;

      const fileExtension = libIdResult[3];

      if (fileExtension === '.bam') resultFolder.alignment.push(key);
      if (fileExtension === '.g.vcf.gz') resultFolder.haplotypeCaller.push(key);
      if (fileExtension === '.surveyor.pass.vcf.gz')
        resultFolder.surveyor.push(key);
      if (fileExtension === '.survindel2.pass.vcf.gz')
        resultFolder.survindel2.push(key);

      // for vcf
      if (fileExtension === '.vcf') resultFolder.str.vcf.push(key);
      if (fileExtension.startsWith('/')) resultFolder.str.reviewer.push(key);

      if (
        fileExtension === '_Mandatory_Bam_QC.csv' ||
        fileExtension === '_Monitor_Bam_QC.csv'
      )
        resultFolder.qc.push(key);
      if (fileExtension === '_cnn_filter_variant_tranches.vcf.gz')
        resultFolder.smallVariant.push(key);
    }

    // for cnv
    if (cnvPattern.exec(remainingPath)) resultFolder.cnv.push(key);

    // for manta
    if (remainingPath === 'manta_out/results/variants/diploidSV.vcf.gz')
      resultFolder.manta.push(key);
  });

  return result;
}

function parseFolderMapToSampleMap(
  folderMap: ReturnType<typeof parseObjectsToFolderMap>,
) {
  const result = new Map<
    string,
    (Omit<typeof folderMap extends Map<any, infer I> ? I : never, 'libId'> & {
      folderName: string;
    })[]
  >();

  folderMap.forEach(({ libId, str, ...rest }, folderName) => {
    if (
      !libId ||
      (!Object.values(rest).some((files) => files.length > 0) &&
        str.vcf.length === 0 &&
        str.reviewer.length === 0)
    )
      return;

    if (!result.has(libId)) {
      result.set(libId, []);
    }
    result.get(libId)!.push({
      folderName,
      str,
      ...rest,
    });
  });

  return result;
}

export function parseAwsJobsToMap(
  awsFiles: Awaited<ReturnType<typeof fetchS3ObjectList>>,
) {
  return parseFolderMapToSampleMap(parseObjectsToFolderMap(awsFiles));
}

function parseSampleMapToAoa(
  sampleMap: ReturnType<typeof parseFolderMapToSampleMap>,
) {
  const result: (string | number | undefined | null)[][] = [];

  sampleMap.forEach((sample, libId) => {
    result.push(
      ...sample.map(
        ({
          folderName,
          alignment,
          qc,
          haplotypeCaller,
          cnv,
          manta,
          smallVariant,
          str,
          surveyor,
          survindel2,
        }) => [
          libId,
          folderName,
          alignment.length,
          qc.length,
          haplotypeCaller.length,
          cnv.length,
          manta.length,
          smallVariant.length,
          str.vcf.length > 0 && str.reviewer.length > 0 ? 1 : 0,
          str.vcf.length,
          str.reviewer.length,
          surveyor.length,
          survindel2.length,
          alignment.join(', '),
          qc.join(', '),
          haplotypeCaller.join(', '),
          cnv.join(', '),
          manta.join(', '),
          smallVariant.join(', '),
          str.vcf.join(', '),
          str.reviewer.join(', '),
          surveyor.join(', '),
          survindel2.join(', '),
        ],
      ),
    );
  });

  result.unshift([
    'lib ID',
    'folder name',
    'alignment',
    'qc',
    'haplotypeCaller',
    'cnv',
    'manta',
    'smallVariant',
    'str',
    'str_vcf',
    'str_reviewer',
    'surveyor',
    'survindel2',
    'alignment output files',
    'qc output files',
    'haplotypeCaller output files',
    'cnv output files',
    'manta output files',
    'smallVariant output files',
    'str vcf output files',
    'str reviewer output files',
    'surveyor output files',
    'survindel2 output files',
  ]);

  return result;
}

async function main() {
  const awsSamples = await fetchS3ObjectList(
    'pipeline-dev-nathan',
    'solo-pipeline-prod/',
    { timer: true },
  );

  // console.time('input');
  // const awsSamples = (awsInput as { key: string; lastModified: string }[]).map(
  //   ({ lastModified, ...rest }) => ({
  //     ...rest,
  //     lastModified: new Date(lastModified),
  //   }),
  // );
  // console.timeEnd('input');

  console.log(awsSamples.length);

  console.time('parse to folder map');
  const folderMap = parseObjectsToFolderMap(awsSamples);
  const sampleMap = parseFolderMapToSampleMap(folderMap);
  console.timeEnd('parse to folder map');

  console.log(folderMap.size);

  console.time('save to xlsx');
  saveAoaToXLSX(
    [
      {
        data: parseSampleMapToAoa(sampleMap),
      },
      {
        data: parseS3ObjectListToAoa(awsSamples),
      },
    ],
    `${__dirname}/output/${format(
      new Date(),
      'yyyyMMdd_HHmmss',
    )}_aws_processed_samples.xlsx`,
  );
  console.timeEnd('save to xlsx');
}

if (require.main === module) {
  main();
}
