import multer from "multer";
import ApiError from "../../core/apiError.js";

const storage = multer.memoryStorage();

const MAX_VIDEO_SIZE = 50 * 1024 * 1024; // 50MB
const MAX_RESUME_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB

const fileFilter = (req, file, cb) => {

}

const upload = multer({
    storage,

    // fileFilter,

    limits: {
        fileSize: MAX_VIDEO_SIZE,
    },
});

const IMAGE_MIME_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

// Order form gallery uploads: unlike the unrestricted default `upload`, this one rejects
// anything that isn't a JPG/PNG/WEBP before it ever reaches Cloudinary.
export const imageUpload = multer({
    storage,
    fileFilter: (req, file, cb) => {
        if (!IMAGE_MIME_TYPES.includes(file.mimetype)) {
            return cb(new ApiError("Only JPG, PNG, or WEBP images are allowed.", 400, "INVALID_FILE_TYPE"));
        }
        cb(null, true);
    },
    limits: {
        fileSize: MAX_IMAGE_SIZE,
    },
});

export default upload;
