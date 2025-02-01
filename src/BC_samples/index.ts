import { format } from 'date-fns';

import { fetchS3ObjectList, saveS3FileListToXLSX } from '../common/awsFetches';
import { parseFileListToSamples } from './parser';
import { saveBCstatsToXLSX } from './saver';

async function main({
  timer = false,
  saveS3 = false,
}: {
  timer?: boolean;
  saveS3?: boolean;
} = {}) {
  const outputPath = `${__dirname}/output`;
  const outputFileName = `${outputPath}/${format(
    new Date(),
    'yyyyMMdd_HHmmss',
  )}_BC_sequenced_samples.xlsx`;

  let fileList: string[];

  if (timer) {
    console.time('fetch file list from S3');
    fileList = await fetchS3ObjectList();
    console.timeEnd('fetch file list from S3');

    console.time('parse file list to samples');
    const result = parseFileListToSamples(fileList);
    console.timeEnd('parse file list to samples');

    console.time('save to XLSX');
    saveBCstatsToXLSX(result, outputFileName);
    console.timeEnd('save to XLSX');
  } else {
    fileList = await fetchS3ObjectList();
    const result = parseFileListToSamples(fileList);
    saveBCstatsToXLSX(result, outputFileName);
  }

  console.log(`\nOutput file saved to:\n${outputFileName}`);

  if (saveS3) {
    const s3FileName = `${outputPath}/${format(
      new Date(),
      'yyyyMMdd',
    )}_aws_s3_file_list.xlsx`;

    saveS3FileListToXLSX(fileList, s3FileName);
    console.log(`\naws file list saved to:\n${s3FileName}`);
  }
}

if (require.main === module) {
  const argv = process.argv.slice(2);
  const timer = argv.includes('-t');
  const debug = argv.includes('-d');

  main({ timer, saveS3: debug });
}
