import crypto from 'node:crypto'
import { PROOF_IDS, REQUIRED_PROOFS } from '../src/lib/catalog.js'

const MAX_IMAGE_LENGTH = 2_000_000

// Uploads are re-encoded by the client; only accept raster formats
export const isUpload = (image) =>
  typeof image === 'string' && /^data:image\/(jpeg|png|webp);base64,/.test(image) && image.length <= MAX_IMAGE_LENGTH

// All required slots filled, and any optional slot that is filled holds a real upload
export const hasAllProofs = (proofs) =>
  REQUIRED_PROOFS.every((kind) => isUpload(proofs?.[kind])) &&
  PROOF_IDS.every((kind) => proofs?.[kind] == null || isUpload(proofs[kind]))

// Identifies the exact set of images an appraisal was made from
export const proofsHash = (proofs) =>
  crypto.createHash('sha256').update(PROOF_IDS.map((kind) => proofs[kind] ?? '').join('|')).digest('hex')
