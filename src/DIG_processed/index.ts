import { format } from "date-fns";
import { PrismaClient as DIG_PrismaClient } from "../../prisma/generated/dig_client";

import { fetchS3ObjectList } from "../common/awsFetches";
import { prismaFetches } from "../common/prismaFetches";
import { parseFileListToSamples } from "../BC_samples/parser";

import { fetchJobs } from "./fetcher";
import { parseDIGJobsList } from "./parser";
import { saveBC_DIGstatsToXLSX } from "./saver";
import { WrappedJob } from "./types";

const dig_client = new DIG_PrismaClient();

async function main() {
  const [[digJobs], s3FileList]: [[WrappedJob[]], string[]] = await Promise.all(
    [
      prismaFetches(dig_client, [fetchJobs], { timer: true }),
      fetchS3ObjectList({ timer: true }),
    ]
  );

  console.time("parse data");
  const digProcessedData = parseDIGJobsList(digJobs);
  const sampleList = parseFileListToSamples(s3FileList);
  console.timeEnd("parse data");

  const outputPath = `${__dirname}/output`;
  const outputFileName = `${outputPath}/${format(
    new Date(),
    "yyyyMMdd"
  )}_BC_DIG_sequenced_samples.xlsx`;

  console.time("save to XLSX");
  saveBC_DIGstatsToXLSX(sampleList, digProcessedData, outputFileName);
  console.timeEnd("save to XLSX");

  console.log(`\noutput saved to: ${outputFileName}\n`);
}

if (require.main === module) {
  main();
}
