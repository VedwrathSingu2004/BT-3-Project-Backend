import jwt from 'jsonwebtoken';
import db from '../config/db.js';
import jwtConfig from '../config/jwt.js';

export const protect = async (req, res, next) => {
    try {
        let token = req.cookies[jwtConfig.cookieName];
        if (!token && req.headers.authorization?.startsWith('Bearer')) {
            token = req.headers.authorization.split(" ")[1];
        }

        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'Not authorized, no token provided',
            });
        }

        const decoded = jwt.verify(token, jwtConfig.secret);
        console.log(decoded);

        const user = await db.query(
            'SELECT user_id, name, email, phone FROM user_accounts WHERE user_id = $1',
            [decoded.id]
        );

        if (!user.rows[0]) {
            return res.status(401).json({
                success: false,
                message: 'User belonging to this token no longer exists',
            });
        }

        req.user = user.rows[0];
        next();
    } catch (error) {
        return res.status(401).json({
            success: false,
            message: 'Not authorized, token failed: ' + error.message,
        });
    }
};

export const authorize = (...roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: `User role ${req.user.role} is not authorized to access this route`,
            });
        }
        next();
    };
};