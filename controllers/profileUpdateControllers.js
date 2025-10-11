import db from '../config/db.js';
import cloudinary from 'cloudinary';
import { uploadToCloudinary } from "../config/cloudinary.js";

cloudinary.v2.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

export const updateProfile = async (req, res) => {
    try {
        const { phone, dob, gender } = req.body;
        let documentUrl = null;

        if (req.file) {
            const result = await uploadToCloudinary(req.file.buffer, {
                folder: 'car_rental/user_documents',
                public_id: `${req.user.user_id}-${Date.now()}`
            });

            documentUrl = result.secure_url;
        }

        await db.query(
            `UPDATE user_accounts 
                   SET phone = $1, dob = $2, gender = $3, document_url = $4
                   WHERE user_id = $5`,
            [phone, dob, gender, documentUrl, req.user.user_id]
        );

        res.status(200).json({
            success: true,
            message: "Profile updated successfully.",
        });
    } catch (error) {
        console.error("Error updating profile:");
        res.status(500).json({
            success: false,
            message: "An error occurred while updating the profile.",
        });
    }
};

export const updateProfilePhoto = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: "No photo uploaded",
            });
        }

        const result = await uploadToCloudinary(req.file.buffer, {
            folder: "car_rental/profile_photos",
            public_id: `${req.user.user_id}-${Date.now()}`,
            resource_type: "image"
        });

        const photoUrl = result.secure_url;

        await db.query(
            `UPDATE user_accounts 
           SET profile_photo = $1 
           WHERE user_id = $2`,
            [photoUrl, req.user.user_id]
        );

        res.status(200).json({
            success: true,
            message: "Profile photo updated successfully.",
            profile_photo: photoUrl,
        });
    } catch (error) {
        console.error("Error updating profile photo:", error);
        res.status(500).json({
            success: false,
            message: "An error occurred while updating the profile photo.",
        });
    }
};