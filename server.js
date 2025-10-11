import express from 'express'
import cors from 'cors'
import morgan from 'morgan'
import dotenv from 'dotenv'
import db from './config/db.js'
import colors from 'colors'
import cookieParser from 'cookie-parser';

import authRoutes from './routes/authRoutes.js';
import mediaRoutes from './routes/mediaRoutes.js';
import carRoutes from './routes/carRoutes.js';
import bookingRoutes from './routes/bookingRoutes.js';
import profileRoutes from './routes/profileRoutes.js';
import ratingRoutes from './routes/ratingRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import { notFound, errorHandler } from './utils/errorHandler.js';
import { protect } from './middlewares/authMiddleware.js'

dotenv.config()

const app = express()
const PORT = process.env.PORT

app.use(morgan("dev"))
app.use(express.json())
app.use(cookieParser());
app.use(cors())

// Auth routes must appear before "protect" middleware function
app.use('/api/auth', authRoutes);
app.use('/api/auth', profileRoutes);

app.use('/api/cars', carRoutes);

// Middlewares
app.use(protect);

// Routes
app.use('/api/profile', profileRoutes);
app.use('/api/media', mediaRoutes);
// app.use('/api/cars', carRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/ratings', ratingRoutes);
app.use('/api/notifications', notificationRoutes);

// Error handling middleware
app.use(notFound);
app.use(errorHandler);


app.listen(PORT, () => {
    console.log(`Server is active in ${process.env.NODE_ENV} mode on http://127.0.0.1:${PORT}`.yellow)
});