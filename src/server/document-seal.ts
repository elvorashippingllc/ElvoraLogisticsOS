import { bad } from './util'

/** Permit embedded raster images only: never remote URLs or active SVG/HTML content. */
export function validateDocumentSeal(value: unknown): string {
  if (value === '') return ''
  if (typeof value !== 'string' || value.length > 1_400_000) throw bad('Use a PNG or JPEG company seal of up to 1 MB')
  const match = /^data:image\/(png|jpeg);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value)
  if (!match) throw bad('Use a PNG or JPEG company seal')
  const bytes = Buffer.from(match[2], 'base64')
  if (bytes.length > 1024 * 1024 || bytes.toString('base64') !== match[2]) throw bad('Invalid company seal image')
  const png = bytes.length > 24 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) && bytes.toString('ascii', 12, 16) === 'IHDR'
  const jpeg = bytes.length > 4 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 && bytes[bytes.length - 2] === 255 && bytes[bytes.length - 1] === 217
  if (match[1] === 'png' ? !png : !jpeg) throw bad('The company seal does not match its image format')
  if (png && (bytes.readUInt32BE(16) < 1 || bytes.readUInt32BE(20) < 1 || bytes.readUInt32BE(16) > 4096 || bytes.readUInt32BE(20) > 4096)) throw bad('Company seal dimensions must be between 1 and 4096 pixels')
  return value
}
