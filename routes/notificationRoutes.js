import express from 'express';
import { protect } from '../middlewares/authMiddleware.js';
import { getNotifications } from '../controllers/notificationControllers.js';

const router = express.Router();

router.get('/get-all-notifications', getNotifications);

export default router;