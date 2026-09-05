import dotenv from 'dotenv';

dotenv.config();

export default {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    cookieName: process.env.JWT_COOKIE_NAME || 'carrental_token',
};