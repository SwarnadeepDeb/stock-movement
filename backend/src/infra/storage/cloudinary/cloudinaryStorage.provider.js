import { Readable } from "stream";
import cloudinary from "../../../config/cloudinary.js";

class CloudinaryStorageProvider {
    _getUploadConfig(type) {
        const configMap = {
            DESIGN_VARIANT_IMAGE: {
                resource_type: "image",
                folder: "design/images",
            },
            ORDER_FORM_PHOTO: {
                resource_type: "image",
                folder: "order-forms/photos",
            },
        }

        return configMap[type];
    }

    async upload(file, options) {
        const config = this._getUploadConfig(options.type);
        if (!config) {
            throw new Error(`Invalid upload type: ${options.type}`);
        }

        return new Promise((resolve, reject) => {
            const stream = cloudinary.uploader.upload_stream({
                resource_type: config.resource_type,
                folder: config.folder
            }, (error, result) => {
                if (error) return reject(error);

                return resolve({
                    url: result.secure_url,
                    publicId: result.public_id,
                })
            })

            Readable.from(file.buffer).pipe(stream);
        })
    }

    async destroy(publicId) {
        return cloudinary.uploader.destroy(publicId);
    }

    // Builds a signed URL to a zip archive Cloudinary generates on the fly from the given
    // public_ids — no zip library needed, and nothing is stored server-side beyond the URL.
    createZipDownloadUrl(publicIds, targetPublicId) {
        return cloudinary.utils.download_zip_url({
            public_ids: publicIds,
            resource_type: "image",
            target_public_id: targetPublicId,
            use_original_filename: true,
            flatten_folder: true,
        });
    }
}

export default new CloudinaryStorageProvider();
