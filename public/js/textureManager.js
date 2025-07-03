// public/js/textureManager.js
// Manages loading and providing pixel data for image textures.

import { Vec3 } from './math.js';

export class TextureManager {
    constructor() {
        /**
         * Stores loaded textures.
         * Key: textureId (e.g., file name or a unique ID)
         * Value: { width: number, height: number, data: Uint8ClampedArray }
         * The 'data' is the raw pixel data (RGBA) from canvas.getImageData().
         * @type {Map<string, {width: number, height: number, data: Uint8ClampedArray}>}
         */
        this.textures = new Map();
    }

    /**
     * Loads an image file and stores its pixel data.
     * @param {File} imageFile - The File object representing the image.
     * @returns {Promise<string>} A promise that resolves with the texture ID (file name) on success,
     * or rejects with an error.
     */
    async loadImage(imageFile) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    // Create a temporary canvas to get pixel data
                    const tempCanvas = document.createElement('canvas');
                    tempCanvas.width = img.width;
                    tempCanvas.height = img.height;
                    const tempCtx = tempCanvas.getContext('2d');
                    if (!tempCtx) {
                        reject(new Error("Could not get 2D context for temporary canvas."));
                        return;
                    }
                    tempCtx.drawImage(img, 0, 0);

                    // Get the pixel data (RGBA)
                    const imageData = tempCtx.getImageData(0, 0, img.width, img.height);
                    const textureId = imageFile.name;

                    this.textures.set(textureId, {
                        width: img.width,
                        height: img.height,
                        data: imageData.data // Uint8ClampedArray (RGBA)
                    });
                    console.log(`Texture loaded: ${textureId} (${img.width}x${img.height})`);
                    resolve(textureId);
                };
                img.onerror = (error) => {
                    reject(new Error(`Failed to load image: ${imageFile.name}. Error: ${error.message}`));
                };
                img.src = e.target.result; // Set image source to base64 data URL
            };
            reader.onerror = (error) => {
                reject(new Error(`FileReader error for ${imageFile.name}. Error: ${error.message}`));
            };
            reader.readAsDataURL(imageFile); // Read file as data URL (base64)
        });
    }

    /**
     * Retrieves a loaded texture by its ID.
     * @param {string} textureId - The ID (e.g., file name) of the texture.
     * @returns {{width: number, height: number, data: Uint8ClampedArray}|undefined} The texture data, or undefined if not found.
     */
    getTexture(textureId) {
        return this.textures.get(textureId);
    }

    /**
     * Samples a color from a texture at given UV coordinates.
     * UV coordinates are typically normalized [0, 1].
     * @param {string} textureId - The ID of the texture to sample from.
     * @param {Vec3} uv - The 2D UV coordinates (x, y) where z is ignored.
     * @returns {Vec3} The sampled color (RGB, 0-1 range). Returns black if texture not found.
     */
    sampleTexture(textureId, uv) {
        const texture = this.getTexture(textureId);
        if (!texture) {
            console.warn(`Attempted to sample non-existent texture: ${textureId}`);
            return new Vec3(0, 0, 0); // Return black if texture not found
        }

        // Map UV coordinates (0-1) to pixel coordinates
        // Clamp to ensure coordinates are within bounds
        const x = Math.min(Math.max(0, Math.floor(uv.x * texture.width)), texture.width - 1);
        const y = Math.min(Math.max(0, Math.floor((1 - uv.y) * texture.height)), texture.height - 1); // (1 - uv.y) to flip Y for image data (top-left origin)

        const index = (y * texture.width + x) * 4; // Each pixel has 4 components (RGBA)

        const r = texture.data[index + 0] / 255.0;
        const g = texture.data[index + 1] / 255.0;
        const b = texture.data[index + 2] / 255.0;
        // Alpha (texture.data[index + 3]) is ignored for now

        return new Vec3(r, g, b);
    }
}
