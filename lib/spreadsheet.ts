export type SheetRow = Record<string, string | number | boolean | null | undefined>;

export async function readWorkbook(file: File): Promise<SheetRow[]> {
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());
  const worksheet = workbook.worksheets[0];
  if (!worksheet) return [];
  const headers = (worksheet.getRow(1).values as unknown[]).slice(1).map((value) => String(value ?? "").trim());
  const rows: SheetRow[] = [];
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const record: SheetRow = {};
    headers.forEach((header, index) => {
      const value = row.getCell(index + 1).value;
      record[header] = value instanceof Date ? value.toISOString() : typeof value === "object" && value !== null ? String("text" in value ? value.text : "result" in value ? value.result ?? "" : value) : value;
    });
    if (Object.values(record).some((value) => value !== "" && value !== null && value !== undefined)) rows.push(record);
  });
  return rows;
}

export async function downloadWorkbook(fileName: string, sheetName: string, rows: SheetRow[]) {
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(sheetName.slice(0, 31));
  const headers = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  worksheet.columns = headers.map((header) => ({ header, key: header, width: Math.max(12, header.length * 2) }));
  worksheet.addRows(rows);
  worksheet.getRow(1).font = { bold: true };
  const bytes = await workbook.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName.endsWith(".xlsx") ? fileName : `${fileName}.xlsx`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function downloadCsv(fileName: string, headers: string[], rows: Array<Record<string, unknown>>) {
  const csv = "\uFEFF" + [headers, ...rows.map((row) => headers.map((header) => row[header] ?? ""))]
    .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a"); anchor.href = url; anchor.download = fileName; anchor.click(); URL.revokeObjectURL(url);
}
