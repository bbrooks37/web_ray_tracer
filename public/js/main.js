// public/js/main.js
// Main application entry point for the interactive web ray tracer.
// Orchestrates the scene setup, rendering loop, and user interactions.

import { Vec3 } from './math.js';
import { Camera } from './camera.js';
import { Scene } from './scene.js';
import { Sphere } from './sphere.js';
import { Plane } from './plane.js';
import { Ray } from './ray.js'; // NEW: Added import for Ray
import { Object } from './object.js'; // NEW: Added import for Object
import { Light } from './light.js'; // NEW: Added import for Light
import { Raytracer } from './raytracer.js';
import { UIManager } from './ui.js';

// --- Global Variables ---
const CANVAS_WIDTH = 640;
const CANVAS_HEIGHT = 480;

let raytracer;
let camera;
let scene;
let uiManager;
let selectedObject = null; // Stores the currently selected object
let selectedObjectIndex = -1; // Stores the index of the selected object in the scene's objects array

// Mouse control variables for camera orbit
let lastMouseX = CANVAS_WIDTH / 2;
let lastMouseY = CANVAS_HEIGHT / 2;
let firstMouse = true;
let isRotating = false; // True when right mouse button is held down for rotation

let cameraYaw = -90.0;  // Initial yaw angle (looking along -Z axis)
let cameraPitch = 0.0;  // Initial pitch angle
let cameraRadius = 6.0; // Distance from lookAt point (orbital radius)
const CAMERA_SENSITIVITY = 0.1; // How fast the camera rotates with mouse movement

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
    // Initial camera setup for orbit. The actual eyePosition will be calculated
    // based on cameraYaw, cameraPitch, and cameraRadius.
    // The initial lookAt point is (0,0,0), and upVector is (0,1,0).
    camera = new Camera(
        new Vec3(0, 0, 0), // Placeholder eyePosition, will be updated by orbit logic
        new Vec3(0, 0, 0), // lookAt
        new Vec3(0, 1, 0), // upVector
        75.0,              // fov (wider view)
        CANVAS_WIDTH, CANVAS_HEIGHT
    );

    // Initialize camera's actual eye position based on initial yaw, pitch, radius
    updateCameraPositionFromOrbit();
    camera.updateBasis(); // Ensure basis is updated after initial position

    // Initialize Scene
    scene = new Scene(new Vec3(0.1, 0.1, 0.2)); // Slightly bluish background

    // Add objects to the scene
    scene.addObject(new Sphere(new Vec3(0.0, 0.5, 0.0), 1.0, new Vec3(1.0, 0.0, 0.0))); // Red sphere
    scene.addObject(new Sphere(new Vec3(1.8, 0.0, -1.5), 0.6, new Vec3(0.0, 1.0, 0.0))); // Green sphere
    scene.addObject(new Sphere(new Vec3(-1.5, 1.0, 0.8), 0.7, new Vec3(0.0, 0.0, 1.0))); // Blue sphere
    const groundPlane = new Plane(new Vec3(0.0, -1.0, 0.0), new Vec3(0.0, 1.0, 0.0), new Vec3(0.8, 0.8, 0.8)); // Ground Plane
    scene.addObject(groundPlane); // Add ground plane
    scene.addObject(new Sphere(new Vec3(-2.0, 0.0, -0.5), 0.4, new Vec3(1.0, 1.0, 0.0))); // Yellow sphere

    // Add light sources to the scene
    scene.addLight(new Light(new Vec3(6.0, 6.0, 6.0), new Vec3(1.0, 1.0, 1.0))); // NEW: Use 'new Light'
    scene.addLight(new Light(new Vec3(-6.0, 4.0, 3.0), new Vec3(0.5, 0.8, 1.0))); // NEW: Use 'new Light'

    // Initialize Raytracer
    raytracer = new Raytracer(canvas, ctx, camera, scene);

    // --- Get references to new UI elements ---
    const modelFileInput = document.getElementById('modelFileInput');
    const textureFileInput = document.getElementById('textureFileInput');
    const modelFileNameDisplay = document.getElementById('modelFileName');
    const textureFileNameDisplay = document.getElementById('textureFileName');
    const modelTextureGroup = document.querySelector('.model-texture-group');

    // Initialize UI Manager
    uiManager = new UIManager(
        // Camera controls
        {
            eyeX: document.getElementById('eyeX'),
            eyeY: document.getElementById('eyeY'),
            eyeZ: document.getElementById('eyeZ'),
            lookAtX: document.getElementById('lookAtX'),
            lookAtY: document.getElementById('lookAtY'),
            lookAtZ: document.getElementById('lookAtZ'),
            fov: document.getElementById('fov'),
            orbitRadius: document.getElementById('orbitRadius')
        },
        // Camera value displays
        {
            eyeXValue: document.getElementById('eyeXValue'),
            eyeYValue: document.getElementById('eyeYValue'),
            eyeZValue: document.getElementById('eyeZValue'),
            lookAtXValue: document.getElementById('lookAtXValue'),
            lookAtYValue: document.getElementById('lookAtYValue'),
            lookAtZValue: document.getElementById('lookAtZValue'),
            fovValue: document.getElementById('fovValue'),
            orbitRadiusValue: document.getElementById('orbitRadiusValue')
        },
        // Selected object controls
        {
            selectedObjectInfo: document.getElementById('selectedObjectInfo'),
            colorPickerGroup: document.querySelector('.color-picker-group'),
            objectColor: document.getElementById('objectColor')
        },
        // NEW: Model and Texture controls
        {
            modelFileInput: modelFileInput,
            textureFileInput: textureFileInput,
            modelFileName: modelFileNameDisplay,
            textureFileName: textureFileNameDisplay,
            modelTextureGroup: modelTextureGroup
        }
    );

    // Set initial UI values based on camera/scene defaults
    uiManager.updateCameraValues(camera.eyePosition, camera.lookAt, camera.fov, cameraRadius); // Corrected initial call
    uiManager.updateEyePositionDisplay(camera.eyePosition); // Display initial eye position

    // --- Event Listeners ---
    // Camera control sliders
    uiManager.cameraControls.lookAtX.oninput = updateCameraFromUI;
    uiManager.cameraControls.lookAtY.oninput = updateCameraFromUI;
    uiManager.cameraControls.lookAtZ.oninput = updateCameraFromUI;
    uiManager.cameraControls.fov.oninput = updateCameraFromUI;
    uiManager.cameraControls.orbitRadius.oninput = updateCameraFromUI;

    // Object color picker
    uiManager.selectedObjectControls.objectColor.oninput = (event) => {
        if (selectedObject) {
            selectedObject.color = Vec3.fromHexString(event.target.value);
            render(); // Re-render scene after color change
        }
    };

    // NEW: Placeholder event listeners for model and texture file inputs
    modelFileInput.onchange = (event) => {
        if (event.target.files.length > 0) {
            const file = event.target.files[0];
            uiManager.updateModelFileName(file.name);
            console.log(`Model file selected: ${file.name}. (Parsing logic to be implemented)`);
            // TODO: Implement actual model loading and parsing here
            // e.g., loadOBJ(file, selectedObject);
            render(); // Re-render if model changes
        }
    };

    textureFileInput.onchange = (event) => {
        if (event.target.files.length > 0) {
            const file = event.target.files[0];
            uiManager.updateTextureFileName(file.name);
            console.log(`Texture file selected: ${file.name}. (Loading logic to be implemented)`);
            // TODO: Implement actual texture loading and application here
            // e.g., loadTexture(file, selectedObject);
            render(); // Re-render if texture changes
        }
    };


    // Mouse events for picking and camera orbit
    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('wheel', onMouseWheel);

    // Prevent context menu on right-click to allow orbit
    canvas.addEventListener('contextmenu', (event) => event.preventDefault());

    // Initial render
    render();
}

// --- Camera Update Functions ---
function updateCameraFromUI() {
    // Update camera properties from UI sliders
    camera.lookAt.x = parseFloat(uiManager.cameraControls.lookAtX.value);
    camera.lookAt.y = parseFloat(uiManager.cameraControls.lookAtY.value);
    camera.lookAt.z = parseFloat(uiManager.cameraControls.lookAtZ.value);
    camera.fov = parseFloat(uiManager.cameraControls.fov.value);
    cameraRadius = parseFloat(uiManager.cameraControls.orbitRadius.value);

    // Recalculate camera position based on orbit parameters
    updateCameraPositionFromOrbit();
    camera.updateBasis(); // Update camera basis vectors
    uiManager.updateEyePositionDisplay(camera.eyePosition); // Update display
    uiManager.updateCameraValues(camera.eyePosition, camera.lookAt, camera.fov, cameraRadius); // Update UI sliders
    render(); // Re-render scene
}

function updateCameraPositionFromOrbit() {
    const yawRad = cameraYaw * Math.PI / 180.0;
    const pitchRad = cameraPitch * Math.PI / 180.0;

    camera.eyePosition.x = cameraRadius * Math.cos(yawRad) * Math.cos(pitchRad);
    camera.eyePosition.y = cameraRadius * Math.sin(pitchRad);
    camera.eyePosition.z = cameraRadius * Math.sin(yawRad) * Math.cos(pitchRad);

    // Adjust for lookAt point if it's not at the origin
    camera.eyePosition = camera.eyePosition.add(camera.lookAt);
}

// --- Mouse Event Handlers ---
function onMouseDown(event) {
    // Right mouse button for orbit
    if (event.button === 2) { // 0: left, 1: middle, 2: right
        isRotating = true;
        firstMouse = true; // Reset firstMouse flag when rotation starts
        // Request pointer lock for continuous mouse movement tracking without cursor leaving window
        raytracer.canvas.requestPointerLock();
    }
    // Left mouse button for picking
    else if (event.button === 0) {
        const rect = raytracer.canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        // Convert canvas coordinates to pixel coordinates
        const pixelX = Math.floor(x * (CANVAS_WIDTH / rect.width));
        const pixelY = Math.floor(y * (CANVAS_HEIGHT / rect.height));

        // Perform picking
        const hitResult = raytracer.pickObject(pixelX, pixelY);

        // Filter out the ground plane from selection
        const groundPlane = scene.objects.find(obj => obj instanceof Plane); // Assuming you have a Plane class
        if (hitResult.object && hitResult.object !== groundPlane) {
            selectedObject = hitResult.object;
            // Find the index of the selected object in the scene's objects array
            selectedObjectIndex = scene.objects.indexOf(selectedObject);
            uiManager.displaySelectedObject(selectedObject);
        } else {
            selectedObject = null;
            selectedObjectIndex = -1;
            uiManager.clearSelectedObjectDisplay();
        }
        render(); // Re-render to reflect selection (e.g., if we added selection highlight)
    }
}

function onMouseUp(event) {
    if (event.button === 2) { // Right mouse button
        isRotating = false;
        document.exitPointerLock(); // Release pointer lock
    }
}

function onMouseMove(event) {
    if (isRotating) {
        // Use event.movementX/Y for pointer lock, which gives delta movement
        const movementX = event.movementX;
        const movementY = event.movementY;

        const xoffset = movementX * CAMERA_SENSITIVITY;
        const yoffset = -movementY * CAMERA_SENSITIVITY; // Reversed since Y-coordinates go top to bottom on screen

        cameraYaw += xoffset;
        cameraPitch += yoffset;

        // Clamp pitch to avoid flipping the camera upside down
        if (cameraPitch > 89.0) {
            cameraPitch = 89.0;
        }
        if (cameraPitch < -89.0) {
            cameraPitch = -89.0;
        }

        updateCameraPositionFromOrbit();
        camera.updateBasis(); // Update camera's basis vectors
        uiManager.updateEyePositionDisplay(camera.eyePosition); // Update UI display
        render(); // Re-render scene
    }
}

function onMouseWheel(event) {
    event.preventDefault(); // Prevent page scrolling
    cameraRadius -= event.deltaY * 0.01; // Adjust sensitivity as needed

    // Clamp radius
    if (cameraRadius < 1.0) cameraRadius = 1.0;
    if (cameraRadius > 20.0) cameraRadius = 20.0;

    updateCameraPositionFromOrbit();
    camera.updateBasis(); // Update camera's basis vectors
    uiManager.updateEyePositionDisplay(camera.eyePosition); // Update UI display
    uiManager.cameraControls.orbitRadius.value = cameraRadius.toFixed(1); // Update slider
    uiManager.cameraValueDisplays.orbitRadiusValue.textContent = cameraRadius.toFixed(1); // Update text
    render(); // Re-render scene
}

// --- Rendering Function ---
function render() {
    raytracer.render();
}

// --- Initialize the application when the DOM is fully loaded ---
document.addEventListener('DOMContentLoaded', init);

// Export variables/functions if needed by other modules (e.g., for debugging in console)
export { camera, scene, raytracer, selectedObject, selectedObjectIndex };
