// public/js/raytracer.js
// Core ray tracing logic for the web application.

import { Vec3 } from './math.js';
import { Ray } from './ray.js'; // Assumes public/js/ray.js exists
import { Object } from './object.js'; // Assumes public/js/object.js exists
import { Sphere } from './sphere.js'; // Assumes public/js/sphere.js exists
import { Plane } from './plane.js'; // Assumes public/js/plane.js exists
import { Light } from './light.js'; // Assumes public/js/light.js exists
import { Scene } from './scene.js'; // Assumes public/js/scene.js exists

export class Raytracer {
    /**
     * @param {HTMLCanvasElement} canvas - The HTML canvas element to draw on.
     * @param {CanvasRenderingContext2D} ctx - The 2D rendering context of the canvas.
     * @param {Camera} camera - The camera object for ray generation.
     * @param {Scene} scene - The scene object containing objects and lights.
     */
    constructor(canvas, ctx, camera, scene) {
        this.canvas = canvas;
        this.ctx = ctx;
        this.camera = camera;
        this.scene = scene;
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
                const color = this.traceRay(primaryRay, 0); // Start with recursion depth 0

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
     * @returns {Vec3} The computed color for the ray.
     */
    traceRay(ray, depth) {
        // For now, we only handle primary rays and direct lighting.
        // Future extensions for reflections/refractions would involve higher recursion depths.
        if (depth > 3) { // Max recursion depth to prevent infinite loops (e.g., in reflections)
            return this.scene.backgroundColor;
        }

        const hitResult = this.scene.trace(ray); // Scene.trace returns { object, info }

        if (hitResult.object) {
            const hitObject = hitResult.object;
            const hitInfo = hitResult.info;

            let finalColor = new Vec3(0, 0, 0); // Start with black

            // Iterate through each light source to calculate its contribution
            for (const light of this.scene.lights) {
                // Check if the intersection point is in shadow relative to the current light
                if (!this.scene.isInShadow(hitInfo.point, light)) {
                    const lightDir = light.position.subtract(hitInfo.point).normalize();

                    // Calculate diffuse component (Lambertian shading)
                    const diffuseFactor = Math.max(0.0, hitInfo.normal.dot(lightDir));

                    // Add light contribution: object color * light color * diffuse factor
                    finalColor = finalColor.add(
                        hitObject.color.multiply(light.color).multiplyScalar(diffuseFactor)
                    );
                }
            }
            return finalColor;
        } else {
            // If no object was hit, return the scene's background color
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
        // The scene.trace method already handles finding the closest object and populating info.
        // We just need to ensure the ground plane is skipped in the picking logic if desired.
        // The scene.trace method in JS will need to be updated to return specific info.
        // For now, let's assume scene.trace returns { object: Object, info: IntersectionInfo }
        // and we'll handle the ground plane exclusion in main.js's onMouseDown, similar to C++.
        return this.scene.trace(pickingRay);
    }
}
