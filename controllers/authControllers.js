import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import jwtConfig from '../config/jwt.js';
import db from '../config/db.js';

import nodemailer from "nodemailer";
import crypto from "crypto";
import cron from "node-cron";
// import bcrypt from "bcryptjs";

const generateToken = (id, name, email, phone, gender, dob, profile_photo) => {
    return jwt.sign({
        id, name, email, phone, gender, dob, profile_photo
    }, jwtConfig.secret, {
        expiresIn: jwtConfig.expiresIn,
    });
};

export const registerUser = async (req, res) => {
    const { name, email, password } = req.body;

    try {
        const existingUser = await db.query(
            'SELECT * FROM user_accounts WHERE email = $1',
            [email]
        );

        if (existingUser.rows.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'User already exists with this email',
            });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const newUser = await db.query(
            `INSERT INTO user_accounts
                 (name, email, password_hash, dob, gender)
             VALUES ($1, $2, $3, $4, $5)
                 RETURNING user_id, name, email, created_at, dob, gender`,
            [name, email, hashedPassword, null, null]
        );

        const token = generateToken(
            newUser.rows[0].user_id,
            newUser.rows[0].name,
            newUser.rows[0].email,
            null,
            newUser.rows[0].gender,
            newUser.rows[0].dob
        );

        res.cookie(jwtConfig.cookieName, token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 365 * 24 * 60 * 60 * 1000,
        });

        res.status(201).json({
            success: true,
            data: newUser.rows[0],
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error during registration',
        });
    }
};

export const loginUser = async (req, res) => {
    const {
        email,
        password
    } = req.body;

    try {
        const user = await db.query(
            'SELECT * FROM user_accounts WHERE email = $1',
            [email]
        );

        if (user.rows.length === 0) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials',
            });
        }

        const isValidPassword = await bcrypt.compare(
            password,
            user.rows[0].password_hash
        );

        if (!isValidPassword) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials',
            });
        }
        const token = generateToken(
            user.rows[0].user_id,
            user.rows[0].name,
            user.rows[0].email,
            user.rows[0].phone,
            user.rows[0].gender,
            new Date(user.rows[0].dob).toLocaleDateString('en-GB', { timeZone: 'Asia/Kolkata' }),
            user.rows[0].profile_photo
        );

        res.cookie(jwtConfig.cookieName, token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000,
        });

        res.status(200).json({
            success: true,
            data: {
                user_id: user.rows[0].user_id,
                name: user.rows[0].name,
                email: user.rows[0].email,
                dob: user.rows[0].dob,
                gender: user.rows[0].gender,
                profile_photo: user.rows[0].profile_photo
            },
            token
        });
    } catch (error) {
        console.error('Login error:'.red, error);
        res.status(500).json({
            success: false,
            message: 'Server error during login',
        });
    }
};

export const logoutUser = (req, res) => {
    res.cookie(jwtConfig.cookieName, '', {
        httpOnly: true,
        expires: new Date(0),
    });

    res.status(200).json({
        success: true,
        message: 'Logged out successfully',
    });
};

export const getMe = async (req, res) => {
    try {
        const user = await db.query(
            'SELECT user_id, name, email, phone, created_at FROM user_accounts WHERE user_id = $1',
            [req.user.user_id]
        );

        res.status(200).json({
            success: true,
            data: user.rows[0],
        });
    } catch (error) {
        console.error('Get user error:'.red, error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching user',
        });
    }
};

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL,
    pass: process.env.EMAIL_PASS,
  },
});

function generateOTP() {
  return crypto.randomInt(100000, 999999).toString();
}

export const forgotPassword = async (req, res) => {

    console.log("11");
  const { email } = req.body;
  console.log("1");

  try {
    // Check if email exists
    const userResult = await db.query("SELECT * FROM user_accounts WHERE email = $1", [email]);
    if (userResult.rows.length === 0) {
      return res.json({ success: false, message: "email not registered" });
    }
    console.log("2");
    // Generate OTP
    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes expiry

    // Save OTP in password_resets table
    await db.query(
      "INSERT INTO password_resets (email, otp, expires_at) VALUES ($1, $2, $3)",
      [email, otp, expiresAt]
    );

    // Send OTP via email
    await transporter.sendMail({
      from: "your-email@gmail.com",
      to: email,
      subject: "Password Reset OTP",
      text: `Your OTP is ${otp}. It will expire in 5 minutes.`,
    });

    return res.json({ success: true, message: "OTP sent to email" });
  } catch (error) {
    console.error("Forgot Password Error:", error);
    return res.status(500).json({ success: false, message: "Error in forgot password", error });
  }
};

export const verifyOtp = async (req, res) => {
  const { email, otp } = req.body;

  try {
    const otpResult = await db.query(
      "SELECT * FROM password_resets WHERE email = $1 ORDER BY created_at DESC LIMIT 1",
      [email]
    );

    if (otpResult.rows.length === 0) {
      return res.json({ success: false, message: "No OTP found for this email" });
    }

    const { otp: storedOtp, expires_at } = otpResult.rows[0];

    if (new Date() > expires_at) {
      return res.json({ success: false, message: "OTP expired" });
    }

    if (otp !== storedOtp) {
      return res.json({ success: false, message: "Invalid OTP" });
    }

    return res.json({ success: true, message: "OTP verified successfully" });
  } catch (error) {
    console.error("Verify OTP Error:", error);
    return res.status(500).json({ success: false, message: "Error verifying OTP", error });
  }
};

// Reset Password function
export const resetPassword = async (req, res) => {
  const { email, otp, newPassword } = req.body;

  try {
    const otpResult = await db.query(
      "SELECT * FROM password_resets WHERE email = $1 ORDER BY created_at DESC LIMIT 1",
      [email]
    );

    if (otpResult.rows.length === 0) {
      return res.json({ success: false, message: "No OTP found for this email" });
    }

    const { otp: storedOtp, expires_at } = otpResult.rows[0];

    if (new Date() > expires_at) {
      return res.json({ success: false, message: "OTP expired" });
    }

    if (otp !== storedOtp) {
      return res.json({ success: false, message: "Invalid OTP" });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await db.query("UPDATE user_accounts SET password_hash = $1 WHERE email = $2", [
      hashedPassword,
      email,
    ]);

    return res.json({ success: true, message: "Password reset successful" });
  } catch (error) {
    console.error("Reset Password Error:", error);
    return res.status(500).json({ success: false, message: "Error resetting password", error });
  }
};


export const startOtpCleanupJob = () => {
  cron.schedule("*/5 * * * *", async () => {
    try {
      const result = await db.query(
        "DELETE FROM password_resets WHERE expires_at < NOW()"
      );
      if (result.rowCount > 0) {
        console.log(`🧹 OTP Cleanup: ${result.rowCount} expired OTP(s) removed`);
      }
    } catch (error) {
      console.error("OTP Cleanup Error:", error);
    }
  });

  console.log("OTP cleanup job started (runs every 5 minutes)");
};