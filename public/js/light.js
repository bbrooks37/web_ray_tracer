// public/js/light.js
// Defines the Light class for point light sources in the scene.

import { Vec3 } from './math.js'; // Import Vec3 for position and color

export class Light {
    /**
     * @param {Vec3} position - The 3D position of the light source.
     * @param {Vec3} color - The color/intensity of the light (RGB values, typically 0-1).
     */
    constructor(position = new Vec3(0, 0, 0), color = new Vec3(1.0, 1.0, 1.0)) {
        this.position = position;
        this.color = color;
    }
}
