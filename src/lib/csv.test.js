import { describe, expect, it } from 'vitest'
import { csvCell, toCsv } from './csv'

describe('csvCell', () => {
  it('leaves plain values untouched', () => {
    expect(csvCell('SUB-4421')).toBe('SUB-4421')
    expect(csvCell(42)).toBe('42')
    expect(csvCell(0)).toBe('0')
    // `false` is not a member of the CsvValue union; the cast existed to prove the
    // helper still stringifies a value the type system would have rejected.
    expect(csvCell(/** @type {any} */ (false))).toBe('false')
  })

  it('renders null and undefined as an empty cell, not the words', () => {
    expect(csvCell(null)).toBe('')
    expect(csvCell(undefined)).toBe('')
  })

  it('quotes commas, quotes and newlines per RFC 4180', () => {
    expect(csvCell('Lim, Ana')).toBe('"Lim, Ana"')
    expect(csvCell('Narra "Pterocarpus"')).toBe('"Narra ""Pterocarpus"""')
    expect(csvCell('line one\nline two')).toBe('"line one\nline two"')
  })

  it('does not quote an em-dash, which is why the BOM matters', () => {
    expect(csvCell('Zone A – Main Campus')).toBe('Zone A – Main Campus')
  })
})

describe('toCsv', () => {
  it('joins with CRLF and always emits the header row', () => {
    expect(toCsv(['a', 'b'], [[1, 2]])).toBe('a,b\r\n1,2')
  })

  it('emits just the header for an empty result set', () => {
    expect(toCsv(['a', 'b'], [])).toBe('a,b')
  })

  it('keeps a ragged row from shifting every later column', () => {
    expect(toCsv(['a', 'b', 'c'], [['1', '2,3']])).toBe('a,b,c\r\n1,"2,3"')
  })
})
