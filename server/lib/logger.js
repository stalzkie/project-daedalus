import { createLogger, format, transports } from 'winston'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const LOG_DIR   = join(__dirname, '..', 'logs')

const logFmt = format.printf(({ timestamp, level, message, ...meta }) => {
  const extras = Object.keys(meta).length ? ' ' + JSON.stringify(meta) : ''
  return `${timestamp} [${level.toUpperCase().padEnd(5)}] ${message}${extras}`
})

export const logger = createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: format.combine(format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), logFmt),
  transports: [
    new transports.Console({ format: format.combine(format.colorize(), format.timestamp({ format: 'HH:mm:ss' }), logFmt) }),
    new transports.File({ filename: join(LOG_DIR, 'spacetrack.log'), maxsize: 5_242_880, maxFiles: 3 }),
  ],
})
