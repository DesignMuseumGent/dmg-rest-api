import { rateLimit } from 'express-rate-limit'

export const publicLimiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    limit: 120,
    message: { status: 429, error: 'Too many requests. Please slow down.' },
    legacyHeaders: false,
    standardHeaders: 'draft-8'
})

export const harvestLimiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    limit: 300,
    message: { status: 429, error: 'Too many requests. Please slow down.' },
    legacyHeaders: false,
    standardHeaders: 'draft-8'
})

export const aggregationLimiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    limit: 20,
    message: { status: 429, error: 'Too many requests. Please slow down.' },
    legacyHeaders: false,
    standardHeaders: 'draft-8'
})

export const privateLimiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    limit: 600,
    message: { status: 429, error: 'Too many requests. Please slow down.' },
    legacyHeaders: false,
    standardHeaders: 'draft-8'
})