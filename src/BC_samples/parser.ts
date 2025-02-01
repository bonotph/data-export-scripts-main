import { BCSampledData } from './types';

export function parseFileListToSamples(fileList: string[]) {
  const result: BCSampledData = new Map();

  fileList.forEach((file) => {
    const regExp =
      /(.*)\/(.*_.*)\/([a-z][a-z0-9].{9}-[0-9]{3}-LIB[0-9](-[0-9]*)*)_[0-9].fastq.gz/gi;

    const regExpResults = regExp.exec(file);

    // return if file not matches the specified format
    if (!regExpResults) return;

    const rootFolder = regExpResults[1];
    const projectFolder = regExpResults[2];
    const libId = regExpResults[3];
    const isTopUp = !!regExpResults[4]; // check if the file is a top-up
    const date = projectFolder.split('_')[1];

    // for CPOS folder
    if (rootFolder === 'CPOS') {
      // filter out project folder not starts with CPOS and test data earlier than 2021-11-30
      if (
        !projectFolder.startsWith('CPOS') ||
        date.localeCompare('20211130') < 0
      ) {
        return;
      }
    } else {
      return;
    }

    // for HKGI folder
    // if (rootFolder === 'HKGI') {
    //   // for NOVA suffix, filter out
    //   if (projectFolder.includes('NOVA')) {
    //     if (projectFolder === 'HKGI_20230116_NOVA0016') {
    //       return;
    //     }
    //   } else if (
    //     !['HKGI_20221007', 'HKGI_20221018', 'HKGI_20221125B'].includes(
    //       projectFolder,
    //     )
    //   ) {
    //     return;
    //   }
    // }

    if (date.length < 8) return;
    if (!libId.startsWith('BC') && date.localeCompare('20230301') < 0) return;

    let formattedDateString: string;

    if (date.length < 8) {
      formattedDateString = 'ERROR_DATE_FORMAT';
    } else {
      formattedDateString = `${date.slice(0, 4)}/${date.slice(
        4,
        6,
      )}/${date.slice(6, 8)}`;
    }

    // if the date has not been added yet
    if (!result.has(formattedDateString)) {
      result.set(formattedDateString, new Map());
    }

    const existingSpecimens = result.get(formattedDateString);

    // if the lib ID has not been added yet
    if (!existingSpecimens?.has(libId)) {
      existingSpecimens?.set(libId, {
        fastq_fileKeys: [],
        isTopUp,
        folder: `${rootFolder}/${projectFolder}`,
      });
    }

    existingSpecimens?.get(libId)?.fastq_fileKeys.push(file);
  });

  return result;
}
