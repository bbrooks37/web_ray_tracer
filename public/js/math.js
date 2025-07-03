// public/js/math.js
// A simple 3D vector class for points, directions, and colors.
// Exported as a module to be imported by other JS files.

export class Vec3 {
    constructor(x = 0, y = 0, z = 0) {
        this.x = x;
        this.y = y;
        this.z = z;
    }

    // Static method to create a Vec3 from a single scalar value (for uniform components)
    static fromScalar(s) {
        return new Vec3(s, s, s);
    }

    // Vector addition
    add(v) {
        return new Vec3(this.x + v.x, this.y + v.y, this.z + v.z);
    }

    // Vector subtraction
    subtract(v) {
        return new Vec3(this.x - v.x, this.y - v.y, this.z - v.z);
    }

    // Scalar multiplication
    multiplyScalar(s) {
        return new Vec3(this.x * s, this.y * s, this.z * s);
    }

    // Scalar division
    divideScalar(s) {
        if (s === 0) {
            console.warn("Division by zero in Vec3.divideScalar");
            return new Vec3(0, 0, 0); // Return zero vector or handle error as appropriate
        }
        return new Vec3(this.x / s, this.y / s, this.z / s);
    }

    // Component-wise multiplication (for colors or scaling)
    multiply(v) {
        return new Vec3(this.x * v.x, this.y * v.y, this.z * v.z);
    }

    // Dot product
    dot(v) {
        return this.x * v.x + this.y * v.y + this.z * v.z;
    }

    // Cross product
    cross(v) {
        return new Vec3(
            this.y * v.z - this.z * v.y,
            this.z * v.x - this.x * v.z,
            this.x * v.y - this.y * v.x
        );
    }

    // Length (magnitude) of the vector
    length() {
        return Math.sqrt(this.lengthSquared());
    }

    // Squared length (useful for comparisons to avoid sqrt)
    lengthSquared() {
        return this.x * this.x + this.y * this.y + this.z * this.z;
    }

    // Normalize the vector (make its length 1)
    normalize() {
        const len = this.length();
        if (len > 1e-6) { // Use a small epsilon to avoid division by zero or very small numbers
            return this.divideScalar(len);
        }
        return new Vec3(0, 0, 0); // Return zero vector if length is zero or near zero
    }

    // Unary minus
    negate() {
        return new Vec3(-this.x, -this.y, -this.z);
    }

    // Clamp components to a min/max value (useful for colors)
    clamp(min = 0, max = 1) {
        return new Vec3(
            Math.max(min, Math.min(max, this.x)),
            Math.max(min, Math.min(max, this.y)),
            Math.max(min, Math.min(max, this.z))
        );
    }

    // Convert Vec3 to a hexadecimal color string (e.g., for HTML color input)
    toHexString() {
        const r = Math.floor(this.x * 255).toString(16).padStart(2, '0');
        const g = Math.floor(this.y * 255).toString(16).padStart(2, '0');
        const b = Math.floor(this.z * 255).toString(16).padStart(2, '0');
        return `#${r}${g}${b}`;
    }

    // Create a Vec3 from a hexadecimal color string
    static fromHexString(hex) {
        const r = parseInt(hex.substring(1, 3), 16) / 255;
        const g = parseInt(hex.substring(3, 5), 16) / 255;
        const b = parseInt(hex.substring(5, 7), 16) / 255;
        return new Vec3(r, g, b);
    }
}
