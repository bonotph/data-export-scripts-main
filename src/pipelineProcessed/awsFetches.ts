import {
  S3Client,
  ListObjectsV2Command,
  ListObjectsV2CommandInput,
} from '@aws-sdk/client-s3';
import { AWSResult } from './types';

require('dotenv').config();

/**
 * AWS client config
 */
const client = new S3Client({
  region: process.env.AWS_REGION as string,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID as string,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY as string,
  },
});

/**
 * AWS S3 bucket config params
 */
const bucketParams: ListObjectsV2CommandInput = {
  Bucket: process.env.AWS_BUCKET as string,
};

/**
 * Get the list of files from S3 bucket
 * @returns string[] with all file names
 */
export async function fetchS3ObjectList(
  Bucket: string,
  Prefix?: string,
  options: { timer?: boolean } = { timer: false },
) {
  const commandParams: ListObjectsV2CommandInput = {
    Bucket,
    Prefix,
  };

  let truncated = true;

  const result: AWSResult = new Map();

  if (options.timer) console.time('fetch from AWS S3');
  while (truncated) {
    try {
      const response = await client.send(
        new ListObjectsV2Command(commandParams),
      );

      truncated = response.IsTruncated as boolean;

      response.Contents?.forEach(({ Key, LastModified }) => {
        result.set(Key!, { lastModified: LastModified! });
      });

      if (truncated) {
        commandParams.ContinuationToken = response.NextContinuationToken;
      }
    } catch (error) {
      console.log(error);
      process.exit(1);
    }
  }
  if (options.timer) console.timeEnd('fetch from AWS S3');

  return result;
}
