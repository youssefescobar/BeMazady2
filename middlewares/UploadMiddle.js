const multer = require("multer");
const { v2: cloudinary } = require("cloudinary");
const streamifier = require("streamifier");

// ✅ Cloudinary config (use env variables in production)
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Use memory storage for multer
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith("image/")) {
    cb(null, true);
  } else {
    cb(new Error("Only image files are allowed!"), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
}).fields([
  { name: "categoryImage", maxCount: 1 },
  { name: "item_cover", maxCount: 1 },
  { name: "item_pictures", maxCount: 5 },
  { name: "user_picture", maxCount: 1 },
  { name: "auctionCover", maxCount: 1 },
  { name: "auctionImages", maxCount: 5 },
]);

// Helper to upload a single file buffer to Cloudinary
const uploadToCloudinary = (fileBuffer, folder, filename) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        public_id: filename,
        resource_type: "image",
      },
      (error, result) => {
        if (error) reject(error);
        else resolve(result.secure_url);
      }
    );

    streamifier.createReadStream(fileBuffer).pipe(uploadStream);
  });
};

const uploadMiddleware = async (req, res, next) => {
  upload(req, res, async function (err) {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ success: false, message: err.message });
    } else if (err) {
      return res.status(500).json({ success: false, message: err.message });
    }

    try {
      const files = req.files || {};
      req.cloudinaryFiles = {}; // This will store uploaded URLs

      const userId = req.user?.id || "default";

      const uploadPromises = Object.entries(files).flatMap(
        ([fieldname, fileArray]) =>
          fileArray.map(async (file) => {
            const folder = (() => {
              if (fieldname === "categoryImage") return "categories";
              if (fieldname === "user_picture") return `users/${userId}`;
              if (fieldname === "auctionCover" || fieldname === "auctionImages")
                return `auctions/${userId}`;
              return `items/${userId}`;
            })();

            const url = await uploadToCloudinary(
              file.buffer,
              folder,
              `${Date.now()}-${file.originalname.replace(/\s+/g, "-")}`
            );

            if (!req.cloudinaryFiles[fieldname]) {
              req.cloudinaryFiles[fieldname] = [];
            }
            req.cloudinaryFiles[fieldname].push(url);
          })
      );

      await Promise.all(uploadPromises);

      next();
    } catch (uploadErr) {
      console.error("Cloudinary upload error:", uploadErr);
      return res
        .status(500)
        .json({ success: false, message: "Cloudinary upload failed" });
    }
  });
};

module.exports = uploadMiddleware;
