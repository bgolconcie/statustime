import crypto from 'node:crypto'
import { PHONE_PROOFS } from '../src/lib/catalog.js'

const MAX_IMAGE_LENGTH = 2_000_000

// Uploads are re-encoded by the client; only accept raster formats
export const isUpload = (image) =>
  typeof image === 'string' && /^data:image\/(jpeg|png|webp);base64,/.test(image) && image.length <= MAX_IMAGE_LENGTH

export const hasAllProofs = (proofs) => PHONE_PROOFS.every((kind) => isUpload(proofs?.[kind]))

// Identifies the exact photo + screenshots an appraisal was made from
export const proofsHash = (proofs, photo) =>
  crypto.createHash('sha256').update([photo, ...PHONE_PROOFS.map((kind) => proofs[kind])].join('|')).digest('hex')
