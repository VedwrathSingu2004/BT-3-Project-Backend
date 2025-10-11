import express from 'express';
import {
    addRating,
    getOwnerRatings
} from '../controllers/ratingController.js';
import { protect, authorize } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.post('/add-rating/:bookingId', addRating);
router.get('/owner-ratings', protect, getOwnerRatings);

export default router;