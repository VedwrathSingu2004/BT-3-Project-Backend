import db from "../config/db.js";

export const getNotifications = async (req, res) => {
    try {
        const user_id = req.user.user_id;

        const query = `
            SELECT 
                n.notification_id,
                n.booking_id,
                n.sender_id,
                n.receiver_id,
                n.message,
                n.is_read,
                n.created_at,
                s.name AS sender_name,
                s.email AS sender_email,
                b.status AS booking_status,
                c.make AS car_make,
                c.reg_number AS car_reg_number
            FROM booking_notifications n
            JOIN user_accounts s ON n.sender_id = s.user_id
            LEFT JOIN booking b ON n.booking_id = b.booking_id
            LEFT JOIN car c ON b.car_id = c.car_id
            WHERE n.receiver_id = $1
            ORDER BY n.created_at DESC
        `;

        const { rows } = await db.query(query, [user_id]);

        res.status(200).json({
            success: true,
            count: rows.length,
            data: rows
        });
    } catch (error) {
        console.error("Error fetching notifications:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch notifications."
        });
    }
};