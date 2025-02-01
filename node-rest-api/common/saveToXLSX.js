import * as XLSX from "xlsx"

export function saveSheetsToXLSX(worksheets, opts) {
  const workbook = XLSX.utils.book_new()

  worksheets.forEach(worksheet => {
    XLSX.utils.book_append_sheet(workbook, worksheet[1], worksheet[0])
  })

  return XLSX.write(workbook, { ...opts, bookType: "xlsx", type: "base64" })
}

export function saveAoaToXLSX(worksheets, bookOpts) {
  console.log("saving");
  const workbook = XLSX.utils.book_new()

  worksheets.forEach(({ name, data, sheetOpts }) => {
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet(data, sheetOpts),
      name
    )
  })

  return XLSX.write(workbook, { ...bookOpts, bookType: "xlsx", type: "buffer" })
  
}

