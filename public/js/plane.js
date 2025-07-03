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
     * @param {string|null} [textureId=null] - Optional texture ID for this plane. NEW
     * @param {number} [uvScale=1] - NEW: Scale factor for UV coordinates on the plane.
     */
    constructor(point, normal, color, textureId = null, uvScale = 1) { // Modified constructor signature
        super(color, '', textureId); // Pass textureId to base constructor
        this.point = point;
        this.normal = normal.normalize(); // Ensure the normal is normalized
        this.uvScale = uvScale; // NEW: UV scaling for tiling textures
    }

    /**
     * Implements the ray-plane intersection test.
     *
     * @param {Ray} ray - The ray to test for intersection.
     * @returns {{hit: boolean, info: IntersectionInfo|null}} An object indicating if a hit occurred and the intersection info.
     */
    intersect(ray) {
        const rayDirDotNormal = ray.direction.dot(this.normal);

        if (Math.abs(rayDirDotNormal) < 1e-6) {
            return { hit: false, info: null };
        }

        const t = this.point.subtract(ray.origin).dot(this.normal) / rayDirDotNormal;

        if (t > 1e-4) {
            const intersectionPoint = ray.pointAt(t);
            const finalNormal = rayDirDotNormal < 0 ? this.normal : this.normal.negate();

            // NEW: Calculate UV coordinates for planar mapping
            // Project the intersection point onto the plane defined by its normal.
            // Then, find two orthogonal vectors on the plane to use as UV axes.
            let uAxis, vAxis;

            // Determine suitable uAxis and vAxis based on the plane's normal
            // This ensures consistent UV mapping regardless of plane orientation.
            if (Math.abs(this.normal.x) < 0.5 && Math.abs(this.normal.y) < 0.5) { // If normal is mostly Z
                uAxis = new Vec3(1, 0, 0);
                vAxis = new Vec3(0, 1, 0);
            } else if (Math.abs(this.normal.x) < 0.5 && Math.abs(this.normal.z) < 0.5) { // If normal is mostly Y
                uAxis = new Vec3(1, 0, 0);
                vAxis = new Vec3(0, 0, 1);
            } else { // If normal is mostly X
                uAxis = new Vec3(0, 1, 0);
                vAxis = new Vec3(0, 0, 1);
            }

            // Ensure uAxis and vAxis are orthogonal to the normal and to each other
            uAxis = uAxis.subtract(this.normal.multiplyScalar(this.normal.dot(uAxis))).normalize();
            vAxis = this.normal.cross(uAxis).normalize();

            // Calculate UVs relative to the plane's origin (this.point)
            const pRelative = intersectionPoint.subtract(this.point);
            const u = pRelative.dot(uAxis) * this.uvScale;
            const v = pRelative.dot(vAxis) * this.uvScale;

            const uvCoords = new Vec3(u, v, 0); // z is 0 for 2D UVs

            const info = new IntersectionInfo(intersectionPoint, finalNormal, t, uvCoords); // Pass UV
            return { hit: true, info: info };
        }

        return { hit: false, info: null };
    }
}
