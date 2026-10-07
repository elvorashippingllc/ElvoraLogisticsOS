import fs from 'node:fs'
import path from 'node:path'
import { Readable } from 'node:stream'
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadBucketCommand } from '@aws-sdk/client-s3'
import { getSetting } from '../settings'
import { dirs } from '../config'

export const r2Configured = () => !!(getSetting('r2_account_id') && getSetting('r2_access_key_id') && getSetting('r2_secret_access_key') && getSetting('r2_bucket'))
export const useR2 = () => getSetting('storage_provider') === 'r2' && r2Configured()

let client: S3Client | null = null, sig = ''
function s3(): S3Client {
  const s = `${getSetting('r2_account_id')}|${getSetting('r2_access_key_id')}|${getSetting('r2_secret_access_key')}`
  if (!client || s !== sig) {
    const ep = process.env.R2_ENDPOINT
    client = new S3Client({ region: 'auto', endpoint: ep || `https://${getSetting('r2_account_id')}.r2.cloudflarestorage.com`, forcePathStyle: !!ep, credentials: { accessKeyId: getSetting('r2_access_key_id'), secretAccessKey: getSetting('r2_secret_access_key') } })
    sig = s
  }
  return client
}
const bucket = () => String(getSetting('r2_bucket'))

export async function r2Put(key: string, body: Buffer | fs.ReadStream, contentType = 'application/octet-stream') {
  const buf = Buffer.isBuffer(body) ? body : await streamToBuffer(body)
  await s3().send(new PutObjectCommand({ Bucket: bucket(), Key: key, Body: buf, ContentType: contentType }))
}
export async function r2Get(key: string): Promise<Readable> {
  const r = await s3().send(new GetObjectCommand({ Bucket: bucket(), Key: key }))
  return r.Body as Readable
}
export async function r2Delete(key: string) { await s3().send(new DeleteObjectCommand({ Bucket: bucket(), Key: key })) }
export async function r2Test(): Promise<{ ok: boolean; error?: string }> {
  if (!r2Configured()) return { ok: false, error: 'Account id, access key, secret and bucket are required' }
  try { await s3().send(new HeadBucketCommand({ Bucket: bucket() })); return { ok: true } } catch (e: any) { return { ok: false, error: String(e?.message ?? e) } }
}
async function streamToBuffer(s: NodeJS.ReadableStream): Promise<Buffer> { const c: Buffer[] = []; for await (const x of s) c.push(Buffer.from(x as any)); return Buffer.concat(c) }

/** stored_name convention: "r2:<key>" lives in R2, anything else is a path under data/uploads. */
export const isR2Name = (n: string) => n.startsWith('r2:')
export async function openStored(stored: string): Promise<Readable | null> {
  if (isR2Name(stored)) return r2Get(stored.slice(3))
  const full = path.join(dirs.uploads, stored)
  if (!full.startsWith(dirs.uploads) || !fs.existsSync(full)) return null
  return fs.createReadStream(full)
}
/** Move a freshly saved local upload into R2 when R2 is the active store; returns the stored name to persist. */
export async function persistUpload(stored: string, mime: string): Promise<string> {
  if (!useR2()) return stored
  const full = path.join(dirs.uploads, stored)
  const key = `uploads/${stored.replace(/\\/g, '/')}`
  await r2Put(key, fs.readFileSync(full), mime)
  fs.unlinkSync(full)
  return 'r2:' + key
}
export async function removeStored(stored: string) {
  try { if (isR2Name(stored)) await r2Delete(stored.slice(3)); else { const f = path.join(dirs.uploads, stored); if (f.startsWith(dirs.uploads)) fs.rmSync(f, { force: true }) } } catch { /* ignore */ }
}
