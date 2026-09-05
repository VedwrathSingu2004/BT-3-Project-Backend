import express from 'express'
import cors from 'cors'
import morgan from 'morgan'
import dotenv from 'dotenv'
import db from './config/db.js'
import cookieParser from 'cookie-parser'

import authRoutes from './routes/authRoutes.js'
import mediaRoutes from './routes/mediaRoutes.js'
import carRoutes from './routes/carRoutes.js'
import bookingRoutes from './routes/bookingRoutes.js'
import profileRoutes from './routes/profileRoutes.js'
import ratingRoutes from './routes/ratingRoutes.js'
import notificationRoutes from './routes/notificationRoutes.js'
import { notFound, errorHandler } from './utils/errorHandler.js'
import { protect } from './middlewares/authMiddleware.js'
import { sendRegisterOTP } from './controllers/authControllers.js'

dotenv.config()

export default async function handler(req, res) {
    const app = express()
    const PORT = process.env.PORT || 3000

    // Middlewares
    app.use(morgan("dev"))
    app.use(express.json())
    app.use(cookieParser())
    app.use(cors())

    // Auth routes must appear before "protect" middleware
    app.use('/api/auth', authRoutes)
    // app.use('/api/auth', profileRoutes)

    app.use('/api/cars', carRoutes)

    app.use('/api/send-register-otp', sendRegisterOTP);

    // Middlewares
    // app.use(protect)

    // Routes
    app.get('/', (req, res) => {
        res.send('Hello from Express v5 on Vercel!')
    })

    app.get('/test', async (req, res) => {
        try {
            // some async operation
            res.send('Success')
        } catch (err) {
            console.error(err)
            res.status(500).send('Server Error')
        }
    })

    app.use('/api/profile', protect, profileRoutes)
    app.use('/api/media', protect, mediaRoutes)
    app.use('/api/bookings', protect, bookingRoutes)
    app.use('/api/ratings', protect, ratingRoutes)
    app.use('/api/notifications', protect, notificationRoutes)

    // Error handling middleware
    app.use(notFound)
    app.use(errorHandler)

    
    // Call the app as a function to handle the current request
    await app(req, res)
}
