import express from 'express';
import db from '../config/db.js';
import { listCars, displayCarDetails, uploadCarPhoto, addCar, removeCar, temp, addToFav, removeFromFav, updateCar, fetchOwnerCars, myFavCars } from '../controllers/carControllers.js';
// import { protect } from '../middlewares/authMiddleware.js';
import multer from "multer";
import { protect } from '../middlewares/authMiddleware.js';

// Memory storage setup
const storage = multer.memoryStorage();
const upload = multer({ storage });


const router = express.Router();

/**
 * Request Body (optional):
 * {
 *   filters: {
 *     make_model: string,
 *     fuel_type: string,
 *     min_price: number,
 *     max_price: number,
 *     is_available: boolean
 *   },
 *   pagination: {
 *     page: number,
 *     limit: number
 *   }
 * }
 */

router.post('/list', listCars);
router.post('/displayCarDetails', protect, displayCarDetails);
router.post('/uploadCarPhoto', protect, uploadCarPhoto);
router.post('/removeCar', protect, removeCar);
router.post('/addCar', upload.fields([
  { name: "front", maxCount: 1 },
  { name: "back", maxCount: 1 },
  { name: "right", maxCount: 1 },
  { name: "left", maxCount: 1 },
  { name: "odometer", maxCount: 1 },
  { name: "optionalPhotos", maxCount: 5 }
]), addCar);

router.post('/removeFromFav',removeFromFav);
router.post('/addToFav',addToFav);

router.get('/get-my-cars', protect, fetchOwnerCars);
router.get('/myFavCars', protect, myFavCars);

router.put(
  "/updateCar",
  protect,
  upload.fields([
    { name: "front", maxCount: 1 },
    { name: "back", maxCount: 1 },
    { name: "right", maxCount: 1 },
    { name: "left", maxCount: 1 },
    { name: "odometer", maxCount: 1 },
    { name: "optionalPhotos", maxCount: 5 },
  ]),
  updateCar
);


router.get('/temp', temp);

export default router;