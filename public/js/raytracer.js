// public/js/raytracer.js
// Core ray tracing logic for the web application.

import { Vec3 } from './math.js';
import { Ray } from './ray.js';
import { Object } from './object.js';
import { Sphere } from './sphere.js';
import { Plane } from './plane.js';
import { Light } from './light.js';
import { Scene } from './scene.js';
import { TextureManager } from './textureManager.js'; // NEW: Import TextureManager

export class Raytracer {
    /**
     * @param {HTMLCanvasElement} canvas - The HTML canvas element to draw on.
     * @param {CanvasRenderingContext2D} ctx - The 2D rendering context of the canvas.
     * @param {Camera} camera - The camera object for ray generation.
     * @param {Scene} scene - The scene object containing objects and lights.
     * @param {TextureManager} textureManager - NEW: The texture manager instance.
     */
    constructor(canvas, ctx, camera, scene, textureManager) { // Modified constructor signature
        this.canvas = canvas;
        this.ctx = ctx;
        this.camera = camera;
        this.scene = scene;
        this.textureManager = textureManager; // NEW: Store texture manager
        this.imageData = ctx.createImageData(canvas.width, canvas.height);
        this.pixels = new Uint8ClampedArray(this.imageData.data.buffer); // Direct access to pixel data
    }

    /**
     * Renders the entire scene to the canvas using ray tracing.
     * Iterates through each pixel, computes a primary ray, traces it, and calculates color.
     */
    render() {
        const width = this.canvas.width;
        const height = this.canvas.height;

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const primaryRay = this.camera.computePrimaryRay(x, y);
                // Pass camera.eyePosition to traceRay for view vector calculation
                const color = this.traceRay(primaryRay, 0, this.camera.eyePosition); // Modified call

                // Clamp color components to [0, 1] and convert to 0-255 range
                const r = Math.floor(Math.max(0, Math.min(1, color.x)) * 255);
                const g = Math.floor(Math.max(0, Math.min(1, color.y)) * 255);
                const b = Math.floor(Math.max(0, Math.min(1, color.z)) * 255);

                const index = (y * width + x) * 4; // 4 components: R, G, B, A
                this.pixels[index + 0] = r;     // Red
                this.pixels[index + 1] = g;     // Green
                this.pixels[index + 2] = b;     // Blue
                this.pixels[index + 3] = 255;   // Alpha (fully opaque)
            }
        }
        this.ctx.putImageData(this.imageData, 0, 0); // Put the pixel data onto the canvas
    }

    /**
     * Traces a ray into the scene and calculates the resulting color.
     * This is the core recursive ray tracing function.
     * @param {Ray} ray - The ray to trace.
     * @param {number} depth - The current recursion depth (for reflections/refractions).
     * @param {Vec3} [cameraEyePos] - NEW: The camera's eye position, used to calculate the view vector.
     * @returns {Vec3} The computed color for the ray.
     */
    traceRay(ray, depth, cameraEyePos = new Vec3(0,0,0)) { // Added cameraEyePos parameter
        if (depth > 3) {
            return this.scene.backgroundColor;
        }

        const hitResult = this.scene.trace(ray);

        if (hitResult.object) {
            const hitObject = hitResult.object;
            const hitInfo = hitResult.info;

            let objectColor = hitObject.color; // Start with base object diffuse color

            // If object has a texture, sample it
            if (hitObject.textureId && hitInfo.uv) {
                const sampledColor = this.textureManager.sampleTexture(hitObject.textureId, hitInfo.uv);
                objectColor = sampledColor; // Replace diffuse color with texture color
            }

            let finalColor = new Vec3(0, 0, 0); // Start with black

            for (const light of this.scene.lights) {
                // Calculate light contribution (diffuse + specular)
                let lightContribution = new Vec3(0, 0, 0);

                // Diffuse component
                if (!this.scene.isInShadow(hitInfo.point, light)) {
                    const lightDir = light.position.subtract(hitInfo.point).normalize();
                    const diffuseFactor = Math.max(0.0, hitInfo.normal.dot(lightDir));

                    // Add diffuse contribution
                    lightContribution = lightContribution.add(
                        objectColor.multiply(light.color).multiplyScalar(diffuseFactor)
                    );

                    // NEW: Specular component (Phong model)
                    if (hitObject.shininess > 0 && hitObject.specularColor.lengthSquared() > 1e-6) {
                        const viewDir = cameraEyePos.subtract(hitInfo.point).normalize(); // View vector
                        // Reflection vector: R = L - 2 * (L . N) * N, where L is lightDir (from hit to light), N is normal
                        // Or, more commonly, R = 2 * (N . L) * N - L, where L is lightDir (from light to hit), N is normal
                        // Here, lightDir is from hit point to light, so we use the first formula or negate lightDir for the second.
                        // Let's use the common formula: R = 2 * (N . L_to_hit) * N - L_to_hit
                        // Where L_to_hit is from light to hit point, which is -lightDir in our current setup.
                        const L_to_hit = lightDir.negate();
                        const reflectionDir = L_to_hit.reflect(hitInfo.normal); // Assuming Vec3 has a reflect method or implement it here

                        const specularFactor = Math.pow(Math.max(0.0, reflectionDir.dot(viewDir)), hitObject.shininess);
                        lightContribution = lightContribution.add(
                            hitObject.specularColor.multiply(light.color).multiplyScalar(specularFactor)
                        );
                    }
                }
                finalColor = finalColor.add(lightContribution);
            }
            return finalColor;
        } else {
            return this.scene.backgroundColor;
        }
    }

    /**
     * Performs object picking for a given pixel coordinate.
     * @param {number} pixelX - The x-coordinate of the pixel on the canvas.
     * @param {number} pixelY - The y-coordinate of the pixel on the canvas.
     * @returns {{object: Object|null, info: object|null}} An object containing the hit object and its intersection info, or nulls if no object was hit.
     */
    pickObject(pixelX, pixelY) {
        const pickingRay = this.camera.computePrimaryRay(pixelX, pixelY);
        return this.scene.trace(pickingRay);
    }
}
