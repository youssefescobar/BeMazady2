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
      if (file.fieldname === "category_image") {
        uploadDir = path.join(__dirname, "../uploads/categories");
      } else {
        const userId = req.user?.id || "default";
        uploadDir = path.join(__dirname, "../uploads", userId);
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

// Upload Middleware: Supports both category and item images
// In multer configuration:
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
}).fields([
  { name: "categoryImage", maxCount: 1 }, // Keep this as is
  { name: "item_cover", maxCount: 1 },
  { name: "item_pictures", maxCount: 5 },
]);

module.exports = upload;
