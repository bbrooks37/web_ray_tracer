// public/js/mesh.js
// Defines the Mesh class, which represents a collection of triangles (a 3D model).

import { Vec3 } from './math.js';
import { Object, IntersectionInfo } from './object.js'; // Import Object and IntersectionInfo
import { Triangle } from './triangle.js'; // Import Triangle

export class Mesh extends Object {
    /**
     * @param {Triangle[]} triangles - An array of Triangle objects that make up the mesh.
     * @param {Vec3} color - The base color of the mesh (can be overridden by textures).
     * @param {string} [name='Mesh'] - An optional name for the mesh, useful for debugging/UI.
     */
    constructor(triangles, color = new Vec3(0.7, 0.7, 0.7), name = 'Mesh') {
        super(color); // Call the base class constructor with color
        /** @type {Triangle[]} */
        this.triangles = triangles;
        this.name = name; // For UI display
        this.modelName = name; // For UI display in UIManager
        this.textureName = 'No texture applied'; // Placeholder for UI

        // Transformation properties (for future use: scaling, rotation, translation)
        // For now, assume identity transformations.
        this.position = new Vec3(0, 0, 0);
        this.scale = new Vec3(1, 1, 1);
        // Rotation could be represented by Euler angles or a Quaternion
        // For simplicity, we'll assume no rotation for now, or apply it to vertices during loading.
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
        // The color of the mesh will be used, or overridden by the triangle's color if set.
        if (hitTriangle) {
            // Ensure the hitInfo's normal is correctly oriented towards the ray origin
            // (The Triangle.intersect already handles this, but a final check might be useful
            // if transformations were applied to the ray before intersection).
            return { hit: true, object: this, info: hitInfo };
        }

        return { hit: false, info: null };
    }
}
