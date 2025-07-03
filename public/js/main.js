// public/js/main.js
// Main application entry point for the interactive web ray tracer.
// Orchestrates the scene setup, rendering loop, and user interactions.

import { Vec3 } from './math.js';
import { Camera } from './camera.js';
import { Scene } from './scene.js';
import { Sphere } from './sphere.js';
import { Plane } from './plane.js';
import { Ray } from './ray.js';
import { Object } from './object.js';
import { Light } from './light.js';
import { Raytracer } from './raytracer.js';
import { UIManager } from './ui.js';
import { OBJLoader } from './objLoader.js';
import { Mesh } from './mesh.js';
import { TextureManager } from './textureManager.js'; // NEW: Import TextureManager

// --- Global Variables ---
const CANVAS_WIDTH = 640;
const CANVAS_HEIGHT = 480;

let raytracer;
let camera;
let scene;
let uiManager;
let textureManager; // NEW: TextureManager instance
let selectedObject = null; // Stores the currently selected object
let selectedObjectIndex = -1; // Stores the index of the selected object in the scene's objects array

// Mouse control variables for camera orbit
let lastMouseX = CANVAS_WIDTH / 2;
let lastMouseY = CANVAS_HEIGHT / 2;
let firstMouse = true;
let isRotating = false; // True when right mouse button is held down for rotation

let cameraYaw = -90.0;
let cameraPitch = 0.0;
let cameraRadius = 6.0;
const CAMERA_SENSITIVITY = 0.1;

// --- Initialization Function ---
function init() {
    const canvas = document.getElementById('raytracerCanvas');
    if (!canvas) {
        console.error("Canvas element 'raytracerCanvas' not found!");
        return;
    }

    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        console.error("2D rendering context not available!");
        return;
    }

    // Initialize Camera
    camera = new Camera(
        new Vec3(0, 0, 0),
        new Vec3(0, 0, 0),
        new Vec3(0, 1, 0),
        75.0,
        CANVAS_WIDTH, CANVAS_HEIGHT
    );

    updateCameraPositionFromOrbit();
    camera.updateBasis();

    // Initialize Scene
    scene = new Scene(new Vec3(0.1, 0.1, 0.2));

    // NEW: Initialize TextureManager
    textureManager = new TextureManager();

    // Add objects to the scene
    // Example: Add a textured plane (ensure 'checkerboard.png' exists in public/assets/textures for testing)
    // For initial testing, you might need to manually upload a checkerboard.png or similar.
    const groundPlane = new Plane(
        new Vec3(0.0, -1.0, 0.0),
        new Vec3(0.0, 1.0, 0.0),
        new Vec3(0.8, 0.8, 0.8),
        'checkerboard.png', // NEW: Texture ID for the ground plane
        0.5 // NEW: UV scale for tiling
    );
    scene.addObject(groundPlane);

    // Add a shiny red sphere and a less shiny blue sphere for testing specular
    scene.addObject(new Sphere(new Vec3(0.0, 0.5, 0.0), 1.0,
        new Vec3(1.0, 0.0, 0.0), // Diffuse Red
        null, // No texture
        new Vec3(1.0, 1.0, 1.0), // Specular White
        50 // Shininess
    ));
    scene.addObject(new Sphere(new Vec3(1.8, 0.0, -1.5), 0.6,
        new Vec3(0.0, 0.5, 0.0), // Diffuse Green
        null, // No texture
        new Vec3(0.5, 0.5, 0.5), // Specular Grey
        10 // Shininess
    ));
    scene.addObject(new Sphere(new Vec3(-1.5, 1.0, 0.8), 0.7,
        new Vec3(0.0, 0.0, 1.0), // Diffuse Blue
        null, // No texture
        new Vec3(0.0, 0.0, 0.0), // No Specular
        0 // Shininess
    ));
    scene.addObject(new Sphere(new Vec3(-2.0, 0.0, -0.5), 0.4, new Vec3(1.0, 1.0, 0.0))); // Yellow sphere

    // Add light sources to the scene
    scene.addLight(new Light(new Vec3(6.0, 6.0, 6.0), new Vec3(1.0, 1.0, 1.0)));
    scene.addLight(new Light(new Vec3(-6.0, 4.0, 3.0), new Vec3(0.5, 0.8, 1.0)));

    // Initialize Raytracer (pass textureManager)
    raytracer = new Raytracer(canvas, ctx, camera, scene, textureManager); // Modified constructor call

    // --- Get references to UI elements ---
    const modelFileInput = document.getElementById('modelFileInput');
    const textureFileInput = document.getElementById('textureFileInput');
    const modelFileNameDisplay = document.getElementById('modelFileName');
    const textureFileNameDisplay = document.getElementById('textureFileName');
    const modelTextureGroup = document.querySelector('.model-texture-group');

    // NEW: Get references for specular controls
    const specularColorPicker = document.getElementById('specularColor');
    const shininessSlider = document.getElementById('shininess');
    const shininessValueDisplay = document.getElementById('shininessValue');
    const reflectivitySlider = document.getElementById('reflectivity');
    const reflectivityValueDisplay = document.getElementById('reflectivityValue');
    const specularGroup = document.querySelector('.specular-group'); // Assuming you add this div in index.html

    // Initialize UI Manager
    uiManager = new UIManager(
        {
            eyeX: document.getElementById('eyeX'), eyeY: document.getElementById('eyeY'), eyeZ: document.getElementById('eyeZ'),
            lookAtX: document.getElementById('lookAtX'), lookAtY: document.getElementById('lookAtY'), lookAtZ: document.getElementById('lookAtZ'),
            fov: document.getElementById('fov'), orbitRadius: document.getElementById('orbitRadius')
        },
        {
            eyeXValue: document.getElementById('eyeXValue'), eyeYValue: document.getElementById('eyeYValue'), eyeZValue: document.getElementById('eyeZValue'),
            lookAtXValue: document.getElementById('lookAtXValue'), lookAtYValue: document.getElementById('lookAtYValue'), lookAtZValue: document.getElementById('lookAtZValue'),
            fovValue: document.getElementById('fovValue'), orbitRadiusValue: document.getElementById('orbitRadiusValue')
        },
        {
            selectedObjectInfo: document.getElementById('selectedObjectInfo'),
            colorPickerGroup: document.querySelector('.color-picker-group'),
            objectColor: document.getElementById('objectColor'),
            // NEW: Pass specular controls to UIManager
            specularColor: specularColorPicker,
            shininess: shininessSlider,
            shininessValue: shininessValueDisplay,
            reflectivity: reflectivitySlider,
            reflectivityValue: reflectivityValueDisplay,
            specularGroup: specularGroup
        },
        {
            modelFileInput: modelFileInput, textureFileInput: textureFileInput,
            modelFileName: modelFileNameDisplay, textureFileName: textureFileNameDisplay,
            modelTextureGroup: modelTextureGroup
        }
    );

    // Set initial UI values based on camera/scene defaults
    uiManager.updateCameraValues(camera.eyePosition, camera.lookAt, camera.fov, cameraRadius);
    uiManager.updateEyePositionDisplay(camera.eyePosition);

    // --- Event Listeners ---
    uiManager.cameraControls.lookAtX.oninput = updateCameraFromUI;
    uiManager.cameraControls.lookAtY.oninput = updateCameraFromUI;
    uiManager.cameraControls.lookAtZ.oninput = updateCameraFromUI;
    uiManager.cameraControls.fov.oninput = updateCameraFromUI;
    uiManager.cameraControls.orbitRadius.oninput = updateCameraFromUI;

    // Diffuse color picker
    uiManager.selectedObjectControls.objectColor.oninput = (event) => {
        if (selectedObject) {
            selectedObject.color = Vec3.fromHexString(event.target.value);
            render();
        }
    };

    // NEW: Specular color picker
    if (uiManager.selectedObjectControls.specularColor) {
        uiManager.selectedObjectControls.specularColor.oninput = (event) => {
            if (selectedObject) {
                selectedObject.specularColor = Vec3.fromHexString(event.target.value);
                render();
            }
        };
    }

    // NEW: Shininess slider
    if (uiManager.selectedObjectControls.shininess) {
        uiManager.selectedObjectControls.shininess.oninput = (event) => {
            if (selectedObject) {
                selectedObject.shininess = parseFloat(event.target.value);
                uiManager.selectedObjectControls.shininessValue.textContent = selectedObject.shininess.toFixed(0);
                render();
            }
        };
    }

    // NEW: Reflectivity slider
    if (uiManager.selectedObjectControls.reflectivity) {
        uiManager.selectedObjectControls.reflectivity.oninput = (event) => {
            if (selectedObject) {
                selectedObject.reflectivity = parseFloat(event.target.value);
                uiManager.selectedObjectControls.reflectivityValue.textContent = selectedObject.reflectivity.toFixed(2);
                render();
            }
        };
    }

    modelFileInput.onchange = (event) => {
        if (event.target.files.length > 0) {
            const file = event.target.files[0];
            const reader = new FileReader();

            reader.onload = (e) => {
                try {
                    const objContent = e.target.result;
                    const loadedMesh = OBJLoader.parse(
                        objContent,
                        new Vec3(0.5, 0.7, 1.0), // Default diffuse color for loaded mesh
                        file.name,
                        selectedObject ? selectedObject.textureId : null, // Pass current texture if any
                        selectedObject ? selectedObject.specularColor : new Vec3(0.0, 0.0, 0.0), // Pass current specular color
                        selectedObject ? selectedObject.shininess : 0, // Pass current shininess
                        selectedObject ? selectedObject.reflectivity : 0.0 // Pass current reflectivity
                    );
                    if (loadedMesh) {
                        scene.objects = scene.objects.filter(obj => obj instanceof Plane || obj instanceof Sphere);
                        scene.addObject(loadedMesh);
                        uiManager.updateModelFileName(file.name);
                        selectedObject = loadedMesh;
                        uiManager.displaySelectedObject(selectedObject);
                        console.log(`Successfully loaded and added mesh: ${file.name}`);
                    } else {
                        console.error(`Failed to parse OBJ file: ${file.name}`);
                        uiManager.updateModelFileName('Failed to load');
                    }
                } catch (error) {
                    console.error(`Error loading OBJ file ${file.name}:`, error);
                    uiManager.updateModelFileName('Error loading');
                }
                render();
            };

            reader.onerror = (e) => {
                console.error(`FileReader error for ${file.name}:`, e);
                uiManager.updateModelFileName('Read error');
            };

            reader.readAsText(file);
        }
    };

    textureFileInput.onchange = async (event) => {
        if (event.target.files.length > 0 && selectedObject) {
            const file = event.target.files[0];
            uiManager.updateTextureFileName('Loading...');
            try {
                const textureId = await textureManager.loadImage(file);
                selectedObject.textureId = textureId;
                selectedObject.textureName = file.name;
                uiManager.updateTextureFileName(file.name);
                console.log(`Texture '${file.name}' applied to selected object.`);
            } catch (error) {
                console.error(`Error loading or applying texture ${file.name}:`, error);
                uiManager.updateTextureFileName('Error loading');
                selectedObject.textureId = null;
            }
            render();
        } else if (!selectedObject) {
            console.warn("No object selected to apply texture to.");
            uiManager.updateTextureFileName('No object selected');
        } else {
            uiManager.updateTextureFileName('No file chosen');
        }
    };


    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('wheel', onMouseWheel);
    canvas.addEventListener('contextmenu', (event) => event.preventDefault());

    // Initial render
    render();
}

// --- Camera Update Functions ---
function updateCameraFromUI() {
    camera.lookAt.x = parseFloat(uiManager.cameraControls.lookAtX.value);
    camera.lookAt.y = parseFloat(uiManager.cameraControls.lookAtY.value);
    camera.lookAt.z = parseFloat(uiManager.cameraControls.lookAtZ.value);
    camera.fov = parseFloat(uiManager.cameraControls.fov.value);
    cameraRadius = parseFloat(uiManager.cameraControls.orbitRadius.value);

    updateCameraPositionFromOrbit();
    camera.updateBasis();
    uiManager.updateEyePositionDisplay(camera.eyePosition);
    uiManager.updateCameraValues(camera.eyePosition, camera.lookAt, camera.fov, cameraRadius);
    render();
}

function updateCameraPositionFromOrbit() {
    const yawRad = cameraYaw * Math.PI / 180.0;
    const pitchRad = cameraPitch * Math.PI / 180.0;

    camera.eyePosition.x = cameraRadius * Math.cos(yawRad) * Math.cos(pitchRad);
    camera.eyePosition.y = cameraRadius * Math.sin(pitchRad);
    camera.eyePosition.z = cameraRadius * Math.sin(yawRad) * Math.cos(pitchRad);

    camera.eyePosition = camera.eyePosition.add(camera.lookAt);
}

// --- Mouse Event Handlers ---
function onMouseDown(event) {
    if (event.button === 2) {
        isRotating = true;
        firstMouse = true;
        raytracer.canvas.requestPointerLock();
    } else if (event.button === 0) {
        const rect = raytracer.canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        const pixelX = Math.floor(x * (CANVAS_WIDTH / rect.width));
        const pixelY = Math.floor(y * (CANVAS_HEIGHT / rect.height));

        const hitResult = raytracer.pickObject(pixelX, pixelY);

        const groundPlane = scene.objects.find(obj => obj instanceof Plane);
        if (hitResult.object && hitResult.object !== groundPlane) {
            selectedObject = hitResult.object;
            selectedObjectIndex = scene.objects.indexOf(selectedObject);
            uiManager.displaySelectedObject(selectedObject);
        } else {
            selectedObject = null;
            selectedObjectIndex = -1;
            uiManager.clearSelectedObjectDisplay();
        }
        render();
    }
}

function onMouseUp(event) {
    if (event.button === 2) {
        isRotating = false;
        document.exitPointerLock();
    }
}

function onMouseMove(event) {
    if (isRotating) {
        const movementX = event.movementX;
        const movementY = event.movementY;

        const xoffset = movementX * CAMERA_SENSITIVITY;
        const yoffset = -movementY * CAMERA_SENSITIVITY;

        cameraYaw += xoffset;
        cameraPitch += yoffset;

        if (cameraPitch > 89.0) {
            cameraPitch = 89.0;
        }
        if (cameraPitch < -89.0) {
            cameraPitch = -89.0;
        }

        updateCameraPositionFromOrbit();
        camera.updateBasis();
        uiManager.updateEyePositionDisplay(camera.eyePosition);
        render();
    }
}

function onMouseWheel(event) {
    event.preventDefault();
    cameraRadius -= event.deltaY * 0.01;

    if (cameraRadius < 1.0) cameraRadius = 1.0;
    if (cameraRadius > 20.0) cameraRadius = 20.0;

    updateCameraPositionFromOrbit();
    camera.updateBasis();
    uiManager.updateEyePositionDisplay(camera.eyePosition);
    uiManager.cameraControls.orbitRadius.value = cameraRadius.toFixed(1);
    uiManager.cameraValueDisplays.orbitRadiusValue.textContent = cameraRadius.toFixed(1);
    render();
}

// --- Rendering Function ---
function render() {
    raytracer.render();
}

// --- Initialize the application when the DOM is fully loaded ---
document.addEventListener('DOMContentLoaded', init);

// Export variables/functions if needed by other modules (e.g., for debugging in console)
export { camera, scene, raytracer, selectedObject, selectedObjectIndex };
