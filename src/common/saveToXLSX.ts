import fs from "fs";
import * as XLSX from "xlsx";

export function saveSheetsToXLSX(
  worksheets: [string, XLSX.WorkSheet][],
  fileName: string,
  opts?: XLSX.WritingOptions
) {
  const workbook = XLSX.utils.book_new();

  worksheets.forEach((worksheet) => {
    XLSX.utils.book_append_sheet(workbook, worksheet[1], worksheet[0]);
  });

  const savePath = fileName.slice(0, fileName.lastIndexOf("/"));
  if (!fs.existsSync(savePath)) {
    fs.mkdirSync(savePath);
  }

  XLSX.writeFileXLSX(workbook, fileName, { ...opts, compression: true });
}

export function saveAoaToXLSX(
  worksheets: {
    name?: string;
    data: unknown[][];
    sheetOpts?: XLSX.AOA2SheetOpts;
  }[],
  fileName: string,
  bookOpts?: XLSX.WritingOptions
) {
  const workbook = XLSX.utils.book_new();

  worksheets.forEach(({ name, data, sheetOpts }) => {
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet(data, sheetOpts),
      name
    );
  });

  const savePath = fileName.slice(0, fileName.lastIndexOf("/"));
  if (!fs.existsSync(savePath)) {
    fs.mkdirSync(savePath);
  }

  XLSX.writeFileXLSX(workbook, fileName, { ...bookOpts, compression: true });
}
