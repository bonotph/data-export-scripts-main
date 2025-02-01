import format from 'date-fns/format';
import fs from 'node:fs';

import { SampledDataMap } from './types';
import { fetchS3ObjectList } from '../common/awsFetches';

require('dotenv').config();

function saveSampleList(data: any[], filename = '') {
  fs.writeFileSync(
    `${__dirname}/output/samples_${format(new Date(), 'yyMMdd')}${filename}`,
    JSON.stringify(data, null, 4),
  );
}

function parseSampleListToMap(fileList: string[]) {
  const result: SampledDataMap = new Map();

  fileList.forEach((fileName) => {
    const regExpResults =
      /(CPOS|HKGI)\/(CPOS|HKGI)_([0-9]{8})\/([a-z][a-z0-9].{9})-.*.fastq.gz/i.exec(
        fileName,
      );
    // return if fileName not matches the specified format
    if (!regExpResults) return;

    const folder = regExpResults[1];
    const dateString = regExpResults[3];
    const labId = regExpResults[4];

    // for CPOS folder, test data are those earlier than 2021/11/30
    if (folder === 'CPOS' && dateString.localeCompare('20211130') < 0) return;
    // for HKGI folder, test data are those earlier than or on 2022/10/07
    if (folder === 'HKGI' && dateString.localeCompare('20221007') <= 0) return;
    // console.log(regExpResults);
    result.set(labId, fileName);
  });

  return result;
}

export async function fetchAndParseSampleList() {
  const fileList = await fetchS3ObjectList();

  // for debug
  saveSampleList(fileList, '_raw');

  const result = parseSampleListToMap(fileList);

  return result;
}

async function main() {
  const data = await fetchAndParseSampleList();

  console.log(data.size);
}

if (require.main === module) {
  main();
}
