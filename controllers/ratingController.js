import db from '../config/db.js';

export const addRating = async (req, res) => {
    const client = await db.getClient();
    try {
        const { bookingId } = req.params;
        const { stars, comments } = req.body;
        const user_id = req.user.user_id;

        await client.query('BEGIN');

        const bookingQuery = `
            SELECT b.booking_id, b.customer_id, c.owner_id
            FROM booking b
            JOIN car c ON b.car_id = c.car_id
            WHERE b.booking_id = $1
              AND b.customer_id = $2
              AND b.status = 'completed'
            FOR UPDATE
        `;
        const bookingResult = await client.query(bookingQuery, [bookingId, user_id]);
        if (bookingResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ success: false, message: 'Booking not found, not completed, or not owned by user' });
        }

        const booking = bookingResult.rows[0];

        const existingRating = await client.query(
            `SELECT rating_id FROM rating WHERE booking_id = $1 AND reviewer_id = $2`,
            [bookingId, user_id]
        );
        if (existingRating.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ success: false, message: 'You have already rated this booking' });
        }

        const insertRating = `
            INSERT INTO rating (booking_id, reviewer_id, reviewee_id, stars, comments)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *
        `;
        const ratingResult = await client.query(insertRating, [
            bookingId,
            user_id,
            booking.owner_id,
            stars,
            comments || null
        ]);

        await client.query('COMMIT');

        res.status(201).json({
            success: true,
            message: 'Rating added successfully',
            data: ratingResult.rows[0]
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Add rating error:', error.message);
        res.status(500).json({ success: false, message: 'Failed to add rating.' });
    } finally {
        client.release();
    }
};

export const getOwnerRatings = async (req, res) => {
    const client = await db.getClient();
    try {
        const owner_id = req.user.user_id;

        const query = `
            SELECT 
                r.rating_id,
                r.stars,
                r.comments,
                r.created_at,
                u.user_id AS reviewer_id,
                u.name AS reviewer_name,
                u.email AS reviewer_email,
                b.booking_id,
                c.car_id,
                c.make,
                c.reg_number
            FROM rating r
            JOIN user_accounts u ON r.reviewer_id = u.user_id
            JOIN booking b ON r.booking_id = b.booking_id
            JOIN car c ON b.car_id = c.car_id
            WHERE r.reviewee_id = $1
            ORDER BY r.created_at DESC
        `;

        const result = await client.query(query, [owner_id]);

        res.json({
            success: true,
            count: result.rows.length,
            data: result.rows
        });
    } catch (error) {
        console.error('Get owner ratings error:', error);
        res.status(500).json({ success: false, message: 'Failed to retrieve ratings: '+error.message });
    } finally {
        client.release();
    }
};