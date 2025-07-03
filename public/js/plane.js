// public/js/plane.js
// Defines the Plane class, a concrete geometric object for the ray tracer.

import { Vec3 } from './math.js';
import { Object } from './object.js'; // Import Object only from object.js
import { IntersectionInfo } from './scene.js'; // Import IntersectionInfo from scene.js

export class Plane extends Object {
    /**
     * @param {Vec3} point - A point on the plane.
     * @param {Vec3} normal - The normal vector of the plane (will be normalized).
     * @param {Vec3} color - The color of the plane.
     */
    constructor(point, normal, color) {
        super(color); // Call the base class constructor with color
        this.point = point;
        this.normal = normal.normalize(); // Ensure the normal is normalized
    }

    /**
     * Implements the ray-plane intersection test.
     * A ray is defined as P(t) = O + tD.
     * A plane is defined by (P - A) . N = 0, where A is a point on the plane, N is the normal.
     * Substituting P(t) into the plane equation:
     * ((O + tD) - A) . N = 0
     * (O - A) . N + t(D . N) = 0
     * t(D . N) = -(O - A) . N
     * t = -((O - A) . N) / (D . N)
     *
     * @param {Ray} ray - The ray to test for intersection.
     * @returns {{hit: boolean, info: IntersectionInfo|null}} An object indicating if a hit occurred and the intersection info.
     */
    intersect(ray) {
        const rayDirDotNormal = ray.direction.dot(this.normal);

        // If ray is parallel to the plane (dot product is zero or very close to zero), no intersection
        // or ray is coplanar (and we don't handle that as an intersection here).
        if (Math.abs(rayDirDotNormal) < 1e-6) { // Use a small epsilon for float comparison
            return { hit: false, info: null };
        }

        // Calculate t, the distance along the ray to the intersection point
        const t = this.point.subtract(ray.origin).dot(this.normal) / rayDirDotNormal;

        // An intersection is valid only if t is positive (in front of the ray origin)
        // Use a small epsilon to avoid self-intersection issues for rays originating from surfaces.
        if (t > 1e-4) {
            const intersectionPoint = ray.pointAt(t);
            // The normal should point towards the ray origin if the ray hits from the "back" side
            // For a solid plane, we want the normal to always face the ray.
            const finalNormal = rayDirDotNormal < 0 ? this.normal : this.normal.negate();

            const info = new IntersectionInfo(intersectionPoint, finalNormal, t);
            return { hit: true, info: info };
        }

        return { hit: false, info: null };
    }
}
