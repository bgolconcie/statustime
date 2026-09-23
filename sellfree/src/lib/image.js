// Screenshots stay readable at this size (Claude reads up to 2576px on the long edge)
const MAX_UPLOAD_SIZE = 2000
// Anything smaller than this on its short side is too small to read
export const MIN_READABLE_SIZE = 400

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => resolve({ img, url })
    img.onerror = (e) => {
      URL.revokeObjectURL(url)
      reject(e)
    }
    img.src = url
  })
}

// Downscales an upload to keep requests and the database small; also reports its original size
export async function readUpload(file, maxSize = MAX_UPLOAD_SIZE) {
  const { img, url } = await loadImage(file)
  const scale = Math.min(1, maxSize / Math.max(img.width, img.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(img.width * scale)
  canvas.height = Math.round(img.height * scale)
  canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
  URL.revokeObjectURL(url)
  return { dataUrl: canvas.toDataURL('image/jpeg', 0.85), width: img.width, height: img.height }
}
