import { format } from "date-fns";
import { saveAoaToXLSX } from "../common/saveToXLSX";
import { BCSampledData } from "../BC_samples/types";

import { DIG_Samples, WrappedJob } from "./types";

const JOB_STATUS = (status: number) => {
  switch (status) {
    case 1:
      return "Running";
    case 2:
      return "Finished";
    case 16:
      return "Pending";
    default:
      return "Unknown";
  }
};

const SEQ_SUMMARY_SHEET_NAME = "sequenced summary" as const;
const DIG_SUMMARY_SHEET_NAME = "dig summary" as const;
const SEQ_SAMPLES_SHEET_NAME = "sequenced samples" as const;

export function saveBC_DIGstatsToXLSX(
  data: BCSampledData,
  digData: DIG_Samples,
  fileName: string
) {
  saveAoaToXLSX(
    [
      {
        name: SEQ_SUMMARY_SHEET_NAME,
        data: saveCPOSstats(data),
        sheetOpts: { cellDates: true },
      },
      {
        name: DIG_SUMMARY_SHEET_NAME,
        data: saveDIGstats(parseDIGstats(digData)),
        sheetOpts: { cellDates: true },
      },
      {
        name: SEQ_SAMPLES_SHEET_NAME,
        data: saveSamplesEntries(data, digData),
        sheetOpts: { cellDates: true },
      },
    ],
    fileName
  );
}

function saveCPOSstats(data: BCSampledData) {
  const header = [
    "CPOS Upload Date",
    "Sequenced Samples",
    "Total Sequenced",
    "",
    `Generated at ${format(new Date(), "yyyy-MM-dd HH:mm:ss")}`,
  ];

  const result: (string | number | Date | { t: string; f: string })[][] = [];
  result.push(header);
  let i = 2;

  data.forEach((_libId, date) => {
    result.push([
      new Date(date),
      {
        t: "n",
        f: `COUNTIF('${SEQ_SAMPLES_SHEET_NAME}'!$A:$A,'${SEQ_SUMMARY_SHEET_NAME}'!A${i})`,
      },
      { t: "n", f: `SUM(B$2:B${i})` },
    ]);
    i++;
  });

  return result;
}

function parseDIGstats(data: DIG_Samples) {
  const stats = new Map<string, WrappedJob[]>();

  data.forEach((job) => {
    if (!job.stoppedAt) return;

    const dateString = format(new Date(job.stoppedAt * 1000), "yyyy/MM/dd");

    if (!stats.has(dateString)) {
      stats.set(dateString, []);
    }
    stats.get(dateString)?.push(job);
  });

  return stats;
}

function saveDIGstats(stats: Map<string, WrappedJob[]>) {
  const header = ["DIG Finished Date", "Processed Count", "Total Processed"];

  const rows: (string | Date | number)[][] = [];
  rows.push(header);

  let total = 0;
  Array.from(stats.keys())
    .sort((a, b) => a.localeCompare(b))
    .forEach((date) => {
      const count = stats.get(date)!.length;
      total += count;
      rows.push([new Date(date), count, total]);
    });

  return rows;
}

function saveSamplesEntries(data: BCSampledData, digData: DIG_Samples) {
  const header = [
    "CPOS Upload Date",
    "Lib ID",
    "Lab ID",
    "fastq Count",
    "isTopUp",
    "DIG Job Name",
    "DIG Project Name",
    "DIG Job Status",
    "DIG Job Created at",
    "DIG Job Started at",
    "DIG Job Stopped At",
    "DIG Job Elapsed (hr)",
    "Remarks",
  ];

  const rows: (string | number | Date | undefined)[][] = [];
  rows.push(header);

  data.forEach((specimens, date) => {
    specimens.forEach((lib, libID) => {
      const dig = digData.get(libID);
      rows.push([
        new Date(date),
        libID,
        libID.split("-")[0],
        lib.fastq_fileKeys.length,
        lib.isTopUp ? 1 : 0,
        dig?.name,
        dig?.project.name,
        dig?.status ? JOB_STATUS(dig.status) : undefined,
        dig?.createdAt ? new Date(dig.createdAt * 1000) : undefined,
        dig?.startedAt ? new Date(dig.startedAt * 1000) : undefined,
        dig?.stoppedAt ? new Date(dig.stoppedAt * 1000) : undefined,
        dig?.stoppedAt && dig.startedAt
          ? Number(((dig.stoppedAt - dig.startedAt) / 3600).toFixed(2))
          : undefined,
        // date === "2022/08/26" ? "processed by Parabricks" : undefined,
      ]);
    });
  });

  return rows;
}
