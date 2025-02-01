import axios from 'axios';
import { format } from 'date-fns';
import { saveAoaToXLSX } from '../common/saveToXLSX';

require('dotenv').config();

const VARAPP_LAMBDA_API_LINK = process.env.VARAPP_LAMBDA_API_LINK!;
const VARAPP_LAMBDA_API_KEY = process.env.VARAPP_LAMBDA_API_KEY!;

async function fetchVarappFiles() {
  const response = await axios.get<{ file: string; mtime: string }[]>(
    VARAPP_LAMBDA_API_LINK,
    {
      headers: {
        'X-API-Key': VARAPP_LAMBDA_API_KEY,
      },
    },
  );

  return response.data
    .map(({ mtime, ...rest }) => ({
      ...rest,
      mtime: new Date(mtime),
    }))
    .sort((a, b) => a.mtime.getTime() - b.mtime.getTime());
}

function parseFilesToFamilyMap(
  files: Awaited<ReturnType<typeof fetchVarappFiles>>,
) {
  const result = new Map<
    string,
    {
      proband: string;
      libIds: Set<string>;
      type: string;
      mtime: Date;
    }
  >();

  files.forEach(({ file, mtime }) => {
    if (!file.endsWith('.vcf.db') || mtime < new Date('2022-03-01')) return;

    const splitName = file.split('/mnt/efs/')[1].split('_');

    const proband = splitName[0];
    const type = splitName[1].split('re.vcf.db')[0];

    const libIdPattern = /.*([A-Z\d]{2}\d{6}[A-Z]\d{2}-\d{3}-LIB\d).*/i;
    const members = splitName.filter((value) => libIdPattern.test(value));

    result.set(file, {
      proband,
      libIds: new Set(members),
      type,
      mtime,
    });
  });

  return result;
}

function parseFilesToAoa(files: Awaited<ReturnType<typeof fetchVarappFiles>>) {
  const result = files.map(({ file, mtime }) => [mtime, file]);

  result.unshift(['mtime', 'file name']);

  return result;
}

function parseFamilyMapToAoa(
  familyMap: ReturnType<typeof parseFilesToFamilyMap>,
) {
  const result: (Date | string | number)[][] = [];

  familyMap.forEach(({ type, proband, libIds, mtime }, file) => {
    result.push([
      mtime,
      file,
      type,
      proband,
      libIds.size,
      Array.from(libIds).join(', '),
    ]);
  });
  result.unshift([
    'mtime',
    'file name',
    'type',
    'proband',
    'lib ID count',
    'lib ID',
  ]);

  return result;
}

async function main() {
  console.time('fetch from AWS lambda');
  const files = await fetchVarappFiles();
  console.timeEnd('fetch from AWS lambda');

  console.log(files.length);

  const familyMap = parseFilesToFamilyMap(files);

  saveAoaToXLSX(
    [
      {
        data: parseFamilyMapToAoa(familyMap),
      },
      {
        data: parseFilesToAoa(files),
      },
    ],
    `${__dirname}/output/${format(
      new Date(),
      'yyyyMMdd_HHmmss',
    )}_varapp_files.xlsx`,
  );
}

main();
