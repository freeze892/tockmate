import { describe, it, expect } from 'vitest'
import { parseCSV } from '../src/utils/csv'

describe('parseCSV RFC4180', () => {
  it('基础：逗号分隔 + 换行', () => {
    expect(parseCSV('a,b,c\n1,2,3')).toEqual([['a', 'b', 'c'], ['1', '2', '3']])
  })
  it('CRLF 与末行无换行', () => {
    expect(parseCSV('a,b\r\n1,2')).toEqual([['a', 'b'], ['1', '2']])
    expect(parseCSV('a,b\n1,2')).toEqual([['a', 'b'], ['1', '2']])
  })
  it('引号包裹：含逗号/引号转义', () => {
    expect(parseCSV('"a,x",b\n"say ""hi""",2')).toEqual([['a,x', 'b'], ['say "hi"', '2']])
  })
  it('跨行字段：引号内换行保留', () => {
    expect(parseCSV('"多\n行",x')).toEqual([['多\n行', 'x']])
  })
  it('尾部全空行移除、字段数不齐保留空串', () => {
    expect(parseCSV('a,b\n\n\n')).toEqual([['a', 'b']])
    expect(parseCSV('a,b\n1')).toEqual([['a', 'b'], ['1']])
  })
  it('中文与空字段', () => {
    expect(parseCSV('购物,买牛奶,,备注')).toEqual([['购物', '买牛奶', '', '备注']])
  })
})
