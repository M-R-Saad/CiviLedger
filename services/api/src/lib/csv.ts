/**
 * A small RFC 4180 CSV reader.
 *
 * Written rather than pulled in because the input is a registrar's export from
 * a student information system: it arrives with a UTF-8 BOM, CRLF endings,
 * quoted commas inside programme names, and Bangla text. Those are exactly the
 * cases a hand-rolled `split(',')` gets wrong and a dependency would hide.
 */

export class CsvError extends Error {
  constructor(
    message: string,
    public readonly line: number,
  ) {
    super(message);
    this.name = 'CsvError';
  }
}

export interface CsvTable {
  headers: string[];
  /** One record per data row, keyed by header. */
  rows: Array<Record<string, string>>;
}

const MAX_CELLS = 2_000_000;

export function parseCsv(input: string, options: { maxRows?: number } = {}): CsvTable {
  const text = input.replace(/^﻿/, '');
  const records = parseRecords(text);

  if (records.length === 0) {
    throw new CsvError('the file is empty', 0);
  }

  const headers = (records[0] ?? []).map((h) => h.trim());
  if (headers.length === 0 || headers.every((h) => h === '')) {
    throw new CsvError('the first row must be a header row', 1);
  }

  const seen = new Set<string>();
  for (const header of headers) {
    if (seen.has(header)) {
      throw new CsvError(`duplicate column "${header}"`, 1);
    }
    seen.add(header);
  }

  const dataRecords = records.slice(1).filter((r) => r.some((cell) => cell.trim() !== ''));
  if (options.maxRows !== undefined && dataRecords.length > options.maxRows) {
    throw new CsvError(
      `file has ${dataRecords.length} rows; the limit is ${options.maxRows}`,
      dataRecords.length,
    );
  }

  const rows = dataRecords.map((record, index) => {
    if (record.length > headers.length) {
      throw new CsvError(
        `row has ${record.length} columns but the header has ${headers.length}`,
        index + 2,
      );
    }
    const row: Record<string, string> = {};
    headers.forEach((header, column) => {
      row[header] = (record[column] ?? '').trim();
    });
    return row;
  });

  return { headers, rows };
}

function parseRecords(text: string): string[][] {
  const records: string[][] = [];
  let record: string[] = [];
  let cell = '';
  let inQuotes = false;
  let cells = 0;
  let line = 1;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]!;

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        if (char === '\n') line += 1;
        cell += char;
      }
      continue;
    }

    switch (char) {
      case '"':
        // A quote mid-cell is literal; only a leading quote opens a quoted cell.
        if (cell === '') inQuotes = true;
        else cell += char;
        break;
      case ',':
        record.push(cell);
        cell = '';
        cells += 1;
        if (cells > MAX_CELLS) throw new CsvError('file is too large', line);
        break;
      case '\r':
        break;
      case '\n':
        record.push(cell);
        records.push(record);
        record = [];
        cell = '';
        line += 1;
        break;
      default:
        cell += char;
    }
  }

  if (inQuotes) {
    throw new CsvError('unterminated quoted value', line);
  }
  if (cell !== '' || record.length > 0) {
    record.push(cell);
    records.push(record);
  }
  return records;
}

/** Serialise rows back to CSV — used for the review-queue export. */
export function toCsv(
  headers: readonly string[],
  rows: ReadonlyArray<Record<string, unknown>>,
): string {
  const escape = (value: unknown): string => {
    const text = value === null || value === undefined ? '' : String(value);
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const lines = [headers.map(escape).join(',')];
  for (const row of rows) {
    lines.push(headers.map((h) => escape(row[h])).join(','));
  }
  return lines.join('\r\n');
}
