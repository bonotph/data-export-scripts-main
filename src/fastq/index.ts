import AWS from 'aws-sdk';
import readline from 'readline';
import fs from 'fs';

require('dotenv').config();

// Configure AWS credentials and region
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

// Create an S3 client
const s3 = new AWS.S3();

// Define the bucket name and path
const bucketName = 'hkgi-sample-data-prod';

async function getS3Folders(path: string): Promise<string[]> {
  try {
    const params = {
      Bucket: bucketName,
      Delimiter: '/',
      Prefix: path,
    };

    const response = await s3.listObjectsV2(params).promise();

    if (response.CommonPrefixes) {
      const folders = response.CommonPrefixes.map((prefix) => {
        const folderPath = prefix.Prefix as string;
        const folderName = folderPath.split('/').filter(Boolean).pop();
        return folderName;
      });
      return folders as string[];
    } else {
      return [];
    }
  } catch (error) {
    console.error('Error:', error);
    return [];
  }
}

async function readSamplesFromFile(filePath: string): Promise<string[]> {
  const lines: string[] = [];
  const fileStream = fs.createReadStream(filePath);

  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    lines.push(line);
  }

  return lines;
}

async function main() {
  const samples = await readSamplesFromFile('src/fastq/input_data/input.txt');
  const hkgiFolders = await getS3Folders('HKGI/');
  const cposFolders = await getS3Folders('CPOS/');
  const folders = hkgiFolders.concat(cposFolders);

  const outputFilePath = 'src/fastq/output/output.tsv';
  const outputStream = fs.createWriteStream(outputFilePath);

  for (const sample of samples) {
    const sampleFolders = folders.filter((folder) => folder.includes(sample));
    outputStream.write(`${sample}`);
    for (const folder of sampleFolders) {
      outputStream.write(`\t${folder}`);
    }
    outputStream.write(`\n`);
  }
  outputStream.end();
}

main();
