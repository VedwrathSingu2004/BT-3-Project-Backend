import db from "../config/db.js";

export const newBooking = async (req, res) => {
    const client = await db.getClient();

    try {
        const { car_id, start_date, end_date } = req.body;
        const customer_id = req.user.user_id;

        if (new Date(start_date) > new Date(end_date)) {
            return res.status(400).json({
                success: false,
                message: "End date must be after start date"
            });
        }

        await client.query('BEGIN');

        const carQuery = `
            SELECT price_per_day, owner_id 
            FROM car 
            WHERE car_id = $1
        `;
        const carResult = await client.query(carQuery, [car_id]);

        if (carResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({
                success: false,
                message: "Car does not exist"
            });
        }

        const overlapQuery = `
            SELECT booking_id 
            FROM booking 
            WHERE car_id = $1 
            AND status NOT IN ('cancelled', 'completed')
            AND (
                (start_date, end_date) OVERLAPS ($2::DATE, $3::DATE)
            )
        `;
        const overlapResult = await client.query(overlapQuery, [
            car_id, start_date, end_date
        ]);

        if (overlapResult.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(409).json({
                success: false,
                message: "Car is already booked for the selected dates. Please choose a different date range."
            });
        }

        const { price_per_day, owner_id } = carResult.rows[0];
        const days = (new Date(end_date) - new Date(start_date)) / (1000 * 60 * 60 * 24) + 1;
        const total_price = (days * price_per_day).toFixed(2);

        const bookingQuery = `
            INSERT INTO booking (car_id, customer_id, start_date, end_date, total_price, status)
            VALUES ($1, $2, $3, $4, $5, 'pending')
            RETURNING *
        `;
        const bookingResult = await client.query(bookingQuery, [
            car_id, customer_id, start_date, end_date, total_price
        ]);

        await client.query(
            `INSERT INTO booking_notifications (booking_id, sender_id, receiver_id, message)
             VALUES ($1, $2, $3, $4)`,
            [
                bookingResult.rows[0].booking_id,
                customer_id,
                owner_id,
                'New booking request received for your car.'
            ]
        );

        await client.query('COMMIT');

        res.status(201).json({
            success: true,
            message: "Booking created successfully",
            data: bookingResult.rows[0]
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Booking error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create booking'
        });
    } finally {
        client.release();
    }
};

export const getUpcomingBookings = async (req, res) => {
    try {
        const user_id = req.user.user_id;

        const query = `
            SELECT 
                b.booking_id, b.start_date, b.end_date, b.total_price, b.status, b.deposit_paid,
                c.make, c.reg_number, c.transmission, c.fuel_type, c.seating_capacity AS seats, cp.image_url AS car_images,
                u.name AS customer_name, u.email AS customer_email
            FROM booking b
            JOIN car c ON b.car_id = c.car_id
            LEFT JOIN car_photo cp ON c.car_id = cp.car_id
            JOIN user_accounts u ON b.customer_id = u.user_id
            WHERE 
                (b.customer_id = $1 OR c.owner_id = $1)
                AND b.start_date >= NOW()
                AND b.status IN ('confirmed', 'pending')
            ORDER BY b.start_date ASC;
        `;

        const { rows } = await db.query(query, [user_id]);
        
        res.json({
            success: true,
            count: rows.length,
            data: rows
        });
        
    } catch (error) {
        console.error('Error fetching bookings:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching bookings'
        });
    }
};

export const getCancelledBookings = async (req, res) => {
    try {
        const user_id = req.user.user_id;

        const query = `
            SELECT 
                b.booking_id, b.start_date, b.end_date, b.total_price, b.status,
                b.deposit_paid, c.make, c.reg_number, c.transmission, c.fuel_type, c.seating_capacity AS seats,
                cp.image_url AS car_images, u.name AS customer_name, u.email AS customer_email
            FROM booking b
            JOIN car c ON b.car_id = c.car_id
            LEFT JOIN car_photo cp ON c.car_id = cp.car_id
            JOIN user_accounts u ON b.customer_id = u.user_id
            WHERE 
                (b.customer_id = $1 OR c.owner_id = $1)
                AND b.start_date >= NOW()
                AND b.status IN ('cancelled')
            ORDER BY b.start_date ASC;
        `;

        const { rows } = await db.query(query, [user_id]);
        
        res.json({
            success: true,
            count: rows.length,
            data: rows
        });
        
    } catch (error) {
        console.error('Error fetching bookings:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching bookings'
        });
    }
};

export const getReceivedBookings = async (req, res) => {
    try {
        const user_id = req.user.user_id;

        const query = `
            SELECT 
                b.booking_id, b.start_date, b.end_date, b.total_price,
                b.status, b.deposit_paid, c.make, c.model, c.reg_number,
                u.name AS customer_name, u.email AS customer_email, u.profile_photo
            FROM booking b
            JOIN car c ON b.car_id = c.car_id
            JOIN user_accounts u ON b.customer_id = u.user_id
            WHERE 
                c.owner_id = $1
                AND b.status = 'pending'
            ORDER BY b.start_date ASC
        `;

        const { rows } = await db.query(query, [user_id]);

        res.json({
            success: true,
            count: rows.length,
            data: rows
        });
    } catch (error) {
        console.error('Error fetching bookings:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching bookings'
        });
    }
};

export const getBookingDetails = async (req, res) => {
    try {
        const user_id = req.user.user_id;
        const { bookingId } = req.params;

        const query = `
            SELECT 
                b.booking_id, b.start_date, b.end_date, b.total_price,
                b.status, b.deposit_paid, c.make, c.reg_number,
                u.name AS customer_name, u.email AS customer_email
            FROM booking b
            JOIN car c ON b.car_id = c.car_id
            JOIN user_accounts u ON b.customer_id = u.user_id
            WHERE 
                b.booking_id = $1
        `;

        const { rows } = await db.query(query, [bookingId]);

        res.json({
            success: true,
            count: rows.length,
            data: rows
        });
    } catch (error) {
        console.error('Error fetching bookings:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching bookings'
        });
    }
};

export const getCompletedBookings = async (req, res) => {
    try {
        const user_id = req.user.user_id;
        
        const query = `
            SELECT 
                b.booking_id, b.start_date, b.end_date, b.total_price, b.status, b.deposit_paid,
                c.make, c.reg_number, c.transmission, c.fuel_type, c.seating_capacity AS seats,
                cp.image_url AS car_images, u.name AS customer_name, u.email AS customer_email, r.stars AS rating_given
            FROM booking b
            JOIN car c ON b.car_id = c.car_id
            LEFT JOIN car_photo cp ON c.car_id = cp.car_id
            JOIN user_accounts u ON b.customer_id = u.user_id
            LEFT JOIN rating r 
                ON r.booking_id = b.booking_id 
                AND r.reviewer_id = $1
            WHERE 
                (b.customer_id = $1 OR c.owner_id = $1)
                AND (b.status = 'completed' OR b.end_date < NOW())
            ORDER BY b.end_date DESC;
        `;

        const { rows } = await db.query(query, [user_id]);

        res.json({
            success: true,
            count: rows.length,
            data: rows
        });
    } catch (error) {
        console.error('Error fetching history:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching booking history'
        });
    }
};

export const confirmBooking = async (req, res) => {
    const client = await db.getClient();
    try {
        const booking_id = req.params.booking_id;
        const owner_id = req.user.user_id;

        await client.query('BEGIN');

        const verifyQuery = `
            UPDATE booking 
            SET status = 'confirmed'
            WHERE booking_id = $1
            AND EXISTS (
                SELECT 1 FROM car 
                WHERE car.car_id = booking.car_id AND car.owner_id = $2
            )
            AND status = 'pending'
            RETURNING *`;
        const result = await client.query(verifyQuery, [booking_id, owner_id]);

        if (result.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({
                success: false,
                message: "Booking not found or already confirmed."
            });
        }

        const customerQuery = `
            SELECT customer_id FROM booking WHERE booking_id = $1`;
        const customerResult = await client.query(customerQuery, [booking_id]);
        const customer_id = customerResult.rows[0]?.customer_id;

        const detailsQuery = `
            SELECT 
                b.*, u.name AS customer_name, u.email AS customer_email, u.phone AS customer_phone,
                c.make, c.reg_number, c.fuel_type, c.price_per_day,
                o.name AS owner_name, o.email AS owner_email
            FROM booking b
            JOIN car c ON b.car_id = c.car_id
            JOIN user_accounts u ON b.customer_id = u.user_id
            JOIN user_accounts o ON c.owner_id = o.user_id
            WHERE b.booking_id = $1`;
        const details = await client.query(detailsQuery, [booking_id]);
        const row = details.rows[0];

        await client.query(
            `INSERT INTO booking_notifications (booking_id, sender_id, receiver_id, message)
             VALUES ($1, $2, $3, $4)`,
            [booking_id, owner_id, customer_id, 'Your booking has been confirmed by the car owner.']
        );

        await client.query('COMMIT');

        const data = {
            booking: {
                booking_id: row.booking_id,
                car_id: row.car_id,
                customer_id: row.customer_id,
                start_date: row.start_date,
                end_date: row.end_date,
                status: row.status
            },
            user: {
                name: row.customer_name,
                email: row.customer_email,
                phone: row.customer_phone
            },
            car: {
                make: row.make,
                reg_number: row.reg_number,
                fuel_type: row.fuel_type,
                price_per_day: row.price_per_day,
                owner: {
                    name: row.owner_name,
                    email: row.owner_email
                }
            }
        };

        res.json({
            success: true,
            message: "Booking confirmed successfully",
            data
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Confirmation error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to confirm booking'
        });
    } finally {
        client.release();
    }
};

export const cancelBooking = async (req, res) => {
    const client = await db.getClient();
    try {
        const { booking_id } = req.params;
        const owner_id = req.user.user_id;

        await client.query('BEGIN');

        const verifyQuery = `
            SELECT b.*, c.car_id, c.owner_id
            FROM booking b
            JOIN car c ON b.car_id = c.car_id
            WHERE b.booking_id = $1
            AND c.owner_id = $2
            AND b.status = 'pending'
            FOR UPDATE`;
        const bookingResult = await client.query(verifyQuery, [booking_id, owner_id]);

        if (bookingResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({
                success: false,
                message: "Booking not found, already cancelled, or not your car"
            });
        }

        const cancelQuery = `UPDATE booking SET status = 'cancelled' WHERE booking_id = $1 RETURNING *`;
        const cancelledBookingResult = await client.query(cancelQuery, [booking_id]);

        const detailsQuery = `
            SELECT 
                b.*, u.user_id AS customer_id, u.name AS customer_name, u.email AS customer_email, u.phone AS customer_phone,
                c.car_id, c.make, c.reg_number, c.fuel_type, c.price_per_day,
                o.user_id AS owner_id, o.name AS owner_name, o.email AS owner_email
            FROM booking b
            JOIN car c ON b.car_id = c.car_id
            JOIN user_accounts u ON b.customer_id = u.user_id
            JOIN user_accounts o ON c.owner_id = o.user_id
            WHERE b.booking_id = $1`;
        const detailsResult = await client.query(detailsQuery, [booking_id]);
        const details = detailsResult.rows[0];

        await client.query(`UPDATE car SET is_available = true WHERE car_id = $1`, [details.car_id]);

        await client.query(
            `INSERT INTO booking_notifications (booking_id, sender_id, receiver_id, message)
             VALUES ($1, $2, $3, $4)`,
            [booking_id, owner_id, details.customer_id, 'Your booking request has been cancelled by the car owner.']
        );

        await client.query('COMMIT');

        res.json({
            success: true,
            message: "Booking cancelled successfully",
            data: {
                booking: {
                    booking_id: details.booking_id,
                    status: details.status,
                    start_date: details.start_date,
                    end_date: details.end_date,
                    total_price: details.total_price,
                    created_at: details.created_at,
                    updated_at: details.updated_at
                },
                user: {
                    customer: {
                        customer_id: details.customer_id,
                        name: details.customer_name,
                        email: details.customer_email,
                        phone: details.customer_phone
                    },
                    owner: {
                        owner_id: details.owner_id,
                        name: details.owner_name,
                        email: details.owner_email
                    }
                },
                car: {
                    car_id: details.car_id,
                    make: details.make,
                    reg_number: details.reg_number,
                    fuel_type: details.fuel_type,
                    price_per_day: details.price_per_day
                }
            }
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Cancellation error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to cancel booking'
        });
    } finally {
        client.release();
    }
};