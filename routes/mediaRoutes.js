import express from 'express';
import upload from '../middlewares/upload.js';
import { protect } from '../middlewares/authMiddleware.js';
import cloudinary from '../config/cloudinary.js';
import {
    uploadToCloudinary
} from '../config/cloudinary.js';

const router = express.Router();

router.post('/upload', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) throw new Error('No file uploaded');

        const result = await uploadToCloudinary(req.file.buffer, {
            folder: 'car_rental',
            public_id: `${req.user.user_id}-${Date.now()}`
        });

        res.json({
            success: true,
            url: result.secure_url,
            publicId: result.public_id
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
});

router.delete(
    '/delete/:publicId',
    protect,
    async (req, res) => {
        try {
            const {
                publicId
            } = req.params;

            const isOwner = publicId.startsWith(req.user.user_id);
            if (!isOwner) throw new Error('Not authorized to delete this file');

            await deleteFromCloudinary(publicId);

            res.json({
                success: true,
                message: 'File deleted successfully'
            });
        } catch (error) {
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }
);

router.put(
    '/update/:publicId',
    protect,
    upload.single('file'),
    async (req, res) => {
        try {
            const {
                publicId
            } = req.params;
            if (!req.file) throw new Error('No file uploaded');

            await deleteFromCloudinary(publicId);

            const result = await uploadToCloudinary(req.file.buffer, {
                folder: 'car_rental',
                public_id: publicId
            });

            res.json({
                success: true,
                url: result.secure_url,
                publicId: result.public_id
            });
        } catch (error) {
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }
);

export const deleteFromCloudinary = async (publicId) => {
  return new Promise((resolve, reject) => {
    cloudinary.uploader.destroy(publicId, (error, result) => {
      if (error) reject(error);
      else resolve(result);
    });
  });
};

export default router;