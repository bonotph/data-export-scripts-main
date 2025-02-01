import {
  S3Client,
  ListObjectsV2Command,
  ListObjectsV2CommandInput,
} from '@aws-sdk/client-s3';

require('dotenv').config();

/**
 * AWS client config
 */
const client = new S3Client({});

/**
 * Get the list of files from S3 bucket
 * @returns string[] with all file names
 */
export async function fetchS3ObjectList(
  Bucket: string,
  Prefix?: string,
  options: { timer?: boolean; debug?: boolean } = {},
) {
  const commandParams: ListObjectsV2CommandInput = {
    Bucket,
    Prefix,
  };

  let truncated = true;

  const result: { key: string; lastModified: Date; size?: number }[] = [];

  if (options.timer)
    console.time(`fetch from AWS s3://${Bucket}${Prefix && `/${Prefix}`}`);

  while (truncated) {
    try {
      const response = await client.send(
        new ListObjectsV2Command(commandParams),
      );

      truncated = response.IsTruncated as boolean;

      response.Contents!.forEach(({ Key, LastModified, Size }) => {
        result.push({ key: Key!, lastModified: LastModified!, size: Size! });
      });

      if (truncated) {
        commandParams.ContinuationToken = response.NextContinuationToken;
      }

      if (options.debug) console.log(`fetched ${result.length} files in total`);
    } catch (error) {
      console.error(
        `AWS fetch S3 object failed, currently fetched ${result.length}`,
      );
      console.error(error);
      process.exit(1);
    }
  }

  if (options.timer)
    console.timeEnd(`fetch from AWS s3://${Bucket}${Prefix && `/${Prefix}`}`);

  return result;
}
