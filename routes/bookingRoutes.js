import express from 'express';
import {
    getCompletedBookings,
    getUpcomingBookings,
    newBooking,
    confirmBooking,
    cancelBooking,
    getReceivedBookings, getBookingDetails,
    getCancelledBookings
} from '../controllers/bookingControllers.js';

const router = express.Router();

// GET
router.get('/booking-details/:bookingId', getBookingDetails);
router.get('/received-bookings', getReceivedBookings);
router.get('/upcoming-bookings', getUpcomingBookings);
router.get('/cancelled-bookings', getCancelledBookings);
router.get('/history', getCompletedBookings);

// POST
router.post('/new', newBooking);

// PUT
router.put('/confirm-booking/:booking_id', confirmBooking);
router.put('/cancel-booking/:booking_id', cancelBooking);

export default router;