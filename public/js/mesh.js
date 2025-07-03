// public/js/mesh.js
// Defines the Mesh class, which represents a collection of triangles (a 3D model).

import { Vec3 } from './math.js';
import { Object } from './object.js'; // Import Object only from object.js
import { IntersectionInfo } from './scene.js'; // CORRECTED: Import IntersectionInfo from scene.js
import { Triangle } from './triangle.js'; // Import Triangle

export class Mesh extends Object {
    /**
     * @param {Triangle[]} triangles - An array of Triangle objects that make up the mesh.
     * @param {Vec3} color - The base color of the mesh (can be overridden by textures).
     * @param {string} [name='Mesh'] - An optional name for the mesh, useful for debugging/UI.
     * @param {string|null} [textureId=null] - Optional texture ID for this mesh.
     * @param {Vec3} [specularColor=new Vec3(0.0, 0.0, 0.0)] - The color of the specular highlight.
     * @param {number} [shininess=0] - A float controlling the size and intensity of the highlight.
     * @param {number} [reflectivity=0.0] - A float (0-1) controlling how much the object reflects.
     */
    constructor(triangles, color = new Vec3(0.7, 0.7, 0.7), name = 'Loaded Mesh', textureId = null,
                specularColor = new Vec3(0.0, 0.0, 0.0), shininess = 0, reflectivity = 0.0) {
        super(color, name, textureId, specularColor, shininess, reflectivity); // Pass all properties to base constructor
        /** @type {Triangle[]} */
        this.triangles = triangles;
        this.modelName = name; // For UI display (redundant with base but kept for clarity)

        // Transformation properties (for future use: scaling, rotation, translation)
        // For now, assume identity transformations.
        this.position = new Vec3(0, 0, 0);
        this.scale = new Vec3(1, 1, 1);
    }

    /**
     * Implements the ray-mesh intersection test.
     * Iterates through all triangles in the mesh and finds the closest intersection.
     *
     * @param {Ray} ray - The ray to test for intersection.
     * @returns {{hit: boolean, info: IntersectionInfo|null}} An object indicating if a hit occurred and the intersection info.
     */
    intersect(ray) {
        let closestDistance = Infinity;
        let hitTriangle = null;
        let hitInfo = null;

        // Iterate through each triangle in the mesh
        for (const triangle of this.triangles) {
            const currentHitResult = triangle.intersect(ray); // Triangle's intersect method

            if (currentHitResult.hit) {
                // If this triangle intersection is closer than any previously found
                if (currentHitResult.info.distance < closestDistance) {
                    closestDistance = currentHitResult.info.distance;
                    hitInfo = currentHitResult.info;
                    hitTriangle = triangle; // Keep track of the specific triangle hit
                }
            }
        }

        // If a triangle was hit, return the mesh as the hit object, along with the detailed info.
        if (hitTriangle) {
            // The hitInfo already contains the correct normal and UVs (if available)
            // interpolated from the triangle.
            return { hit: true, object: this, info: hitInfo };
        }

        return { hit: false, info: null };
    }
}
