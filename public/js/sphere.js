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
     */
    constructor(center, radius, color) {
        super(color); // Call the base class constructor with color
        this.center = center;
        this.radius = radius;
    }

    /**
     * Implements the ray-sphere intersection test.
     * Uses the quadratic formula to find intersection points.
     * A ray is defined as P(t) = O + tD, where O is origin, D is direction, t is distance.
     * A sphere is defined as ||P - C||^2 = R^2, where C is center, R is radius.
     * Substituting P(t) into the sphere equation gives a quadratic equation in t:
     * (D . D)t^2 + 2(D . (O - C))t + ((O - C) . (O - C) - R^2) = 0
     * Let A = D . D (which is 1 if D is normalized)
     * Let B = 2 * (D . (O - C))
     * Let C = (O - C) . (O - C) - R^2
     * The discriminant is delta = B^2 - 4AC
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

                const info = new IntersectionInfo(intersectionPoint, normal, t);
                return { hit: true, info: info };
            }
        }
        return { hit: false, info: null }; // No valid intersection in front of the ray
    }
}
