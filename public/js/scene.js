// public/js/scene.js
// Defines the Scene class, which manages objects and lights in the 3D world.
// It provides methods for tracing rays and checking for shadows.

import { Vec3 } from './math.js';
import { Ray } from './ray.js'; // Assumes public/js/ray.js exists
import { Object } from './object.js'; // Assumes public/js/object.js exists
import { Light } from './light.js'; // Assumes public/js/light.js exists

// Structure to hold intersection information, similar to C++ struct
// This will be returned by intersect methods of objects and by scene.trace
class IntersectionInfo {
    constructor(point = new Vec3(), normal = new Vec3(), distance = Infinity) {
        this.point = point;
        this.normal = normal;
        this.distance = distance;
    }
}

export class Scene {
    /**
     * @param {Vec3} backgroundColor - The color for rays that hit no objects.
     */
    constructor(backgroundColor = new Vec3(0.1, 0.1, 0.1)) {
        /** @type {Object[]} */
        this.objects = []; // Array to store objects in the scene
        /** @type {Light[]} */
        this.lights = [];  // Array to store light sources in the scene
        this.backgroundColor = backgroundColor;
    }

    /**
     * Adds an object to the scene.
     * @param {Object} obj - The object to add.
     */
    addObject(obj) {
        this.objects.push(obj);
    }

    /**
     * Adds a light source to the scene.
     * @param {Light} light - The light to add.
     */
    addLight(light) {
        this.lights.push(light);
    }

    /**
     * Traces a ray into the scene to find the closest intersection.
     * @param {Ray} ray - The ray to trace.
     * @returns {{object: Object|null, info: IntersectionInfo|null}} An object containing the hit object and its intersection info, or nulls if no object was hit.
     */
    trace(ray) {
        let closestDistance = Infinity; // Initialize with a very large distance
        let hitObject = null;           // No object hit initially
        let hitInfo = null;             // No intersection info initially

        // Iterate over all objects in the scene to check for intersections
        for (const obj of this.objects) {
            // Each object's intersect method should return an object like { hit: boolean, info: IntersectionInfo }
            const currentHitResult = obj.intersect(ray);

            if (currentHitResult.hit) {
                // Check if this intersection is closer than any previously found
                if (currentHitResult.info.distance < closestDistance) {
                    closestDistance = currentHitResult.info.distance; // Update the minimum distance
                    hitInfo = currentHitResult.info;                  // Store the detailed information
                    hitObject = obj;                                  // Store the reference to the object
                }
            }
        }

        // Return the closest hit object and its information
        return { object: hitObject, info: hitInfo };
    }

    /**
     * Checks if a point is in shadow from a specific light source.
     * This is done by casting a shadow ray from the intersection point towards the light.
     * @param {Vec3} point - The point to check for shadow.
     * @param {Light} light - The light source to check against.
     * @returns {boolean} True if the point is in shadow (an object blocks the light), false otherwise.
     */
    isInShadow(point, light) {
        // Calculate the direction from the intersection point to the light source.
        const lightDir = light.position.subtract(point).normalize();

        // Create a shadow ray. Add a small epsilon to the origin of the shadow ray
        // to prevent "self-intersection" where the ray immediately hits the object it originated from
        // due to floating-point precision issues.
        const shadowRay = new Ray(point.add(lightDir.multiplyScalar(1e-4)), lightDir);

        // Calculate the actual distance from the intersection point to the light source.
        const distanceToLight = light.position.subtract(point).length();

        // Iterate through all objects in the scene to check if any object blocks the shadow ray.
        for (const obj of this.objects) {
            // Skip the object that the primary ray just hit (to avoid self-shadowing)
            // This is a simplified approach. In a more advanced renderer, you'd pass the hit object
            // from the primary ray trace to this function and skip it.
            // For now, we assume the epsilon handles most self-intersection.

            const shadowHitResult = obj.intersect(shadowRay);
            if (shadowHitResult.hit) {
                // If the shadow ray intersects an object AND that object is closer than the light source,
                // then the point is in shadow.
                // We also check for a small epsilon to avoid issues with floating point comparisons
                // when the intersection is extremely close to the light source itself.
                if (shadowHitResult.info.distance < distanceToLight - 1e-4) {
                    return true; // Point is in shadow
                }
            }
        }
        return false; // Point is not in shadow
    }
}

// Export IntersectionInfo as well, as it's a utility class used by Scene and Object
export { IntersectionInfo };
