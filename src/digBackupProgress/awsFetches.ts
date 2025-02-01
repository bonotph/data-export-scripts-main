import {
  S3Client,
  ListObjectsV2Command,
  ListObjectsV2CommandInput,
} from '@aws-sdk/client-s3';
import { format } from 'date-fns';
import { backupStatsType } from '.';

require('dotenv').config();

/**
 * AWS client config
 */
const client = new S3Client({});
const Bucket = 'hkgi-dig-cold-data-store';
const options = { timer: true, debug: false };

/**
 * Get the list of files from S3 bucket
 * @returns string[] with all file names
 */
export async function fetchAndCheckAwsFiles(
  Prefix: string,
  digFileMap: Map<string, { size: number; jobId: string }>,
  incompleteJobs: Map<string, number>,
  backupStats: backupStatsType,
) {
  const commandParams: ListObjectsV2CommandInput = {
    Bucket,
    Prefix,
  };

  let truncated = true;

  let s3FileCount = 0;

  if (options.timer)
    console.time(`fetch from AWS s3://${Bucket}${Prefix && `/${Prefix}`}`);

  while (truncated) {
    try {
      const response = await client.send(
        new ListObjectsV2Command(commandParams),
      );

      truncated = response.IsTruncated as boolean;

      response.Contents!.forEach(({ Key, LastModified }) => {
        const fileId = Key!.split('/')[4]?.split('__')[0];
        if (digFileMap.has(fileId)) {
          const { size, jobId } = digFileMap.get(fileId)!;

          // update s3 file size and create log
          backupStats.s3TotalSize += size;
          const dateString = format(LastModified!, 'yyyy-MM-dd');
          if (!backupStats.s3Stats.has(dateString))
            backupStats.s3Stats.set(dateString, 0);
          backupStats.s3Stats.set(
            dateString,
            backupStats.s3Stats.get(dateString)! + size,
          );

          incompleteJobs.set(jobId, incompleteJobs.get(jobId)! - 1);
          if (incompleteJobs.get(jobId) === 0) incompleteJobs.delete(jobId);
        }
      });

      s3FileCount += response.Contents!.length;

      if (truncated) {
        commandParams.ContinuationToken = response.NextContinuationToken;
      }

      if (options.debug) console.log(`fetched ${s3FileCount} files in total`);
    } catch (error) {
      console.error(
        `AWS fetch S3 object failed, currently fetched ${s3FileCount}`,
      );
      console.error(error);
      process.exit(1);
    }
  }

  if (options.timer)
    console.timeEnd(`fetch from AWS s3://${Bucket}${Prefix && `/${Prefix}`}`);
}
