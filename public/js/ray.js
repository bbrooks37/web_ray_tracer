// public/js/ray.js
// Defines the Ray class, representing a ray in 3D space.

import { Vec3 } from './math.js'; // Import Vec3 for vector operations

export class Ray {
    /**
     * @param {Vec3} origin - The starting point of the ray.
     * @param {Vec3} direction - The direction vector of the ray. This will be normalized upon construction.
     */
    constructor(origin, direction) {
        this.origin = origin;
        this.direction = direction.normalize(); // Ensure the direction vector is normalized (unit length)
    }

    /**
     * Calculates a point along the ray at a given distance 't'.
     * P(t) = Origin + t * Direction
     * @param {number} t - The distance along the ray.
     * @returns {Vec3} The 3D point at distance 't' along the ray.
     */
    pointAt(t) {
        return this.origin.add(this.direction.multiplyScalar(t));
    }
}
