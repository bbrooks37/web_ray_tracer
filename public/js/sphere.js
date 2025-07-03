// public/js/sphere.js
// Defines the Sphere class, a concrete geometric object for the ray tracer.

import { Vec3 } from './math.js';
import { Object } from './object.js'; // Import Object only from object.js
import { IntersectionInfo } from './scene.js'; // NEW: Import IntersectionInfo from scene.js

export class Sphere extends Object {
    /**
     * @param {Vec3} center - The center point of the sphere.
     * @param {number} radius - The radius of the sphere.
     * @param {Vec3} color - The color of the sphere.
     * @param {string|null} [textureId=null] - Optional texture ID for this sphere. NEW
     */
    constructor(center, radius, color, textureId = null) { // Modified constructor signature
        super(color, '', textureId); // Pass textureId to base constructor
        this.center = center;
        this.radius = radius;
    }

    /**
     * Implements the ray-sphere intersection test.
     * Uses the quadratic formula to find intersection points.
     *
     * @param {Ray} ray - The ray to test for intersection.
     * @returns {{hit: boolean, info: IntersectionInfo|null}} An object indicating if a hit occurred and the intersection info.
     */
    intersect(ray) {
        const oc = ray.origin.subtract(this.center); // Vector from ray origin to sphere center
        const a = ray.direction.dot(ray.direction); // Should be 1 if ray.direction is normalized
        const b = 2.0 * oc.dot(ray.direction);
        const c = oc.dot(oc) - this.radius * this.radius;
        const discriminant = b * b - 4 * a * c;

        if (discriminant < 0) {
            return { hit: false, info: null }; // No real intersection
        } else {
            const t0 = (-b - Math.sqrt(discriminant)) / (2.0 * a);
            const t1 = (-b + Math.sqrt(discriminant)) / (2.0 * a);

            // We need the closest intersection point that is in front of the ray origin (t > 0)
            let t = -1.0; // Initialize with an invalid distance

            // Check the smaller root first
            if (t0 > 1e-4) { // Use a small epsilon to avoid self-intersection issues
                t = t0;
            }
            // If t0 is not valid, check t1
            else if (t1 > 1e-4) {
                t = t1;
            }

            if (t > 0) { // Valid intersection found
                const intersectionPoint = ray.pointAt(t);
                const normal = intersectionPoint.subtract(this.center).normalize(); // Normal points outwards from sphere center

                // NEW: Calculate UV coordinates for spherical mapping
                // Convert normal to spherical coordinates
                // phi: angle around Y-axis from X-axis (longitude)
                // theta: angle from Y-axis (latitude)
                const phi = Math.atan2(normal.z, normal.x);
                const theta = Math.acos(normal.y);

                // Map to UV space [0, 1]
                const u = 1 - (phi + Math.PI) / (2 * Math.PI);
                const v = theta / Math.PI;

                const uvCoords = new Vec3(u, v, 0); // z is 0 for 2D UVs

                const info = new IntersectionInfo(intersectionPoint, normal, t, uvCoords); // Pass UV
                return { hit: true, info: info };
            }
        }
        return { hit: false, info: null }; // No valid intersection in front of the ray
    }
}
