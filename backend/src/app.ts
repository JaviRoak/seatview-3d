import cors from 'cors'
import express from 'express'
import { healthRouter } from './routes/health.js'

export function createApp() {
  const app = express()

  app.use(cors({ origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173' }))
  app.use(express.json())

  app.use('/api/health', healthRouter)

  return app
}
