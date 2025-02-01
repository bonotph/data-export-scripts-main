import { DIG_Samples, WrappedJob } from './types';

export function parseDIGJobsList(jobList: WrappedJob[]) {
  const results: DIG_Samples = new Map();

  jobList.forEach((job) => {
    const regExp = /(([a-z][a-z0-9]).{9})-[0-9]{3}-LIB[0-9](-[0-9]+)*/i;
    const regExpResults = regExp.exec(job.name);

    // exclude test data
    if (!regExpResults) {
      // console.error("not sample, skipped: ", job.name);
      return;
    }

    const samplePrefix = regExpResults[2];

    // exclude non-BC samples
    // if (samplePrefix != 'BC') {
    //   // console.error("not BC, skipped: ", job.name);
    //   return;
    // }

    // exclude failed & deleted jobs
    if ([4, 8].includes(job.status)) {
      // console.error("failed / deleted job, skipped: ", job.name);
      return;
    }

    const jobKey = `${job.project.name}/${job.name}`;
    // if (results.has(job.name)) {
    //   const { configuration, specification, nodesStatus, ...jobRest } = job;

    //   console.error('repeated: ', job.name);
    //   console.error(JSON.stringify({ ...jobRest }, null, 2));
    // }
    if (!results.has(jobKey)) {
      results.set(jobKey, []);
    }
    results.get(jobKey)!.push(job);
  });

  return results;
}
