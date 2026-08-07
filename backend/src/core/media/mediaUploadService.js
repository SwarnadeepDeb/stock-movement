import fileStorageProvider from "../storage/fileStorage.provider.js";
import logger from "../../config/logger.js";

class MediaUploadService {
    _fileStorageProvider = fileStorageProvider;

    // Uploads one image per color variant, in the same order the files were received.
    // If any upload in the batch fails, every image already uploaded in this call is
    // rolled back from storage before the error is rethrown — the caller never has to
    // reason about partially-uploaded batches.
    async uploadDesignColorVariantImages(files) {
        const uploaded = [];

        try {
            for (const file of files) {
                const result = await this._fileStorageProvider.upload(file, { type: "DESIGN_VARIANT_IMAGE" });
                uploaded.push(result);
            }
        } catch (error) {
            await this._destroyAll(uploaded.map((item) => item.publicId));
            throw error;
        }

        return uploaded.map(({ url, publicId }) => ({ imageUrl: url, imagePublicId: publicId }));
    }

    // Same rollback-on-partial-failure behavior as uploadDesignColorVariantImages, for the
    // Order Form Item Photos Gallery. Any number of files is fine — unlike the design variant
    // flow there's no 1:1 pairing with another list to validate against.
    async uploadOrderFormPhotos(files) {
        const uploaded = [];

        try {
            for (const file of files) {
                const result = await this._fileStorageProvider.upload(file, { type: "ORDER_FORM_PHOTO" });
                uploaded.push(result);
            }
        } catch (error) {
            await this._destroyAll(uploaded.map((item) => item.publicId));
            throw error;
        }

        return uploaded.map(({ url, publicId }) => ({ imageUrl: url, imagePublicId: publicId }));
    }

    // Called when persistence downstream (e.g. the Design registration transaction) fails
    // after images were already uploaded, so the now-orphaned assets don't linger in storage.
    async deleteUploadedImages(images) {
        await this._destroyAll(images.map((image) => image.imagePublicId));
    }

    async _destroyAll(publicIds) {
        await Promise.all(publicIds.map(async (publicId) => {
            try {
                await this._fileStorageProvider.destroy(publicId);
            } catch (cleanupError) {
                logger.error({ err: cleanupError, publicId }, "Failed to clean up orphaned Cloudinary asset");
            }
        }));
    }
}

export default new MediaUploadService();
