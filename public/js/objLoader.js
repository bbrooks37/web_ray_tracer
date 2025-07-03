// public/js/objLoader.js
// Module for loading and parsing .OBJ 3D model files.
// It converts OBJ data into a Mesh object composed of Triangles.

import { Vec3 } from './math.js';
import { Triangle } from './triangle.js';
import { Mesh } from './mesh.js'; // Import Mesh

export class OBJLoader {
    /**
     * Parses OBJ file content and returns a Mesh object.
     * @param {string} objContent - The raw text content of the .obj file.
     * @param {Vec3} [defaultColor=new Vec3(0.7, 0.7, 0.7)] - Default color for the mesh if not specified.
     * @param {string} [modelName='Loaded Mesh'] - Name for the loaded mesh.
     * @returns {Mesh|null} A Mesh object if parsing is successful, otherwise null.
     */
    static parse(objContent, defaultColor = new Vec3(0.7, 0.7, 0.7), modelName = 'Loaded Mesh') {
        const lines = objContent.split('\n');
        const vertices = [new Vec3(0, 0, 0)]; // OBJ indices are 1-based, so add a dummy 0th element
        const normals = [new Vec3(0, 0, 0)];
        const uvs = [new Vec3(0, 0, 0)]; // UVs are 2D, but Vec3 works for consistency (z will be 0)
        const triangles = [];

        for (const line of lines) {
            const parts = line.trim().split(/\s+/); // Split by one or more spaces
            const type = parts[0];

            switch (type) {
                case 'v': // Vertex position
                    vertices.push(new Vec3(
                        parseFloat(parts[1]),
                        parseFloat(parts[2]),
                        parseFloat(parts[3])
                    ));
                    break;
                case 'vn': // Vertex normal
                    normals.push(new Vec3(
                        parseFloat(parts[1]),
                        parseFloat(parts[2]),
                        parseFloat(parts[3])
                    ).normalize()); // Normals should be normalized
                    break;
                case 'vt': // Vertex texture coordinate
                    uvs.push(new Vec3(
                        parseFloat(parts[1]),
                        parseFloat(parts[2]),
                        0 // UVs are 2D, so z is 0
                    ));
                    break;
                case 'f': // Face (can be triangles or quads)
                    // OBJ faces can be:
                    // f v1 v2 v3 (vertex indices only)
                    // f v1/vt1 v2/vt2 v3/vt3 (vertex/uv indices)
                    // f v1/vt1/vn1 v2/vt2/vn2 v3/vt3/vn3 (vertex/uv/normal indices)
                    // f v1//vn1 v2//vn2 v3//vn3 (vertex/normal indices)

                    // We'll primarily support triangle faces. If it's a quad, we'll triangulate it.
                    const faceIndices = parts.slice(1); // Get all index strings (e.g., "1/2/3")

                    // Triangulate if it's a quad (or higher polygon)
                    for (let i = 0; i < faceIndices.length - 2; ++i) {
                        const v0Indices = faceIndices[0].split('/').map(Number);
                        const v1Indices = faceIndices[i + 1].split('/').map(Number);
                        const v2Indices = faceIndices[i + 2].split('/').map(Number);

                        // Get vertex positions
                        const triV0 = vertices[v0Indices[0]];
                        const triV1 = vertices[v1Indices[0]];
                        const triV2 = vertices[v2Indices[0]];

                        // Get vertex normals (if available)
                        let triNormals = null;
                        if (v0Indices[2] && v1Indices[2] && v2Indices[2] && normals.length > 1) {
                            triNormals = [
                                normals[v0Indices[2]],
                                normals[v1Indices[2]],
                                normals[v2Indices[2]]
                            ];
                        }

                        // Get vertex UVs (if available)
                        let triUVs = null;
                        if (v0Indices[1] && v1Indices[1] && v2Indices[1] && uvs.length > 1) {
                            triUVs = [
                                uvs[v0Indices[1]],
                                uvs[v1Indices[1]],
                                uvs[v2Indices[1]]
                            ];
                        }

                        // Create a new Triangle object
                        triangles.push(new Triangle(triV0, triV1, triV2, defaultColor, triNormals, triUVs));
                    }
                    break;
                // Add more cases for other OBJ elements like 'mtllib', 'usemtl', 'g', 's' if needed
                // For simplicity, we ignore them for now and use a default color.
            }
        }

        if (triangles.length === 0) {
            console.warn(`OBJLoader: No triangles found in model '${modelName}'.`);
            return null;
        }

        console.log(`OBJLoader: Loaded model '${modelName}' with ${vertices.length - 1} vertices, ${normals.length - 1} normals, ${uvs.length - 1} UVs, and ${triangles.length} triangles.`);
        return new Mesh(triangles, defaultColor, modelName);
    }
}
