const multer = require("multer");
const fs = require("fs");
const path = require("path");

// Function to ensure the upload directory exists
const checkAndCreateFolder = (folderPath) => {
  if (!fs.existsSync(folderPath)) {
    fs.mkdirSync(folderPath, { recursive: true });
    console.log(`✅ Folder created: ${folderPath}`);
  }
};

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    try {
      let uploadDir;

      if (file.fieldname === "categoryImage") {
        uploadDir = path.join(__dirname, "../uploads/categories");
      } else if (file.fieldname === "user_picture") {
        // Handle user picture uploads
        const userId = req.user?.id || "default";
        uploadDir = path.join(__dirname, "../uploads/users", userId);
      } else if (
        file.fieldname === "auctionCover" ||
        file.fieldname === "auctionImages"
      ) {
        // Handle auction images
        const userId = req.user?.id || "default";
        uploadDir = path.join(__dirname, "../uploads/auctions", userId);
      } else {
        // Handle item-related uploads
        const userId = req.user?.id || "default";
        uploadDir = path.join(__dirname, "../uploads/items", userId);
      }

      checkAndCreateFolder(uploadDir);
      cb(null, uploadDir);
    } catch (error) {
      cb(error, null);
    }
  },
  filename: function (req, file, cb) {
    cb(null, `${Date.now()}-${file.originalname.replace(/\s+/g, "-")}`);
  },
});

// File Filter: Only allow images
const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith("image/")) {
    cb(null, true);
  } else {
    cb(new Error("Only image files are allowed!"), false);
  }
};

// Upload Middleware: Supports category, item, and user images
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
}).fields([
  { name: "categoryImage", maxCount: 1 },
  { name: "item_cover", maxCount: 1 },
  { name: "item_pictures", maxCount: 5 },
  { name: "user_picture", maxCount: 1 },
  { name: "auctionCover", maxCount: 1 },
  { name: "auctionImages", maxCount: 5 },
]);

// Error handling wrapper
const uploadMiddleware = (req, res, next) => {
  upload(req, res, function (err) {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({
        success: false,
        message: `Upload error: ${err.message}`,
      });
    } else if (err) {
      return res.status(500).json({
        success: false,
        message: err.message,
      });
    }
    // Everything went fine
    next();
  });
};

module.exports = uploadMiddleware;
