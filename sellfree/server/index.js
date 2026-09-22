import express from 'express'
import fs from 'node:fs'
import path from 'node:path'
import './db.js'
import authRoutes from './routes/auth.js'
import listingRoutes from './routes/listings.js'
import conversationRoutes from './routes/conversations.js'

const app = express()
app.use(express.json({ limit: '15mb' }))

app.use('/api/auth', authRoutes)
app.use('/api/listings', listingRoutes)
app.use('/api/conversations', conversationRoutes)
app.use('/api', (req, res) => res.status(404).json({ error: 'not_found' }))

app.use((err, req, res, next) => {
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'invalid_input' })
  console.error(err)
  res.status(500).json({ error: 'generic' })
})

// Serve the built client when it exists (npm run build)
const dist = path.join(import.meta.dirname, '..', 'dist')
if (fs.existsSync(dist)) {
  app.use(express.static(dist))
  app.get('*', (req, res) => res.sendFile(path.join(dist, 'index.html')))
}

const port = Number(process.env.PORT) || 3001
app.listen(port, () => console.log(`SellFree API on http://localhost:${port}`))
