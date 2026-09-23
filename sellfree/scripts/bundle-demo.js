// Inlines the demo build into one self-contained page (dist-demo/sellfree-demo.html)
import fs from 'node:fs'
import path from 'node:path'

const dir = path.resolve(import.meta.dirname, '..', 'dist-demo')
const js = fs.readFileSync(path.join(dir, 'demo.js'), 'utf8').replace(/<\/script/gi, '<\\/script')
const css = fs.readFileSync(path.join(dir, 'demo.css'), 'utf8').replace(/<\/style/gi, '<\\/style')

const page = `<title>SellFree</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400..700&family=Noto+Sans+Hebrew:wght@400..700&display=swap">
<style>${css}</style>
<div id="root"></div>
<script type="module">${js}</script>
`
fs.writeFileSync(path.join(dir, 'sellfree-demo.html'), page)
console.log(`sellfree-demo.html: ${(page.length / 1024).toFixed(0)} KB`)
