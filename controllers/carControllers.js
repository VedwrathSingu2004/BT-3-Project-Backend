import db from "../config/db.js";
import media from "../routes/mediaRoutes.js";
import { uploadToCloudinary } from "../config/cloudinary.js";
import { v2 as cloudinary } from "cloudinary";
import multer from "multer";

const storage = multer.memoryStorage();
const upload = multer({ storage });

export const listCars = async (req, res) => {
    try {
        const { filters = {}, pagination = {} } = req.body;
        const { make, fuel_type, min_price, max_price, is_available } = filters;

        const page = parseInt(pagination.page) || 1;
        const limit = parseInt(pagination.limit) || 10;
        const offset = (page - 1) * limit;

        let query = `
            SELECT 
                c.car_id, c.owner_id, c.make, c.reg_number, 
                c.fuel_type, c.price_per_day, c.is_available,
                ARRAY(
                    SELECT cp.image_url 
                    FROM car_photo cp 
                    WHERE cp.car_id = c.car_id
                    ORDER BY cp.taken_at DESC
                ) AS photos
            FROM car c
            WHERE 1=1
        `;
        const values = [];
        let paramIndex = 1;

        if (make) {
            values.push(`%${make}%`);
            query += ` AND make ILIKE $${paramIndex++}`;
        }

        if (fuel_type) {
            values.push(fuel_type);
            query += ` AND fuel_type = $${paramIndex++}`;
        }

        if (min_price !== undefined) {
            values.push(min_price);
            query += ` AND price_per_day >= $${paramIndex++}`;
        }

        if (max_price !== undefined) {
            values.push(max_price);
            query += ` AND price_per_day <= $${paramIndex++}`;
        }

        if (is_available !== undefined) {
            values.push(is_available);
            query += ` AND is_available = $${paramIndex++}`;
        }

        const countQuery = `SELECT COUNT(*) FROM (${query}) as total`;

        query += `
            ORDER BY created_at DESC
            LIMIT $${paramIndex++}
            OFFSET $${paramIndex}
        `;
        values.push(limit, offset);

        const cars = await db.query(query, values);
        const totalResult = await db.query(countQuery, values.slice(0, -2));
        const total = parseInt(totalResult.rows[0].count, 10);

        res.json({
            success: true,
            count: cars.rows.length,
            total,
            totalPages: Math.ceil(total / limit),
            currentPage: page,
            data: cars.rows
        });

    } catch (error) {
        console.error('Error fetching cars:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching cars',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

export const displayCarDetails = async (req, res) => {
    try {
        const { id } = req.body;

        // Basic string check
        if (!id || typeof id !== 'string') {
            return res.status(400).json({ message: 'Car ID is required and must be a string' });
        }

        var query = `
            SELECT 
                c.car_id, c.owner_id, c.make, c.reg_number, c.model, c.color, c.seating_capacity, c.transmission, c.deposit, c.rent_price,
                c.fuel_type, c.price_per_day, c.is_available,
                ARRAY(
                    SELECT cp.image_url 
                    FROM car_photo cp 
                    WHERE cp.car_id = c.car_id
                    ORDER BY cp.taken_at DESC
                ) AS photos
            FROM car c
            WHERE c.car_id = $1
        `;

        var result = await db.query(query, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Car not found' });
        }
        console.log(result.rows)

        const car = result.rows[0];

        query = `
            SELECT name, phone
            FROM user_accounts
            WHERE user_id = $1
        `;
        result = await db.query(query, [car.owner_id]);
        const owner = result.rows[0];

        return res.status(200).json({
            success: true,
            data: {
                owner_name: owner.name,
                owner_contact: owner.phone,
                make: car.make,
                model: car.model,
                color: car.color,
                seating_capacity: car.seating_capacity,
                fuel_type: car.fuel_type,
                transmission: car.transmission,
                deposit: car.deposit,
                rent_price: car.rent_price,
                car_images: car.photos
            }
        });
    } catch (error) {
        console.error('Error in displayCarDetails:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

export const uploadCarPhoto = async (req, res) => {
    try {
        const {
            uploaded_by,
            id,
            front,
            back,
            right,
            left,
            odometer,
            optionalPhotos
        } = req.body;

        if (!req.file) throw new Error('No file uploaded');
        if (!id || !front || !back || !right || !left || !odometer) {
            return res.status(400).json({
                success: false,
                message: "car_id and all 5 mandatory image URLs (front, back, right, left, odometer) are required."
            });
        }

        // Build complete image list
        let imageUrls = [front, back, right, left, odometer];

        if (Array.isArray(optionalPhotos) && optionalPhotos.length > 0) {
            // Filter out any empty strings/nulls just in case
            const cleanOptional = optionalPhotos.filter(url => typeof url === 'string' && url.trim() !== '');
            imageUrls = imageUrls.concat(cleanOptional);
        }

        // Save to database
        const query = `
      INSERT INTO car_photo (uploaded_by, car_id, image_url)
      VALUES ($1, $2, $3)
    `;

        await db.query(query, [uploaded_by, id, imageUrls]);

        return res.status(200).json({
            success: true,
            message: "Photos uploaded successfully"
            // ,url: result.secure_url,
            // publicId: result.public_id
        });

    } catch (error) {
        console.error("Upload error:", error);
        return res.status(500).json({
            success: false,
            message: "Internal Server Error"
        });
    }
};

export const addCar = async (req, res) => {
  try {
    const {
      owner_id,
      make,
      reg_number,
      fuel_type,
      price_per_day,
      model,
      transmission,
      deposit,
      color,
      seating_capacity,
      uploaded_by
    } = req.body;

    //Mandatory images check
    const requiredKeys = ["front", "back", "right", "left", "odometer"];
    const missingKeys = requiredKeys.filter(key => !req.files[key]);
    if (missingKeys.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Missing mandatory images: ${missingKeys.join(", ")}`
      });
    }

    //Insert car details
    const carQuery = `
      INSERT INTO car (
        owner_id, make, reg_number, fuel_type, price_per_day,
        created_at, model, transmission, deposit, color, seating_capacity
      )
      VALUES ($1, $2, $3, $4, $5, NOW(), $6, $7, $8, $9, $10)
      RETURNING car_id
    `;
    const carValues = [
      owner_id, make, reg_number, fuel_type, price_per_day,
      model, transmission, deposit, color, seating_capacity
    ];
    const carResult = await db.query(carQuery, carValues);
    const car_id = carResult.rows[0].car_id;

    //Upload photos to Cloudinary
    let imageUrls = [];

    for (let key of requiredKeys) {
      const file = req.files[key][0];
      const result = await uploadToCloudinary(file.buffer, { folder: "cars" });
      imageUrls.push(result.secure_url);
    }

    // Optional photos
    if (req.files.optionalPhotos) {
      for (let file of req.files.optionalPhotos) {
        const result = await uploadToCloudinary(file.buffer, { folder: "cars" });
        imageUrls.push(result.secure_url);
      }
    }

    //Save photos in DB
    const photoQuery = `
      INSERT INTO car_photo (uploaded_by, car_id, image_url, taken_at)
      VALUES ($1, $2, $3, NOW())
    `;
    await db.query(photoQuery, [uploaded_by, car_id, imageUrls]);

    //Success response
    res.status(201).json({
      success: true,
      message: "Car added successfully with photos",
      car_id,
      photos: imageUrls
    });

  } catch (error) {
    console.error("Add Car Error:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

export const removeCar = async (req, res) => {
  try {
    const { car_id } = req.body;
    if (!car_id) {
      return res.status(400).json({ success: false, message: "car_id is required" });
    }

    //Get all images of the car
    const photosResult = await db.query(
      `SELECT image_url FROM car_photo WHERE car_id = $1`,
      [car_id]
    );

    const photos = photosResult.rows[0]?.image_url || [];

    //Delete each photo from Cloudinary
    for (let url of photos) {
      try {
        // URL se public_id extract karo
        const parts = url.split("/"); // https://res.cloudinary.com/demo/image/upload/cars/front.jpg
        const filename = parts[parts.length - 1].split(".")[0]; // "front"
        const folder = "cars"; // same folder jahan upload kiya tha
        const public_id = `${folder}/${filename}`;

        await cloudinary.uploader.destroy(public_id, { resource_type: "image" });
      } catch (err) {
        console.warn("Cloudinary delete warning:", err.message);
      }
    }

    //Delete photos from DB
    await db.query(`DELETE FROM car_photo WHERE car_id = $1`, [car_id]);

    //Delete car from DB
    await db.query(`DELETE FROM car WHERE car_id = $1`, [car_id]);

    res.status(200).json({ success: true, message: "Car and its photos removed successfully" });

  } catch (error) {
    console.error("Remove Car Error:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

export const addToFav = async (req, res) => {
  try {
    const { user_id, car_id } = req.body;

    // 🧩 Step 1: Validate inputs
    if (!user_id || !car_id) {
      return res.status(400).json({
        success: false,
        message: "user_id and car_id are required",
      });
    }

    // 🧩 Step 2: Check if user already has a favourites record
    const existingUser = await db.query(
      "SELECT favorite_cars_id FROM user_favorite_cars WHERE user_id = $1",
      [user_id]
    );

    if (existingUser.rows.length === 0) {
      // 🧩 Step 3: If no record, create new entry with this car
      await db.query(
        "INSERT INTO user_favorite_cars (user_id, favorite_cars_id) VALUES ($1, ARRAY[$2]::uuid[])",
        [user_id, car_id]
      );
    } else {
      const favoriteCars = existingUser.rows[0].favorite_cars_id;

      // 🧩 Step 4: Check if car already in favourites
      if (favoriteCars.includes(car_id)) {
        return res.status(200).json({
          success: true,
          message: "Car is already in favourites",
        });
      }

      // 🧩 Step 5: Otherwise, add to favourites array
      await db.query(
        "UPDATE user_favorite_cars SET favorite_cars_id = array_append(favorite_cars_id, $1) WHERE user_id = $2",
        [car_id, user_id]
      );
    }

    // 🧩 Step 6: Send success response
    res.status(200).json({
      success: true,
      message: "Car added to favourites successfully",
    });
  } catch (error) {
    console.error("error in addToFav:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};


export const removeFromFav = async (req, res) => {
  try {
    const { user_id, car_id } = req.body;

    // 🧩 Step 1: Validate inputs
    if (!user_id || !car_id) {
      return res.status(400).json({
        success: false,
        message: "user_id and car_id are required",
      });
    }

    // 🧩 Step 2: Check if user has a favourites record
    const existingUser = await db.query(
      "SELECT favorite_cars_id FROM user_favorite_cars WHERE user_id = $1",
      [user_id]
    );

    if (existingUser.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No favourites found for this user",
      });
    }

    const favoriteCars = existingUser.rows[0].favorite_cars_id;

    // 🧩 Step 3: Check if car is actually in favourites
    if (!favoriteCars.includes(car_id)) {
      return res.status(404).json({
        success: false,
        message: "Car not found in favourites",
      });
    }

    // 🧩 Step 4: Remove the car from the array
    await db.query(
      "UPDATE user_favorite_cars SET favorite_cars_id = array_remove(favorite_cars_id, $1) WHERE user_id = $2",
      [car_id, user_id]
    );

    // 🧩 Step 5: Success response
    res.status(200).json({
      success: true,
      message: "Car removed from favourites successfully",
    });
  } catch (error) {
    console.error("error in removeFromFav:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};



export const temp = async(req,res) => {
  res.status(200).json({
      success: true,
      message: "success"
    });
}

// INSERT INTO car_photo (car_id, image_url)
// VALUES (
//   'd3b07384-d9a0-4f8b-a21a-4a60b0c5c6ed',  -- example car_id (UUID)
//   ARRAY[
//     'https://example.com/car_front.jpg',
//     'https://example.com/car_back.jpg',
//     'https://example.com/car_left.jpg',
//     'https://example.com/car_right.jpg',
//     'https://example.com/car_interior.jpg',
//     'https://example.com/car_engine.jpg'   -- optional 6th photo
//   ]
// );