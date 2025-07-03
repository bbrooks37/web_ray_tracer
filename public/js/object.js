// public/js/object.js
// Defines the abstract base class for all geometric objects in the scene.

import { Vec3 } from './math.js';

/**
 * @typedef {object} IntersectionInfo
 * @property {Vec3} point - The point of intersection in 3D space.
 * @property {Vec3} normal - The surface normal at the intersection point.
 * @property {number} distance - The distance from the ray origin to the intersection point.
 */

export class Object {
    /**
     * @param {Vec3} color - The base color of the object.
     */
    constructor(color = new Vec3(0.5, 0.5, 0.5)) {
        this.color = color;
    }

    /**
     * Abstract method for ray-object intersection.
     * Derived classes must implement this.
     * @param {Ray} ray - The ray to test for intersection.
     * @returns {{hit: boolean, info: IntersectionInfo|null}} An object indicating if a hit occurred and the intersection info.
     */
    intersect(ray) {
        // This is an abstract method. Derived classes must override it.
        // If this method is called on the base Object class, it indicates an error.
        console.error("Abstract method 'intersect' must be implemented by derived classes.");
        return { hit: false, info: null };
    }
}
