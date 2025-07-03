// public/js/object.js
// Defines the abstract base class for all geometric objects in the scene.

import { Vec3 } from './math.js';

/**
 * @typedef {object} IntersectionInfo
 * @property {Vec3} point - The point of intersection in 3D space.
 * @property {Vec3} normal - The surface normal at the intersection point.
 * @property {number} distance - The distance from the ray origin to the intersection point.
 * @property {Vec3|null} uv - Optional texture coordinates (Vec3 where z is usually 0) at the intersection point.
 */

export class Object {
    /**
     * @param {Vec3} color - The base diffuse color of the object.
     * @param {string} [modelName=''] - Optional name for the model if this object represents one.
     * @param {string|null} [textureId=null] - The ID of the texture applied to this object (e.g., file name).
     * @param {Vec3} [specularColor=new Vec3(0.0, 0.0, 0.0)] - NEW: The color of the specular highlight.
     * @param {number} [shininess=0] - NEW: A float controlling the size and intensity of the highlight (higher value = smaller, more intense highlight).
     * @param {number} [reflectivity=0.0] - NEW: A float (0-1) controlling how much the object reflects other objects.
     */
    constructor(color = new Vec3(0.5, 0.5, 0.5), modelName = '', textureId = null,
                specularColor = new Vec3(0.0, 0.0, 0.0), shininess = 0, reflectivity = 0.0) { // Modified constructor signature
        this.color = color; // Diffuse color
        this.modelName = modelName;
        this.textureId = textureId;
        this.textureName = textureId || 'No texture applied';
        this.specularColor = specularColor; // NEW
        this.shininess = shininess;         // NEW
        this.reflectivity = reflectivity;   // NEW
    }

    /**
     * Abstract method for ray-object intersection.
     * Derived classes must implement this.
     * @param {Ray} ray - The ray to test for intersection.
     * @returns {{hit: boolean, info: IntersectionInfo|null}} An object indicating if a hit occurred and the intersection info.
     */
    intersect(ray) {
        // This is an abstract method. Derived classes must override it.
        console.error("Abstract method 'intersect' must be implemented by derived classes.");
        return { hit: false, info: null };
    }
}
