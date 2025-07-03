// public/js/camera.js
// Defines the Camera class for the ray tracer.
// It generates primary rays and manages its position and orientation.

import { Vec3 } from './math.js';
import { Ray } from './ray.js'; // Ray class will be defined in public/js/ray.js

export class Camera {
    /**
     * @param {Vec3} eye - The position of the camera (eye).
     * @param {Vec3} lookAt - The point the camera is looking at.
     * @param {Vec3} up - The world up vector (e.g., (0,1,0)).
     * @param {number} fovDeg - The field of view in degrees.
     * @param {number} imageWidth - The width of the rendered image in pixels.
     * @param {number} imageHeight - The height of the rendered image in pixels.
     */
    constructor(eye, lookAt, up, fovDeg, imageWidth, imageHeight) {
        this.eyePosition = eye;
        this.lookAt = lookAt;
        this.upVector = up; // This is the world up vector, used for basis calculation
        this.fov = fovDeg;
        this.imageWidth = imageWidth;
        this.imageHeight = imageHeight;

        // Camera basis vectors (u: right, v: up, w: backward/view direction)
        // These will be calculated by updateBasis()
        this.u = new Vec3();
        this.v = new Vec3();
        this.w = new Vec3();

        this.updateBasis(); // Initialize basis vectors upon construction
    }

    /**
     * Updates the camera's orthonormal basis vectors (u, v, w).
     * w: points from lookAt to eyePosition (opposite of the view direction).
     * u: right vector, orthogonal to worldUp and w.
     * v: camera's actual up vector, orthogonal to w and u.
     * This method ensures the camera's orientation is always consistent and valid,
     * handling edge cases like looking directly up or down.
     */
    updateBasis() {
        // Calculate w (view direction, pointing from lookAt to eye)
        this.w = this.eyePosition.subtract(this.lookAt).normalize();

        // Use a fixed world up vector for calculating 'u' to avoid gimbal lock issues
        // and ensure 'u' is always horizontal relative to the world's Y-axis.
        const worldUp = new Vec3(0, 1, 0); // Global Y-axis is considered "up"

        // Calculate a temporary 'u' vector by crossing worldUp with w.
        // This 'u' should be the camera's right vector.
        let tempU = worldUp.cross(this.w);

        // Check if tempU is near zero. This happens if 'w' is parallel to 'worldUp',
        // meaning the camera is looking almost straight up or down.
        // In such an edge case, a direct cross product would result in a zero vector,
        // which cannot be normalized, leading to NaNs and potential crashes.
        if (tempU.lengthSquared() < 1e-6) { // Use squared length for efficiency and robustness
            // Fallback: If looking straight up/down, define 'u' along the world X-axis.
            // This prevents division by zero and ensures a valid basis.
            this.u = new Vec3(1, 0, 0);
        } else {
            // Otherwise, normalize tempU to get the camera's true right vector.
            this.u = tempU.normalize();
        }

        // Calculate v (camera's actual up vector).
        // It's the cross product of w (backward view) and u (right), normalized.
        // This ensures 'v' is orthogonal to both 'w' and 'u' and is a unit vector.
        this.v = this.w.cross(this.u).normalize();
    }

    /**
     * Computes the primary ray that originates from the camera's eye position
     * and passes through the center of the given pixel (i, j) on the image plane.
     * @param {number} i - The pixel's column index (0 to imageWidth - 1).
     * @param {number} j - The pixel's row index (0 to imageHeight - 1).
     * @returns {Ray} The computed primary ray.
     */
    computePrimaryRay(i, j) {
        // Convert FOV from degrees to radians for trigonometric functions
        const fovRad = this.fov * Math.PI / 180.0;

        // Calculate half width and half height of the image plane.
        // The image plane is conceptually placed at a distance of 1 unit from the camera along the -w axis.
        const aspectRatio = this.imageWidth / this.imageHeight;
        const halfHeight = Math.tan(fovRad / 2.0);
        const halfWidth = halfHeight * aspectRatio;

        // Calculate normalized device coordinates (NDC) for the pixel.
        // NDC range from -1 to 1 for both X and Y.
        // We add 0.5 to 'i' and 'j' to sample the ray through the center of the pixel.
        const xNdc = (2.0 * (i + 0.5) / this.imageWidth - 1.0) * halfWidth;
        const yNdc = (1.0 - 2.0 * (j + 0.5) / this.imageHeight) * halfHeight; // Y-axis is inverted for screen coordinates

        // Calculate the ray direction in world space.
        // This vector points from the camera's origin to the point on the image plane
        // corresponding to the current pixel.
        const rayDirection = this.u.multiplyScalar(xNdc)
                               .add(this.v.multiplyScalar(yNdc))
                               .subtract(this.w) // Subtract 'w' because 'w' points from lookAt to eye, so -w is forward
                               .normalize();

        // Return a new Ray object starting from the camera's eye position with the calculated direction.
        return new Ray(this.eyePosition, rayDirection);
    }
}
