import { format } from 'date-fns';
import { saveAoaToXLSX } from '../common/saveToXLSX';

import { BCSampledData } from './types';

export function saveBCstatsToXLSX(data: BCSampledData, fileName: string) {
  saveAoaToXLSX(
    [
      {
        name: 'summary',
        data: saveBCstats(data),
        sheetOpts: { cellDates: true },
      },
      {
        name: 'sequenced samples',
        data: saveBCsamples(data),
        sheetOpts: { cellDates: true },
      },
    ],
    fileName,
  );
}

function saveBCstats(data: BCSampledData) {
  const header = [
    'Date',
    'Sequenced Samples',
    'Total',
    '',
    `Generated at ${format(new Date(), 'yyyy-MM-dd HH:mm:ss')}`,
  ];

  const result: (string | number | Date | any)[][] = [];
  result.push(header);
  let i = 2;

  data.forEach((_libId, date) => {
    result.push([
      new Date(date),
      { t: 'n', f: `COUNTIF('sequenced samples'!$A:$A,summary!A${i})` },
      { t: 'n', f: `SUM(B$2:B${i})` },
    ]);
    i++;
  });

  return result;
}

function saveBCsamples(data: BCSampledData) {
  const header = [
    'Date',
    'Folder',
    'Lib ID',
    'Lab ID',
    'fastq Count',
    'isTopUp',
  ];

  const rows: (string | number | Date)[][] = [];
  rows.push(header);

  data.forEach((sample, date) => {
    sample.forEach((sample, libId) => {
      rows.push([
        new Date(date),
        sample.folder,
        libId,
        libId.split('-')[0],
        sample.fastq_fileKeys.length,
        sample.isTopUp ? 1 : 0,
      ]);
    });
  });

  return rows;
}
