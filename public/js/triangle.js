// public/js/triangle.js
// Defines the Triangle class, a concrete geometric object for ray tracing.
// Implements the Möller–Trumbore algorithm for ray-triangle intersection.

import { Vec3 } from './math.js';
import { Object } from './object.js'; // Import Object only from object.js
import { IntersectionInfo } from './scene.js'; // CORRECTED: Import IntersectionInfo from scene.js

export class Triangle extends Object {
    /**
     * @param {Vec3} v0 - First vertex position.
     * @param {Vec3} v1 - Second vertex position.
     * @param {Vec3} v2 - Third vertex position.
     * @param {Vec3} color - The color of the triangle.
     * @param {Vec3[]} [normals=null] - Optional array of 3 vertex normals (for smooth shading).
     * @param {Vec3[]} [uvs=null] - Optional array of 3 texture coordinates (for texture mapping).
     * @param {string|null} [textureId=null] - Optional texture ID for this triangle.
     */
    constructor(v0, v1, v2, color, normals = null, uvs = null, textureId = null) {
        super(color, '', textureId); // Pass textureId to base constructor
        this.v0 = v0;
        this.v1 = v1;
        this.v2 = v2;
        this.normals = normals; // Store vertex normals if provided
        this.uvs = uvs;         // Store vertex UVs if provided

        // Pre-calculate face normal for flat shading (or if vertex normals are not provided)
        this.faceNormal = (this.v1.subtract(this.v0)).cross(this.v2.subtract(this.v0)).normalize();
    }

    /**
     * Implements the ray-triangle intersection test using the Möller–Trumbore algorithm.
     *
     * @param {Ray} ray - The ray to test for intersection.
     * @returns {{hit: boolean, info: IntersectionInfo|null}} An object indicating if a hit occurred and the intersection info.
     */
    intersect(ray) {
        const edge1 = this.v1.subtract(this.v0);
        const edge2 = this.v2.subtract(this.v0);

        const pvec = ray.direction.cross(edge2);
        const det = edge1.dot(pvec);

        if (Math.abs(det) < 1e-6) {
            return { hit: false, info: null };
        }

        const invDet = 1.0 / det;
        const tvec = ray.origin.subtract(this.v0);
        const u = tvec.dot(pvec) * invDet;

        if (u < 0 || u > 1) {
            return { hit: false, info: null };
        }

        const qvec = tvec.cross(edge1);
        const v = ray.direction.dot(qvec) * invDet;

        if (v < 0 || u + v > 1) {
            return { hit: false, info: null };
        }

        const t = edge2.dot(qvec) * invDet;

        if (t > 1e-4) {
            const intersectionPoint = ray.pointAt(t);

            let finalNormal;
            if (this.normals && this.normals.length === 3) {
                const w = 1 - u - v;
                finalNormal = this.normals[0].multiplyScalar(w)
                                .add(this.normals[1].multiplyScalar(u))
                                .add(this.normals[2].multiplyScalar(v))
                                .normalize();
            } else {
                finalNormal = ray.direction.dot(this.faceNormal) < 0 ? this.faceNormal : this.faceNormal.negate();
            }

            // Determine UV coordinates at the intersection point (if provided)
            let finalUV = null;
            if (this.uvs && this.uvs.length === 3) {
                const w = 1 - u - v;
                finalUV = this.uvs[0].multiplyScalar(w)
                            .add(this.uvs[1].multiplyScalar(u))
                            .add(this.uvs[2].multiplyScalar(v));
            }

            const info = new IntersectionInfo(intersectionPoint, finalNormal, t, finalUV); // Pass UV
            return { hit: true, info: info };
        }

        return { hit: false, info: null };
    }
}
