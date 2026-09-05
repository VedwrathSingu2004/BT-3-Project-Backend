import express from 'express';
import { updateProfile, updateProfilePhoto } from '../controllers/profileUpdateControllers.js';
import { protect } from "../middlewares/authMiddleware.js";
import upload from "../middlewares/upload.js";

const router = express.Router();

router.put(
    '/update-profile',
    protect,
    upload.single('document'),
    updateProfile
);

router.put(
    '/update-profile-photo',
    protect,
    upload.single('photo'),
    updateProfilePhoto
);

export default router;