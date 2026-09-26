/**
 * CSV export helper.
 *
 * Every "Export" button in the portal funnels through here so the quoting rules
 * are implemented exactly once. RFC 4180: a field is wrapped in double quotes if
 * it contains a comma, a quote or a newline, and inner quotes are doubled.
 * A UTF-8 BOM is prepended so Excel does not mangle the em-dash / accent
 * characters that appear in species names.
 */

/**
 * @typedef {string | number | null | undefined} CsvValue
 */

/**
 * @param {CsvValue} value
 * @returns {string}
 */
export function csvCell(value) {
  if (value === null || value === undefined) return ''
  const s = String(value)
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/**
 * @param {string[]} headers
 * @param {CsvValue[][]} rows
 * @returns {string}
 */
export function toCsv(headers, rows) {
  return [headers, ...rows].map(r => r.map(csvCell).join(',')).join('\r\n')
}

/**
 * Build the CSV and hand it to the browser as a download. Returns the number of
 * data rows so the caller can put an accurate count in the toast, the
 * notification and the audit log rather than guessing.
 *
 * @param {string} filename
 * @param {string[]} headers
 * @param {CsvValue[][]} rows
 * @returns {number}
 */
export function downloadCsv(filename, headers, rows) {
  const body = toCsv(headers, rows)
  const blob = new Blob([`\uFEFF${body}`], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  // Revoke on the next tick — revoking synchronously can cancel the download
  // in some browsers before it has read the blob.
  setTimeout(() => URL.revokeObjectURL(url), 0)
  return rows.length
}
