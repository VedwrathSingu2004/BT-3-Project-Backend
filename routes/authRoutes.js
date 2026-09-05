import express from 'express';
import {
    registerUser,
    loginUser,
    logoutUser,
    getMe,
    forgotPassword,
    verifyOtp,
    resetPassword,
    startOtpCleanupJob,
    sendRegisterOTP,
} from '../controllers/authControllers.js';
import {
    protect
} from '../middlewares/authMiddleware.js';

const router = express.Router();

router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/logout', logoutUser);
router.get('/me', protect, getMe);
router.post('/forgot-password', forgotPassword);
router.post("/verify-otp", verifyOtp);
router.post("/reset-password", resetPassword);
router.post("/clear-otp", startOtpCleanupJob);

startOtpCleanupJob();

export default router;