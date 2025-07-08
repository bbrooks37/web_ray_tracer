// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, signInWithCustomToken, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, collection, query, where, addDoc, getDocs, deleteDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
// Also include Three.js core and GLTFLoader as it's a Three.js extension
import * as THREE from "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.module.js";
import { GLTFLoader } from "https://cdn.jsdelivr.net/npm/three@0.128.0/examples/jsm/loaders/GLTFLoader.js";
import { CSG } from "https://cdn.jsdelivr.net/npm/three-bvh-csg@0.0.10/dist/three-bvh-csg.umd.js"; // Import CSG library

// Global Firebase variables
window.firebaseApp = null;
window.db = null;
window.auth = null;
window.userId = null; // Will store the current user's ID
window.isAuthReady = false; // Flag to indicate if auth state is ready

// MANDATORY: Use __app_id from the Canvas environment or a default for local testing
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

// Your web app's Firebase configuration (pasted directly as provided by the user)
const firebaseConfig = {
    apiKey: "AIzaSyBB3JBHBUh2GbukA_n3YeMBeaC7y-FmUII",
    authDomain: "particle-simulation-app.firebaseapp.com",
    projectId: "particle-simulation-app",
    storageBucket: "particle-simulation-app.firebasestorage.app",
    messagingSenderId: "555581283266",
    appId: "1:555581283266:web:9197bb66f9289aac0a545b",
    // measurementId: "G-EVHNNE4HT2" // Optional, removed as not explicitly requested for use
};

// Initialize Firebase and set up authentication listener
window.onload = async function() {
    try {
        window.firebaseApp = initializeApp(firebaseConfig);
        window.db = getFirestore(window.firebaseApp);
        window.auth = getAuth(window.firebaseApp);

        onAuthStateChanged(window.auth, async (user) => {
            if (user) {
                window.userId = user.uid;
                console.log("User logged in:", window.userId);
                document.getElementById('user-id-display').textContent = `User ID: ${window.userId}`;
                document.getElementById('auth-section').style.display = 'none';
                document.getElementById('app-section').style.display = 'block';
                await window.loadProjects(); // Load projects for the logged-in user
            } else {
                window.userId = null;
                console.log("User logged out or not authenticated.");
                document.getElementById('user-id-display').textContent = 'User ID: Not logged in';
                document.getElementById('auth-section').style.display = 'block';
                document.getElementById('app-section').style.display = 'none';
                document.getElementById('projects-list').innerHTML = ''; // Clear projects
            }
            window.isAuthReady = true; // Auth state is now known
            // Start the 3D scene only after authentication is ready
            window.setupScene();
            window.animate();
        });

        // MANDATORY: Use __initial_auth_token for Canvas environment authentication
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
            await signInWithCustomToken(window.auth, __initial_auth_token);
        } else {
            // If no custom token (e.g., local development or anonymous user in Canvas)
            await signInAnonymously(window.auth);
        }

    } catch (error) {
        console.error("Error initializing Firebase or signing in:", error);
        document.getElementById('model-status').textContent = `Initialization Error: ${error.message}`;
        document.getElementById('loading-overlay').style.display = 'none';
        // Fallback to a basic scene without auth if initialization fails
        window.setupScene();
        window.animate();
    }
};

// --- Authentication Functions ---
window.signUp = async function() {
    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-password').value;
    if (!email || !password) {
        document.getElementById('auth-message').textContent = "Email and password are required for sign up.";
        console.error("Email and password are required for sign up.");
        return;
    }
    try {
        await createUserWithEmailAndPassword(window.auth, email, password);
        document.getElementById('auth-message').textContent = "Signed up successfully! You are now logged in.";
        console.log("Signed up successfully!");
    } catch (error) {
        console.error("Error signing up:", error.message);
        document.getElementById('auth-message').textContent = `Sign Up Error: ${error.message}`;
    }
};

window.signIn = async function() {
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    if (!email || !password) {
        document.getElementById('auth-message').textContent = "Email and password are required for login.";
        console.error("Email and password are required for login.");
        return;
    }
    try {
        await signInWithEmailAndPassword(window.auth, email, password);
        document.getElementById('auth-message').textContent = "Logged in successfully!";
        console.log("Logged in successfully!");
    } catch (error) {
        console.error("Error logging in:", error.message);
        document.getElementById('auth-message').textContent = `Login Error: ${error.message}`;
    }
};

window.signOutUser = async function() {
    try {
        await signOut(window.auth);
        document.getElementById('auth-message').textContent = "Signed out successfully.";
        console.log("Signed out successfully!");
    } catch (error) {
        console.error("Error signing out:", error.message);
        document.getElementById('auth-message').textContent = `Sign Out Error: ${error.message}`;
    }
};

// --- Firestore Project Management Functions ---

/**
 * Saves the current 3D scene state to Firestore.
 * This function serializes the components and their properties, including CSG operations.
 */
window.saveProject = async function() {
    if (!window.userId || !window.db) {
        console.warn("User not logged in or Firestore not initialized.");
        document.getElementById('project-message').textContent = "Please log in to save your project.";
        return;
    }

    const projectName = document.getElementById('project-name-input').value.trim();
    if (!projectName) {
        document.getElementById('project-message').textContent = "Please enter a project name.";
        return;
    }

    const components = [];
    scene.traverse(object => {
        if (object.userData && object.userData.isCustomComponent) {
            let materialColor = null;
            let materialTexture = null;

            // Determine the correct color to save
            if (object.userData.componentType === 'window' || object.userData.componentType === 'door') {
                // For window/door groups, the color is stored in userData.material
                materialColor = object.userData.material ? object.userData.material.color : null;
            } else if (object.material) {
                // For other meshes, check if original material exists (if X-Ray was active)
                const currentMaterial = originalMaterials.has(object.uuid) ? originalMaterials.get(object.uuid) : object.material;
                if (currentMaterial && currentMaterial.color) {
                    materialColor = currentMaterial.color.getHex();
                }
                if (currentMaterial && currentMaterial.map && currentMaterial.map.userData && currentMaterial.map.userData.textureName) {
                    materialTexture = currentMaterial.map.userData.textureName;
                }
            }

            const componentData = {
                id: object.uuid,
                type: object.userData.componentType,
                geometry: {
                    width: object.userData.width,
                    height: object.userData.height,
                    depth: object.userData.depth
                },
                position: { x: object.position.x, y: object.position.y, z: object.position.z },
                rotation: { x: object.rotation.x, y: object.rotation.y, z: object.rotation.z },
                scale: { x: object.scale.x, y: object.scale.y, z: object.scale.z },
                material: {
                    color: materialColor,
                    texture: materialTexture
                },
                // Store CSG operations if this object is a result of one
                csgOperations: object.userData.csgOperations || []
            };
            components.push(componentData);
        }
    });

    // Save tour points
    const savedTourPoints = tourPoints.map(p => ({
        position: { x: p.position.x, y: p.position.y, z: p.position.z },
        target: { x: p.target.x, y: p.target.y, z: p.target.z }
    }));

    try {
        const projectsCollectionRef = collection(window.db, `artifacts/${appId}/users/${window.userId}/projects`);
        await addDoc(projectsCollectionRef, {
            projectName: projectName,
            sceneData: JSON.stringify(components),
            tourData: JSON.stringify(savedTourPoints), // Save tour points
            createdAt: serverTimestamp(),
            lastModifiedAt: serverTimestamp(),
            isXRayMode: isXRayMode
        });
        document.getElementById('project-message').textContent = `Project "${projectName}" saved successfully!`;
        console.log("Project saved:", projectName);
        await window.loadProjects(); // Refresh project list
    } catch (error) {
        console.error("Error saving project:", error.message);
        document.getElementById('project-message').textContent = `Error saving project: ${error.message}`;
    }
};

/**
 * Loads projects for the current user and displays them.
 */
window.loadProjects = async function() {
    if (!window.userId || !window.db) {
        console.warn("User not logged in or Firestore not initialized. Cannot load projects.");
        return;
    }

    try {
        const projectsCollectionRef = collection(window.db, `artifacts/${appId}/users/${window.userId}/projects`);
        const q = query(projectsCollectionRef);
        const querySnapshot = await getDocs(q);

        const projects = [];
        querySnapshot.forEach((doc) => {
            projects.push({ id: doc.id, ...doc.data() });
        });

        window.renderProjectsList(projects);
        console.log("Projects loaded:", projects);
    } catch (error) {
        console.error("Error loading projects:", error.message);
        document.getElementById('project-message').textContent = `Error loading projects: ${error.message}`;
    }
};

/**
 * Renders the list of projects in the UI.
 * @param {Array} projects - An array of project objects.
 */
window.renderProjectsList = function(projects) {
    const projectsListElement = document.getElementById('projects-list');
    projectsListElement.innerHTML = ''; // Clear existing list

    if (projects.length === 0) {
        projectsListElement.innerHTML = '<p>No projects saved yet.</p>';
        return;
    }

    projects.forEach(project => {
        const li = document.createElement('li');
        li.className = 'project-item';
        li.innerHTML = `
            <span>${project.projectName}</span>
            <button class="btn btn-secondary btn-small load-project-btn" data-project-id="${project.id}">Load</button>
            <button class="btn btn-secondary btn-small delete-project-btn" data-project-id="${project.id}">Delete</button>
        `;
        projectsListElement.appendChild(li);
    });

    // Add event listeners to load buttons
    projectsListElement.querySelectorAll('.load-project-btn').forEach(button => {
        button.addEventListener('click', async (event) => {
            const projectId = event.target.dataset.projectId;
            await window.loadSpecificProject(projectId);
        });
    });

    // Add event listeners to delete buttons
    projectsListElement.querySelectorAll('.delete-project-btn').forEach(button => {
        button.addEventListener('click', async (event) => {
            const projectId = event.target.dataset.projectId;
            // Using a custom modal for confirmation instead of alert/confirm
            window.showConfirmModal("Are you sure you want to delete this project?", async () => {
                await window.deleteProject(projectId);
            });
        });
    });
};

/**
 * Loads a specific project by its ID and applies its state to the 3D scene.
 * This function reconstructs the scene, including CSG operations and textures.
 * @param {string} projectId - The ID of the project to load.
 */
window.loadSpecificProject = async function(projectId) {
    if (!window.userId || !window.db) {
        console.warn("User not logged in or Firestore not initialized. Cannot load project.");
        return;
    }

    try {
        const projectDocRef = doc(window.db, `artifacts/${appId}/users/${window.userId}/projects`, projectId);
        const projectDocSnap = await getDoc(projectDocRef);

        if (projectDocSnap.exists()) {
            const projectData = projectDocSnap.data();
            const components = JSON.parse(projectData.sceneData);
            const savedTourPoints = projectData.tourData ? JSON.parse(projectData.tourData) : [];
            const savedIsXRayMode = projectData.isXRayMode || false;

            window.clearCustomComponents(); // Clear current scene
            tourPoints = []; // Clear current tour points

            // Reconstruct the scene from saved components
            if (components && components.length > 0) {
                // First, create all base meshes (walls, floors, cubes, roofs, furniture)
                const baseMeshes = new Map(); // Map to store meshes by their original UUID

                components.forEach(compData => {
                    let mesh;
                    const loadedColor = compData.material && compData.material.color !== undefined ? compData.material.color : DEFAULT_MATERIAL_COLOR;
                    const loadedTextureName = compData.material ? compData.material.texture : null;
                    const material = createMaterial(loadedColor, loadedTextureName);

                    if (compData.type === 'wall' || compData.type === 'floor' || compData.type === 'cube' || compData.type === 'roof' || compData.type === 'rug' || compData.type === 'table' || compData.type === 'chair' || compData.type === 'couch' || compData.type === 'wallPanel') {
                        const geometry = new THREE.BoxGeometry(compData.geometry.width, compData.geometry.height, compData.geometry.depth);
                        mesh = new THREE.Mesh(geometry, material);
                        mesh.userData.isCustomComponent = true;
                        mesh.userData.componentType = compData.type;
                        mesh.userData.width = compData.geometry.width;
                        mesh.userData.height = compData.geometry.height;
                        mesh.userData.depth = compData.geometry.depth;
                        mesh.userData.material = { color: loadedColor, texture: loadedTextureName };
                        mesh.position.set(compData.position.x, compData.position.y, compData.position.z);
                        mesh.rotation.set(compData.rotation.x, compData.rotation.y, compData.rotation.z);
                        mesh.scale.set(compData.scale.x, compData.scale.y, compData.scale.z);
                        mesh.uuid = compData.id; // Crucial: Restore original UUID for CSG target matching
                        baseMeshes.set(compData.id, mesh); // Store base mesh by its ID
                    } else if (compData.type === 'window' || compData.type === 'door') {
                        // Windows and doors will be created later as visual components after cuts are applied
                        // We need to store their data to apply CSG operations
                        baseMeshes.set(compData.id, compData); // Store raw data for cutters
                    }
                });

                // Now, apply CSG operations for walls, windows, and doors
                // Iterate through components to identify walls and apply cuts
                components.forEach(compData => {
                    if (compData.type === 'wall') {
                        let wallMesh = baseMeshes.get(compData.id);
                        if (!wallMesh) return;

                        // Re-apply CSG cuts based on stored operations
                        if (compData.csgOperations && compData.csgOperations.length > 0) {
                            // Collect all cutter objects for this wall
                            const cuttersForThisWall = [];
                            compData.csgOperations.forEach(op => {
                                const cutterData = baseMeshes.get(op.cutterId);
                                if (cutterData && (cutterData.type === 'window' || cutterData.type === 'door')) {
                                    cuttersForThisWall.push({
                                        type: cutterData.type,
                                        geometry: cutterData.geometry,
                                        position: cutterData.position,
                                        rotation: cutterData.rotation,
                                        scale: cutterData.scale
                                    });
                                }
                            });

                            // Perform CSG subtractions sequentially
                            let currentWallMesh = wallMesh;
                            cuttersForThisWall.forEach(cutter => {
                                const cutterGeometry = new THREE.BoxGeometry(cutter.geometry.width, cutter.geometry.height, cutter.geometry.depth);
                                const cutterMesh = new THREE.Mesh(cutterGeometry);
                                cutterMesh.position.set(cutter.position.x, cutter.position.y, cutter.position.z);
                                cutterMesh.rotation.set(cutter.rotation.x, cutter.rotation.y, cutter.rotation.z);
                                cutterMesh.scale.set(cutter.scale.x, cutter.scale.y, cutter.scale.z);

                                const csg = new CSG();
                                csg.subtract(currentWallMesh, cutterMesh);
                                const newResultMesh = csg.toMesh();

                                // Transfer original properties to the new mesh
                                newResultMesh.material = currentWallMesh.material;
                                newResultMesh.userData = { ...currentWallMesh.userData };
                                newResultMesh.position.copy(currentWallMesh.position);
                                newResultMesh.rotation.copy(currentWallMesh.rotation);
                                newResultMesh.scale.copy(currentWallMesh.scale);
                                newResultMesh.uuid = currentWallMesh.uuid; // Keep original UUID

                                // Dispose of the old mesh's geometry and material
                                if (currentWallMesh.geometry) currentWallMesh.geometry.dispose();
                                if (currentWallMesh.material) {
                                    if (Array.isArray(currentWallMesh.material)) {
                                        currentWallMesh.material.forEach(m => m.dispose());
                                    } else {
                                        currentWallMesh.material.dispose();
                                    }
                                }
                                currentWallMesh = newResultMesh; // Update reference for next cut
                            });
                            wallMesh = currentWallMesh; // Final cut wall
                        }
                        scene.add(wallMesh); // Add the final wall mesh (with cuts) to the scene
                    }
                });

                // Add visual components for windows and doors after all walls are processed
                components.forEach(compData => {
                    if (compData.type === 'window') {
                        const windowGroup = createWindowMesh(compData.geometry.width, compData.geometry.height, compData.geometry.depth, compData.material.color);
                        windowGroup.position.set(compData.position.x, compData.position.y, compData.position.z);
                        windowGroup.rotation.set(compData.rotation.x, compData.rotation.y, compData.rotation.z);
                        windowGroup.scale.set(compData.scale.x, compData.scale.y, compData.scale.z);
                        windowGroup.uuid = compData.id; // Restore UUID
                        windowGroup.userData.csgOperations = compData.csgOperations; // Restore CSG operations
                        scene.add(windowGroup);
                    } else if (compData.type === 'door') {
                        const doorGroup = createDoorMesh(compData.geometry.width, compData.geometry.height, compData.geometry.depth, compData.material.color);
                        doorGroup.position.set(compData.position.x, compData.position.y, compData.position.z);
                        doorGroup.rotation.set(compData.rotation.x, compData.rotation.y, compData.rotation.z);
                        doorGroup.scale.set(compData.scale.x, compData.scale.y, compData.scale.z);
                        doorGroup.uuid = compData.id; // Restore UUID
                        doorGroup.userData.csgOperations = compData.csgOperations; // Restore CSG operations
                        scene.add(doorGroup);
                    } else if (compData.type !== 'wall') { // Add other non-wall, non-cutter components
                        const mesh = baseMeshes.get(compData.id);
                        if (mesh) {
                            scene.add(mesh);
                        }
                    }
                });
            }

            // Load tour points
            savedTourPoints.forEach(p => {
                tourPoints.push({
                    position: new THREE.Vector3(p.position.x, p.position.y, p.position.z),
                    target: new THREE.Vector3(p.target.x, p.target.y, p.target.z)
                });
            });
            renderTourPointsList(); // Update UI list

            // Apply X-Ray mode if it was saved as active
            if (savedIsXRayMode && !isXRayMode) {
                window.toggleXRayMode();
            } else if (!savedIsXRayMode && isXRayMode) {
                window.toggleXRayMode();
            }

            document.getElementById('model-status').textContent = `Loaded: ${projectData.projectName}`;
            window.loadingOverlay.style.display = 'none';
            document.getElementById('project-message').textContent = `Project "${projectData.projectName}" loaded successfully!`;
            console.log("Project loaded:", projectData.projectName);

            window.deselectObject();
        } else {
            document.getElementById('project-message').textContent = "Project not found.";
            console.warn("Project not found:", projectId);
        }
    } catch (error) {
        console.error("Error loading specific project:", error.message);
        document.getElementById('project-message').textContent = `Error loading project: ${error.message}`;
    }
};

/**
 * Deletes a project by its ID.
 * @param {string} projectId - The ID of the project to delete.
 */
window.deleteProject = async function(projectId) {
    if (!window.userId || !window.db) {
        console.warn("User not logged in or Firestore not initialized.");
        return;
    }
    try {
        const projectDocRef = doc(window.db, `artifacts/${appId}/users/${window.userId}/projects`, projectId);
        await deleteDoc(projectDocRef);
        document.getElementById('project-message').textContent = "Project deleted successfully!";
        console.log("Project deleted:", projectId);
        await window.loadProjects(); // Refresh project list
    } catch (error) {
        console.error("Error deleting project:", error.message);
        document.getElementById('project-message').textContent = `Error deleting project: ${error.message}`;
    }
};

// --- Custom Modal for Confirmation (replacing alert/confirm) ---
window.showConfirmModal = function(message, onConfirm) {
    const modalElement = document.getElementById('custom-confirm-modal');
    document.getElementById('confirm-modal-message').textContent = message;
    modalElement.style.display = 'flex'; // Show the modal

    const confirmYesBtn = document.getElementById('confirm-yes');
    const confirmNoBtn = document.getElementById('confirm-no');

    // Clear previous event listeners to prevent multiple calls
    confirmYesBtn.onclick = null;
    confirmNoBtn.onclick = null;

    confirmYesBtn.onclick = () => {
        onConfirm();
        modalElement.style.display = 'none'; // Hide the modal
    };
    confirmNoBtn.onclick = () => {
        modalElement.style.display = 'none'; // Hide the modal
    };
};

// Global variables for Three.js scene
let scene, camera, renderer;
let cameraTarget = new THREE.Vector3(0, 0, 0); // The point the camera orbits around

// Camera controls
let isDraggingCamera = false;
let previousMouseX = 0;
let previousMouseY = 0;
let rotationSpeed = 0.005;
let zoomSpeed = 0.1;

// UI Elements
const modelStatusElement = document.getElementById('model-status');
const loadingOverlay = document.getElementById('loading-overlay');

// --- Measurement & Navigation Variables ---
let isWalkMode = false;
let isMeasuring = false;
let selectedMeasurementPoints = [];
let measurementSpheres = [];
const MEASUREMENT_SPHERE_RADIUS = 0.2;
const MEASUREMENT_LINE_COLOR = 0x00ff00;

// First-person movement variables
let moveForward = false;
let moveBackward = false;
let moveLeft = false;
let moveRight = false;
let cameraSpeed = 0.5;
const CAMERA_HEIGHT = 1.6;

// Raycaster for interaction
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

// --- Building Tools & Selection Variables ---
let selectedObject = null;
let selectionOutline = null;
const SELECTION_COLOR = 0xffff00;
const DEFAULT_MATERIAL_COLOR = 0x888888;
let isXRayMode = false;

// Store original materials for X-Ray toggle
const originalMaterials = new Map();

// UI elements for selected object properties
let propTypeElement;
let propPositionElement;
let propRotationElement;
let propScaleElement;
let colorPickerElement;
let textureSelectElement; // New: Texture select dropdown

// Input elements for dimensions
let dimWidthInput;
let dimHeightInput;
let dimDepthInput;

// --- Enhanced Navigation, Building, and Visuals Variables ---
let objectMoveForward = false;
let objectMoveBackward = false;
let objectMoveLeft = false;
let objectMoveRight = false;
let objectMoveUp = false;
let objectMoveDown = false;
const OBJECT_MOVE_SPEED = 0.5;
let objectRotateLeft = false;
let objectRotateRight = false;
const OBJECT_ROTATION_SPEED = Math.PI / 32;

// --- Drawing Mode Variables ---
let isDrawing = false;
let drawingType = '';
let drawingStartPoint = new THREE.Vector3();
let currentDrawingLine = null;
const DRAWING_LINE_COLOR = 0x00ffff;
const DRAWING_LINE_DASH_SIZE = 0.5;
const DRAWING_LINE_GAP_SIZE = 0.2;

let isDraggingObject = false;
let dragOffset = new THREE.Vector3();
let dragPlane = new THREE.Plane();

// --- Offset Drawing Variables ---
let isOffsetMode = false;
let offsetReferenceObject = null;
let offsetStartPoint = new THREE.Vector3();
let currentOffsetLine = null;

// --- Texture Loader ---
const textureLoader = new THREE.TextureLoader();
const textures = {
    wood: null,
    tile: null,
    brick: null,
    grass: null
};

// --- Tour Management Variables ---
let tourPoints = []; // Stores { position: THREE.Vector3, target: THREE.Vector3 }
let currentTourPointIndex = 0;
let isTourActive = false;
let tourAnimationId = null;
const TOUR_SPEED = 0.005; // Speed of camera movement during tour
const TOUR_TRANSITION_DURATION = 3000; // Milliseconds for transition between points


/**
 * Sets up the Three.js scene, camera, and renderer.
 */
window.setupScene = function() {
    if (scene) return; // Only setup scene once

    // Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a202c);

    // Add Skybox for a more natural environment
    const cubeTextureLoader = new THREE.CubeTextureLoader();
    const skyboxTexture = cubeTextureLoader.load([
        'https://threejs.org/examples/textures/cube/Bridge2/posx.jpg',
        'https://threejs.org/examples/textures/cube/Bridge2/negx.jpg',
        'https://threejs.org/examples/textures/cube/Bridge2/posy.jpg',
        'https://threejs.org/examples/textures/cube/Bridge2/negy.jpg',
        'https://threejs.org/examples/textures/cube/Bridge2/posz.jpg',
        'https://threejs.org/examples/textures/cube/Bridge2/negz.jpg'
    ]);
    scene.background = skyboxTexture;

    // Camera
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 10, 20);
    camera.lookAt(0, 0, 0);

    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0x404040);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(1, 1, 1).normalize();
    scene.add(directionalLight);
    const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.5);
    directionalLight2.position.set(-1, -1, -1).normalize();
    scene.add(directionalLight2);

    // Ground Plane
    const planeGeometry = new THREE.PlaneGeometry(100, 100);
    const planeMaterial = new THREE.MeshStandardMaterial({
        color: 0x334155,
        roughness: 0.7,
        metalness: 0.1,
        side: THREE.DoubleSide
    });
    const plane = new THREE.Mesh(planeGeometry, planeMaterial);
    plane.rotation.x = Math.PI / 2;
    plane.position.y = -0.01;
    plane.name = 'groundPlane';
    scene.add(plane);

    // Add AxesHelper
    const axesHelper = new THREE.AxesHelper(10);
    scene.add(axesHelper);

    // Event Listeners
    renderer.domElement.addEventListener('mousedown', onMouseDown);
    renderer.domElement.addEventListener('mouseup', onMouseUp);
    renderer.domElement.addEventListener('mousemove', onMouseMove);
    renderer.domElement.addEventListener('wheel', onMouseWheel);
    window.addEventListener('resize', onWindowResize);
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    renderer.domElement.addEventListener('click', onCanvasClick);
    renderer.domElement.addEventListener('dblclick', onCanvasDblClick);
    renderer.domElement.addEventListener('mousemove', onCanvasMouseMove);
    renderer.domElement.addEventListener('mouseup', onCanvasMouseUp);

    // Get UI elements
    window.measurementDistanceElement = document.getElementById('measurement-distance');
    window.measurementMidpointElement = document.getElementById('measurement-midpoint');
    propTypeElement = document.getElementById('prop-type');
    propPositionElement = document.getElementById('prop-position');
    propRotationElement = document.getElementById('prop-rotation');
    propScaleElement = document.getElementById('prop-scale');
    colorPickerElement = document.getElementById('color-picker');
    textureSelectElement = document.getElementById('texture-select'); // Get texture select
    dimWidthInput = document.getElementById('dim-width');
    dimHeightInput = document.getElementById('dim-height');
    dimDepthInput = document.getElementById('dim-depth');

    // Load textures
    loadTextures();
};

/**
 * Loads predefined textures for application to objects.
 */
function loadTextures() {
    const texturePaths = {
        wood: 'https://threejs.org/examples/textures/hardwood2_diffuse.jpg',
        tile: 'https://threejs.org/examples/textures/tiles.jpg',
        brick: 'https://threejs.org/examples/textures/brick_diffuse.jpg',
        grass: 'https://threejs.org/examples/textures/grasslight-big.jpg'
    };

    for (const key in texturePaths) {
        textureLoader.load(texturePaths[key],
            (texture) => {
                texture.wrapS = THREE.RepeatWrapping;
                texture.wrapT = THREE.RepeatWrapping;
                texture.repeat.set(4, 4); // Adjust repetition as needed
                texture.userData = { textureName: key }; // Store name for saving
                textures[key] = texture;
                console.log(`Texture "${key}" loaded.`);
            },
            undefined,
            (err) => {
                console.error(`Error loading texture "${key}":`, err);
            }
        );
    }
}

/**
 * Clears all custom components from the scene.
 * This function handles disposing of geometries and materials to prevent memory leaks.
 */
window.clearCustomComponents = function() {
    const componentsToRemove = [];
    scene.traverse(object => {
        if (object.userData && object.userData.isCustomComponent) {
            componentsToRemove.push(object);
        }
    });

    componentsToRemove.forEach(object => {
        scene.remove(object);
        if (object instanceof THREE.Mesh) {
            if (object.geometry) object.geometry.dispose();
            if (object.material) {
                if (Array.isArray(object.material)) {
                    object.material.forEach(m => m.dispose());
                } else {
                    object.material.dispose();
                }
            }
        } else if (object instanceof THREE.Group) {
            object.traverse(child => {
                if (child instanceof THREE.Mesh) {
                    if (child.geometry) child.geometry.dispose();
                    if (child.material) {
                        if (Array.isArray(child.material)) {
                            child.material.forEach(m => m.dispose());
                        } else {
                            child.material.dispose();
                        }
                    }
                }
            });
        }
    });
    window.deselectObject();
    originalMaterials.clear(); // Clear stored original materials
    if (isXRayMode) window.toggleXRayMode(); // Reset X-Ray mode if active
};

/**
 * Handles window resize events to update camera aspect ratio and renderer size.
 */
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

/**
 * Handles mouse down event for camera rotation (Orbit Mode) or starting object drag.
 * @param {MouseEvent} event - The mouse event.
 */
function onMouseDown(event) {
    if (isWalkMode || isDrawing || isOffsetMode || isTourActive) return;

    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);

    const intersects = raycaster.intersectObjects(scene.children, true);

    if (intersects.length > 0) {
        const clickedObject = intersects[0].object;
        let actualSelectedObject = clickedObject;

        if (clickedObject.parent && clickedObject.parent.userData && clickedObject.parent.userData.isCustomComponent) {
            actualSelectedObject = clickedObject.parent;
        }

        if (actualSelectedObject.userData && actualSelectedObject.userData.isCustomComponent) {
            window.selectObject(actualSelectedObject);
            isDraggingObject = true;
            dragOffset.subVectors(intersects[0].point, actualSelectedObject.position);
            renderer.domElement.style.cursor = 'grabbing';
            return;
        }
    }

    isDraggingCamera = true;
    previousMouseX = event.clientX;
    previousMouseY = event.clientY;
    renderer.domElement.style.cursor = 'grab';
}

/**
 * Handles mouse up event to stop camera rotation or object drag.
 */
function onMouseUp() {
    if (isDraggingCamera) {
        isDraggingCamera = false;
        renderer.domElement.style.cursor = 'auto';
    }
}

/**
 * Handles mouse move event for camera rotation (Orbit Mode) or look (Walk Mode).
 * @param {MouseEvent} event - The mouse event.
 */
function onMouseMove(event) {
    if (isWalkMode) {
        const movementX = event.movementX || event.mozMovementX || event.webkitMovementX || 0;
        const movementY = event.movementY || event.mozMovementY || event.webkitMovementY || 0;

        camera.rotation.y -= movementX * rotationSpeed;
        camera.rotation.x -= movementY * rotationSpeed;
        camera.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, camera.rotation.x));
    } else if (isDraggingCamera) {
        const deltaX = event.clientX - previousMouseX;
        const deltaY = event.clientY - previousMouseY;

        const cameraVector = new THREE.Vector3().subVectors(camera.position, cameraTarget);

        const horizontalAngle = -deltaX * rotationSpeed;
        const horizontalQuaternion = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), horizontalAngle);
        cameraVector.applyQuaternion(horizontalQuaternion);

        const verticalAngle = -deltaY * rotationSpeed;
        const currentUp = camera.up.clone();
        const cameraRight = new THREE.Vector3().crossVectors(currentUp, cameraVector).normalize();
        const verticalQuaternion = new THREE.Quaternion().setFromAxisAngle(cameraRight, verticalAngle);
        cameraVector.applyQuaternion(verticalQuaternion);

        camera.position.copy(cameraTarget).add(cameraVector);
        camera.lookAt(cameraTarget);

        previousMouseX = event.clientX;
        previousMouseY = event.clientY;
    }
}

/**
 * Handles mouse wheel event for camera zoom (Orbit Mode).
 * @param {WheelEvent} event - The mouse wheel event.
 */
function onMouseWheel(event) {
    if (!isWalkMode) {
        event.preventDefault();
        const zoomAmount = event.deltaY * zoomSpeed;
        camera.position.addScaledVector(camera.position.clone().normalize(), zoomAmount);
        const minDistance = 5;
        const maxDistance = 200;
        const currentDistance = camera.position.distanceTo(cameraTarget);
        if (currentDistance < minDistance) {
            camera.position.copy(cameraTarget).add(camera.position.clone().sub(cameraTarget).normalize().multiplyScalar(minDistance));
        } else if (currentDistance > maxDistance) {
            camera.position.copy(cameraTarget).add(camera.position.clone().sub(cameraTarget).normalize().multiplyScalar(maxDistance));
        }
    }
}

/**
 * Handles keyboard key down events for first-person movement or object movement.
 * @param {KeyboardEvent} event - The keyboard event.
 */
function onKeyDown(event) {
    if (isWalkMode) {
        switch (event.code) {
            case 'KeyW': moveForward = true; break;
            case 'KeyS': moveBackward = true; break;
            case 'KeyA': moveLeft = true; break;
            case 'KeyD': moveRight = true; break;
        }
    } else if (selectedObject) {
        switch (event.code) {
            case 'ArrowUp': objectMoveForward = true; break;
            case 'ArrowDown': objectMoveBackward = true; break;
            case 'ArrowLeft':
                if (event.shiftKey) { objectRotateLeft = true; }
                else { objectMoveLeft = true; }
                break;
            case 'ArrowRight':
                if (event.shiftKey) { objectRotateRight = true; }
                else { objectMoveRight = true; }
                break;
            case 'BracketRight': objectMoveUp = true; break;
            case 'BracketLeft': objectMoveDown = true; break;
        }
    }
}

/**
 * Handles keyboard key up events for first-person movement or object movement.
 * @param {KeyboardEvent} event - The keyboard event.
 */
function onKeyUp(event) {
    if (isWalkMode) {
        switch (event.code) {
            case 'KeyW': moveForward = false; break;
            case 'KeyS': moveBackward = false; break;
            case 'KeyA': moveLeft = false; break;
            case 'KeyD': moveRight = false; break;
        }
    } else if (selectedObject) {
        switch (event.code) {
            case 'ArrowUp': objectMoveForward = false; break;
            case 'ArrowDown': objectMoveBackward = false; break;
            case 'ArrowLeft': objectMoveLeft = false; objectRotateLeft = false; break;
            case 'ArrowRight': objectMoveRight = false; objectRotateRight = false; break;
            case 'BracketRight': objectMoveUp = false; break;
            case 'BracketLeft': objectMoveDown = false; break;
        }
    }
}

/**
 * Updates the UI display for the selected object's properties.
 */
function updateSelectedObjectPropertiesUI() {
    if (selectedObject) {
        propTypeElement.textContent = selectedObject.userData.componentType || 'Unknown';
        propPositionElement.textContent = `X: ${selectedObject.position.x.toFixed(2)}, Y: ${selectedObject.position.y.toFixed(2)}, Z: ${selectedObject.position.z.toFixed(2)}`;
        propRotationElement.textContent = `X: ${(selectedObject.rotation.x * 180 / Math.PI).toFixed(1)}°, Y: ${(selectedObject.rotation.y * 180 / Math.PI).toFixed(1)}°, Z: ${(selectedObject.rotation.z * 180 / Math.PI).toFixed(1)}°`;
        propScaleElement.textContent = `X: ${selectedObject.scale.x.toFixed(2)}, Y: ${selectedObject.scale.y.toFixed(2)}, Z: ${selectedObject.scale.z.toFixed(2)}`;

        let currentColor = DEFAULT_MATERIAL_COLOR;
        let currentTextureName = 'none';

        if (selectedObject.userData.componentType === 'window' || selectedObject.userData.componentType === 'door') {
            if (selectedObject.userData.material && selectedObject.userData.material.color !== undefined) {
                currentColor = selectedObject.userData.material.color;
            }
        } else if (selectedObject.material) {
            const material = originalMaterials.has(selectedObject.uuid) ? originalMaterials.get(selectedObject.uuid) : selectedObject.material;
            if (material && material.color) {
                currentColor = material.color.getHex();
            }
            if (material && material.map && material.map.userData && material.map.userData.textureName) {
                currentTextureName = material.map.userData.textureName;
            }
        }
        colorPickerElement.value = `#${new THREE.Color(currentColor).getHexString()}`;
        textureSelectElement.value = currentTextureName;

    } else {
        propTypeElement.textContent = 'N/A';
        propPositionElement.textContent = 'N/A';
        propRotationElement.textContent = 'N/A';
        propScaleElement.textContent = 'N/A';
        colorPickerElement.value = '#9f7aea';
        textureSelectElement.value = 'none';
    }
}

/**
 * Toggles between orbit mode and first-person walk mode.
 */
window.toggleWalkMode = function() {
    isWalkMode = !isWalkMode;
    const toggleBtn = document.getElementById('toggle-walk-mode-btn');
    if (isWalkMode) {
        toggleBtn.textContent = "Exit Walk Mode";
        renderer.domElement.requestPointerLock = renderer.domElement.requestPointerLock ||
                                                 renderer.domElement.mozRequestPointerLock ||
                                                 renderer.domElement.webkitRequestPointerLock;
        if (renderer.domElement.requestPointerLock) {
            renderer.domElement.requestPointerLock();
        }

        camera.position.y = CAMERA_HEIGHT;
        camera.rotation.x = 0;
        camera.lookAt(camera.position.x, CAMERA_HEIGHT, camera.position.z - 1);
    } else {
        toggleBtn.textContent = "Toggle Walk Mode";
        document.exitPointerLock = document.exitPointerLock ||
                                   document.mozExitPointerLock ||
                                   document.webkitExitPointerLock;
        if (document.exitPointerLock) {
            document.exitPointerLock();
        }
        if (selectedObject) {
            cameraTarget.copy(selectedObject.position);
            camera.position.set(selectedObject.position.x + 10, selectedObject.position.y + 10, selectedObject.position.z + 20);
        } else {
            cameraTarget.set(0,0,0);
            camera.position.set(0, 10, 20);
        }
        camera.lookAt(cameraTarget);
    }
    if (isMeasuring) window.toggleMeasurementMode();
    if (isDrawing) window.cancelDrawing();
    if (isOffsetMode) window.cancelOffsetDrawing();
    if (isTourActive) window.stopTour(); // Stop tour if mode changes
    window.deselectObject();
};

/**
 * Toggles the measurement tool on/off.
 */
window.toggleMeasurementMode = function() {
    isMeasuring = !isMeasuring;
    const measureBtn = document.getElementById('measure-distance-btn');
    if (isMeasuring) {
        measureBtn.textContent = "Exit Measurement";
        window.clearMeasurements();
    } else {
        measureBtn.textContent = "Measure Distance";
        window.clearMeasurements();
    }
    if (isWalkMode) window.toggleWalkMode();
    if (isDrawing) window.cancelDrawing();
    if (isOffsetMode) window.cancelOffsetDrawing();
    if (isTourActive) window.stopTour(); // Stop tour if mode changes
    window.deselectObject();
};

/**
 * Toggles X-Ray view mode for custom components.
 */
window.toggleXRayMode = function() {
    isXRayMode = !isXRayMode;
    const xrayBtn = document.getElementById('toggle-xray-btn');

    scene.traverse(object => {
        if (object.userData && object.userData.isCustomComponent) {
            if (object instanceof THREE.Group) {
                object.traverse(child => {
                    if (child instanceof THREE.Mesh && child.material) {
                        applyXRayMaterial(child, isXRayMode);
                    }
                });
            } else if (object instanceof THREE.Mesh && object.material) {
                applyXRayMaterial(object, isXRayMode);
            }
        }
    });

    xrayBtn.textContent = isXRayMode ? "Exit X-Ray View" : "Toggle X-Ray View";
    document.getElementById('model-status').textContent = isXRayMode ? "X-Ray View ON" : "X-Ray View OFF";
};

/**
 * Applies or removes X-Ray material to a given mesh.
 * @param {THREE.Mesh} mesh - The mesh to modify.
 * @param {boolean} apply - True to apply X-Ray, false to remove.
 */
function applyXRayMaterial(mesh, apply) {
    if (apply) {
        if (!originalMaterials.has(mesh.uuid)) {
            originalMaterials.set(mesh.uuid, mesh.material);
        }
        mesh.material = new THREE.MeshBasicMaterial({
            color: mesh.material.color,
            transparent: true,
            opacity: 0.2,
            wireframe: true
        });
    } else {
        if (originalMaterials.has(mesh.uuid)) {
            mesh.material = originalMaterials.get(mesh.uuid);
            originalMaterials.delete(mesh.uuid);
        }
    }
}

/**
 * Clears all visual measurement points and resets display.
 */
window.clearMeasurements = function() {
    selectedMeasurementPoints.forEach(p => scene.remove(p));
    selectedMeasurementPoints = [];
    measurementSpheres.forEach(s => scene.remove(s));
    measurementSpheres = [];
    const existingLine = scene.getObjectByName('measurementLine');
    if (existingLine) {
        scene.remove(existingLine);
        existingLine.geometry.dispose();
        existingLine.material.dispose();
    }
    window.measurementDistanceElement.textContent = 'N/A';
    window.measurementMidpointElement.textContent = 'N/A';
};

/**
 * Handles clicks on the canvas for measurement, selection, drawing, or offsetting.
 * @param {MouseEvent} event - The mouse event.
 */
function onCanvasClick(event) {
    if (isDraggingCamera || isDraggingObject || isTourActive) return;

    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);

    const interactableObjects = [];
    scene.traverse(object => {
        if (object.userData && object.userData.isCustomComponent) {
            interactableObjects.push(object);
        }
        if (object.name === 'groundPlane') {
            interactableObjects.push(object);
        }
    });

    const intersects = raycaster.intersectObjects(interactableObjects, true);

    if (isDrawing) {
        if (intersects.length > 0) {
            const intersectionPoint = intersects[0].point;
            drawingStartPoint.copy(intersectionPoint);
            document.getElementById('model-status').textContent = `Drawing ${drawingType}: Click and drag to define dimensions.`;
        } else {
            document.getElementById('project-message').textContent = "Click on the ground plane to start drawing.";
            window.cancelDrawing();
        }
    } else if (isOffsetMode) {
        if (intersects.length > 0 && intersects[0].object === offsetReferenceObject) {
            const intersectionPoint = intersects[0].point;
            offsetStartPoint.copy(intersectionPoint);
            document.getElementById('model-status').textContent = `Offsetting ${offsetReferenceObject.userData.componentType}: Click and drag to define inner area.`;
        } else {
            document.getElementById('project-message').textContent = "Click on the selected floor or wall to start offsetting.";
            window.cancelOffsetDrawing();
        }
    } else if (isMeasuring) {
        if (intersects.length > 0) {
            const intersectionPoint = intersects[0].point;

            selectedMeasurementPoints.push(intersectionPoint);

            const sphereGeometry = new THREE.SphereGeometry(MEASUREMENT_SPHERE_RADIUS, 16, 16);
            const sphereMaterial = new THREE.MeshBasicMaterial({ color: MEASUREMENT_LINE_COLOR });
            const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
            sphere.position.copy(intersectionPoint);
            scene.add(sphere);
            measurementSpheres.push(sphere);

            if (selectedMeasurementPoints.length === 2) {
                const p1 = selectedMeasurementPoints[0];
                const p2 = selectedMeasurementPoints[1];
                const distance = p1.distanceTo(p2);
                window.measurementDistanceElement.textContent = `${distance.toFixed(2)} units`;

                const midpoint = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
                window.measurementMidpointElement.textContent = `(${midpoint.x.toFixed(2)}, ${midpoint.y.toFixed(2)}, ${midpoint.z.toFixed(2)})`;

                const lineMaterial = new THREE.LineBasicMaterial({ color: MEASUREMENT_LINE_COLOR });
                const points = [];
                points.push(p1);
                points.push(p2);
                const lineGeometry = new THREE.BufferGeometry().setFromPoints(points);
                const line = new THREE.Line(lineGeometry, lineMaterial);
                line.name = 'measurementLine';
                scene.add(line);

                setTimeout(() => {
                    window.clearMeasurements();
                }, 3000);
            } else if (selectedMeasurementPoints.length > 2) {
                window.clearMeasurements();
                selectedMeasurementPoints.push(intersectionPoint);
                scene.add(sphere);
                measurementSpheres.push(sphere);
            }
        }
    } else {
        if (intersects.length > 0) {
            const clickedObject = intersects[0].object;
            let actualSelectedObject = clickedObject;

            if (clickedObject.parent && clickedObject.parent.userData && clickedObject.parent.userData.isCustomComponent) {
                actualSelectedObject = clickedObject.parent;
            }

            if (actualSelectedObject.userData && actualSelectedObject.userData.isCustomComponent) {
                window.selectObject(actualSelectedObject);
            } else {
                window.deselectObject();
            }
        } else {
            window.deselectObject();
        }
    }
}

/**
 * Handles double-clicks on the canvas for material editing.
 * @param {MouseEvent} event - The mouse event.
 */
function onCanvasDblClick(event) {
    if (isTourActive) return; // Disable during tour

    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);

    const intersects = raycaster.intersectObjects(scene.children, true);

    if (intersects.length > 0) {
        const clickedObject = intersects[0].object;
        let actualSelectedObject = clickedObject;

        if (clickedObject.parent && clickedObject.parent.userData && clickedObject.parent.userData.isCustomComponent) {
            actualSelectedObject = clickedObject.parent;
        }

        if (actualSelectedObject.userData && actualSelectedObject.userData.isCustomComponent) {
            window.selectObject(actualSelectedObject);
            colorPickerElement.click();
            document.getElementById('model-status').textContent = `Editing material for ${actualSelectedObject.userData.componentType}.`;
        }
    }
}

/**
 * Handles mouse move event for drawing preview or object dragging.
 * @param {MouseEvent} event - The mouse event.
 */
function onCanvasMouseMove(event) {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);

    if (isDrawing && drawingStartPoint.x !== undefined) {
        const intersects = raycaster.intersectObject(scene.getObjectByName('groundPlane'));
        if (intersects.length > 0) {
            const currentPoint = intersects[0].point;
            window.updateDrawing(currentPoint);
        }
    } else if (isOffsetMode && offsetReferenceObject && offsetStartPoint.x !== undefined) {
        const intersects = raycaster.intersectObject(offsetReferenceObject);
        if (intersects.length > 0) {
            const currentPoint = intersects[0].point;
            window.updateOffsetDrawing(currentPoint);
        }
    } else if (isDraggingObject && selectedObject) {
        const intersects = raycaster.intersectObject(scene.getObjectByName('groundPlane'));
        if (intersects.length > 0) {
            const newPosition = intersects[0].point.clone().sub(dragOffset);
            selectedObject.position.x = newPosition.x;
            selectedObject.position.z = newPosition.z;
            updateSelectedObjectPropertiesUI();
        }
    }
}

/**
 * Handles mouse up event for finalizing drawing or ending object dragging.
 * @param {MouseEvent} event - The mouse event.
 */
function onCanvasMouseUp(event) {
    if (isDrawing) {
        const intersects = raycaster.intersectObject(scene.getObjectByName('groundPlane'));
        if (intersects.length > 0) {
            const endPoint = intersects[0].point;
            window.endDrawing(endPoint);
        } else {
            window.cancelDrawing();
        }
    } else if (isOffsetMode) {
        const intersects = raycaster.intersectObject(offsetReferenceObject);
        if (intersects.length > 0) {
            const endPoint = intersects[0].point;
            window.endOffsetDrawing(endPoint);
        } else {
            window.cancelOffsetDrawing();
        }
    } else if (isDraggingObject) {
        isDraggingObject = false;
        renderer.domElement.style.cursor = 'auto';
        document.getElementById('model-status').textContent = "Object moved.";
    }
}


/**
 * Selects a 3D object and updates the UI.
 * @param {THREE.Object3D} object - The object to select (can be Mesh or Group).
 */
window.selectObject = function(object) {
    if (selectedObject === object) return;

    window.deselectObject();

    selectedObject = object;

    selectionOutline = new THREE.BoxHelper(selectedObject, SELECTION_COLOR);
    scene.add(selectionOutline);

    updateSelectedObjectPropertiesUI();
};

/**
 * Deselects the current 3D object and clears the UI.
 */
window.deselectObject = function() {
    if (selectedObject) {
        if (selectionOutline) {
            scene.remove(selectionOutline);
            selectionOutline = null;
        }
        selectedObject = null;
    }
    updateSelectedObjectPropertiesUI();
};

/**
 * Deletes the currently selected object from the scene.
 */
window.deleteSelectedObject = function() {
    if (selectedObject) {
        window.showConfirmModal("Are you sure you want to delete the selected object?", () => {
            scene.remove(selectedObject);
            if (selectedObject instanceof THREE.Mesh) {
                if (selectedObject.geometry) selectedObject.geometry.dispose();
                if (selectedObject.material) {
                    if (Array.isArray(selectedObject.material)) {
                        selectedObject.material.forEach(m => m.dispose());
                    } else {
                        selectedObject.material.dispose();
                    }
                }
            } else if (selectedObject instanceof THREE.Group) {
                selectedObject.traverse(child => {
                    if (child instanceof THREE.Mesh) {
                        if (child.geometry) child.geometry.dispose();
                        if (child.material) {
                            if (Array.isArray(child.material)) {
                                child.material.forEach(m => m.dispose());
                            } else {
                                child.material.dispose();
                            }
                        }
                    }
                });
            }
            window.deselectObject();
            console.log("Object deleted.");
        });
    } else {
        document.getElementById('project-message').textContent = "No object selected to delete.";
    }
};

/**
 * Creates a standard material with optional texture.
 * @param {number} color - Hex color.
 * @param {string} textureName - Name of the texture to apply ('wood', 'tile', 'brick', 'grass', 'none').
 * @returns {THREE.MeshStandardMaterial} The created material.
 */
function createMaterial(color, textureName) {
    let material;
    if (textureName && textures[textureName]) {
        material = new THREE.MeshStandardMaterial({
            map: textures[textureName],
            color: color // Apply color tint over texture
        });
    } else {
        material = new THREE.MeshStandardMaterial({ color: color });
    }
    return material;
}

/**
 * Adds a wall component to the scene using input dimensions.
 * This function now creates a base wall mesh that can be cut by windows/doors.
 */
window.addWall = function() {
    const width = parseFloat(dimWidthInput.value);
    const height = parseFloat(dimHeightInput.value);
    const depth = parseFloat(dimDepthInput.value);
    if (isNaN(width) || isNaN(height) || isNaN(depth) || width <= 0 || height <= 0 || depth <= 0) {
        document.getElementById('project-message').textContent = "Please enter valid positive dimensions for Wall.";
        return;
    }

    const geometry = new THREE.BoxGeometry(width, height, depth);
    const material = createMaterial(DEFAULT_MATERIAL_COLOR, 'none'); // Walls start with default color, no texture
    const wall = new THREE.Mesh(geometry, material);

    wall.position.set(0, height / 2, 0);
    wall.userData.isCustomComponent = true;
    wall.userData.componentType = 'wall';
    wall.userData.width = width;
    wall.userData.height = height;
    wall.userData.depth = depth;
    wall.userData.csgOperations = []; // To store operations that cut this wall

    scene.add(wall);
    window.selectObject(wall);
    document.getElementById('project-message').textContent = "Wall added. Select it to move/rotate/scale. Double-click to edit material.";
};

/**
 * Adds a floor component to the scene using input dimensions.
 */
window.addFloor = function() {
    const width = parseFloat(dimWidthInput.value);
    const height = parseFloat(dimHeightInput.value);
    const depth = parseFloat(dimDepthInput.value);
    if (isNaN(width) || isNaN(height) || isNaN(depth) || width <= 0 || height <= 0 || depth <= 0) {
        document.getElementById('project-message').textContent = "Please enter valid positive dimensions for Floor.";
        return;
    }
    const geometry = new THREE.BoxGeometry(width, height, depth);
    const material = createMaterial(DEFAULT_MATERIAL_COLOR, 'none');
    const floor = new THREE.Mesh(geometry, material);

    floor.position.set(0, height / 2, 0);
    floor.userData.isCustomComponent = true;
    floor.userData.componentType = 'floor';
    floor.userData.width = width;
    floor.userData.height = height;
    floor.userData.depth = depth;
    scene.add(floor);
    window.selectObject(floor);
    document.getElementById('project-message').textContent = "Floor added. Select it to move/rotate/scale. Double-click to edit material.";
};

/**
 * Adds a generic cube component to the scene using input dimensions.
 */
window.addCube = function() {
    const width = parseFloat(dimWidthInput.value);
    const height = parseFloat(dimHeightInput.value);
    const depth = parseFloat(dimDepthInput.value);
    if (isNaN(width) || isNaN(height) || isNaN(depth) || width <= 0 || height <= 0 || depth <= 0) {
        document.getElementById('project-message').textContent = "Please enter valid positive dimensions for Cube.";
        return;
    }
    const geometry = new THREE.BoxGeometry(width, height, depth);
    const material = createMaterial(DEFAULT_MATERIAL_COLOR, 'none');
    const cube = new THREE.Mesh(geometry, material);

    cube.position.set(0, height / 2, 0);
    cube.userData.isCustomComponent = true;
    cube.userData.componentType = 'cube';
    cube.userData.width = width;
    cube.userData.height = height;
    cube.userData.depth = depth;
    scene.add(cube);
    window.selectObject(cube);
    document.getElementById('project-message').textContent = "Cube added. Select it to move/rotate/scale. Double-click to edit material.";
};

/**
 * Adds a window component to the scene.
 * This function now creates a window (cutter) and applies a CSG subtraction to the selected wall.
 */
window.addWindow = function() {
    const width = parseFloat(dimWidthInput.value);
    const height = parseFloat(dimHeightInput.value);
    const depth = parseFloat(dimDepthInput.value); // Thickness of the window frame/glass
    if (isNaN(width) || isNaN(height) || isNaN(depth) || width <= 0 || height <= 0 || depth <= 0) {
        document.getElementById('project-message').textContent = "Please enter valid positive dimensions for Window.";
        return;
    }

    if (!selectedObject || selectedObject.userData.componentType !== 'wall') {
        document.getElementById('project-message').textContent = "Please select a wall to add a window to.";
        return;
    }

    const wall = selectedObject;
    const windowColor = 0xADD8E6; // Light blue for glass

    // Create the window visual group (frame and glass)
    const windowGroup = createWindowMesh(width, height, depth, windowColor);
    windowGroup.position.copy(wall.position); // Start at wall's position
    windowGroup.position.y = wall.position.y; // Center vertically on wall
    windowGroup.userData.csgOperations = [{ type: 'subtract', targetId: wall.uuid }]; // Store CSG operation data

    scene.add(windowGroup);
    window.selectObject(windowGroup);
    document.getElementById('model-status').textContent = "Window added. Move it to cut the wall. Double-click to edit material.";
    applyCSGCut(wall, windowGroup, 'subtract'); // Apply initial cut
};

/**
 * Helper function to create a window mesh (group of frame and glass).
 */
function createWindowMesh(width, height, depth, color) {
    const frameThickness = 0.1;
    const glassThickness = 0.01;

    const windowGroup = new THREE.Group();
    windowGroup.userData.isCustomComponent = true;
    windowGroup.userData.componentType = 'window';
    windowGroup.userData.width = width;
    windowGroup.userData.height = height;
    windowGroup.userData.depth = depth;
    windowGroup.userData.material = { color: color }; // Store color for saving

    const glassGeometry = new THREE.BoxGeometry(width - frameThickness * 2, height - frameThickness * 2, glassThickness);
    const glassMaterial = new THREE.MeshStandardMaterial({
        color: color,
        transparent: true,
        opacity: 0.5,
        roughness: 0.1,
        metalness: 0.1
    });
    const glassMesh = new THREE.Mesh(glassGeometry, glassMaterial);
    glassMesh.position.z = 0;
    windowGroup.add(glassMesh);

    const frameMaterial = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
    const topFrame = new THREE.Mesh(new THREE.BoxGeometry(width, frameThickness, frameThickness), frameMaterial);
    topFrame.position.set(0, (height / 2) - (frameThickness / 2), 0);
    windowGroup.add(topFrame);
    const bottomFrame = new THREE.Mesh(new THREE.BoxGeometry(width, frameThickness, frameThickness), frameMaterial);
    bottomFrame.position.set(0, -(height / 2) + (frameThickness / 2), 0);
    windowGroup.add(bottomFrame);
    const leftFrame = new THREE.Mesh(new THREE.BoxGeometry(frameThickness, height - frameThickness * 2, frameThickness), frameMaterial);
    leftFrame.position.set(-(width / 2) + (frameThickness / 2), 0, 0);
    windowGroup.add(leftFrame);
    const rightFrame = new THREE.Mesh(new THREE.BoxGeometry(frameThickness, height - frameThickness * 2, frameThickness), frameMaterial);
    rightFrame.position.set((width / 2) - (frameThickness / 2), 0, 0);
    windowGroup.add(rightFrame);

    return windowGroup;
}

/**
 * Adds a door component to the scene.
 * This function creates a door (cutter) and applies a CSG subtraction to the selected wall.
 */
window.addDoor = function() {
    const width = parseFloat(dimWidthInput.value);
    const height = parseFloat(dimHeightInput.value);
    const depth = parseFloat(dimDepthInput.value); // Thickness of the door
    if (isNaN(width) || isNaN(height) || isNaN(depth) || width <= 0 || height <= 0 || depth <= 0) {
        document.getElementById('project-message').textContent = "Please enter valid positive dimensions for Door.";
        return;
    }

    if (!selectedObject || selectedObject.userData.componentType !== 'wall') {
        document.getElementById('project-message').textContent = "Please select a wall to add a door to.";
        return;
    }

    const wall = selectedObject;
    const doorColor = 0x5C4033; // Brown for door

    // Create the door visual group (panel and frame)
    const doorGroup = createDoorMesh(width, height, depth, doorColor);
    doorGroup.position.copy(wall.position); // Start at wall's position
    doorGroup.position.y = wall.position.y - (wall.userData.height / 2) + (height / 2); // Position on ground level
    doorGroup.userData.csgOperations = [{ type: 'subtract', targetId: wall.uuid }]; // Store CSG operation data

    scene.add(doorGroup);
    window.selectObject(doorGroup);
    document.getElementById('model-status').textContent = "Door added. Move it to cut the wall. Double-click to edit material.";
    applyCSGCut(wall, doorGroup, 'subtract'); // Apply initial cut
};

/**
 * Helper function to create a door mesh (group of panel and frame).
 */
function createDoorMesh(width, height, depth, color) {
    const frameThickness = 0.1;

    const doorGroup = new THREE.Group();
    doorGroup.userData.isCustomComponent = true;
    doorGroup.userData.componentType = 'door';
    doorGroup.userData.width = width;
    doorGroup.userData.height = height;
    doorGroup.userData.depth = depth;
    doorGroup.userData.material = { color: color }; // Store color for saving

    // Door panel
    const panelGeometry = new THREE.BoxGeometry(width - frameThickness * 2, height - frameThickness * 2, depth - frameThickness * 2);
    const panelMaterial = new THREE.MeshStandardMaterial({ color: color });
    const panelMesh = new THREE.Mesh(panelGeometry, panelMaterial);
    panelMesh.position.z = 0;
    panelMesh.userData.isPanel = true; // Tag for material editing
    doorGroup.add(panelMesh);

    // Door frame (4 pieces)
    const frameMaterial = new THREE.MeshStandardMaterial({ color: 0x3D2B1F }); // Darker brown for frame
    // Top frame
    const topFrame = new THREE.Mesh(new THREE.BoxGeometry(width, frameThickness, depth), frameMaterial);
    topFrame.position.set(0, (height / 2) - (frameThickness / 2), 0);
    doorGroup.add(topFrame);
    // Bottom frame (usually not visible, but for completeness)
    const bottomFrame = new THREE.Mesh(new THREE.BoxGeometry(width, frameThickness, depth), frameMaterial);
    bottomFrame.position.set(0, -(height / 2) + (frameThickness / 2), 0);
    doorGroup.add(bottomFrame);
    // Left frame
    const leftFrame = new THREE.Mesh(new THREE.BoxGeometry(frameThickness, height - frameThickness * 2, depth), frameMaterial);
    leftFrame.position.set(-(width / 2) + (frameThickness / 2), 0, 0);
    doorGroup.add(leftFrame);
    // Right frame
    const rightFrame = new THREE.Mesh(new THREE.BoxGeometry(frameThickness, height - frameThickness * 2, depth), frameMaterial);
    rightFrame.position.set((width / 2) - (frameThickness / 2), 0, 0);
    doorGroup.add(rightFrame);

    return doorGroup;
}


/**
 * Adds a roof component to the scene using input dimensions.
 * For simplicity, this will be a flat roof for now.
 */
window.addRoof = function() {
    const width = parseFloat(dimWidthInput.value);
    const height = parseFloat(dimHeightInput.value); // Thickness of the roof
    const depth = parseFloat(dimDepthInput.value);
    if (isNaN(width) || isNaN(height) || isNaN(depth) || width <= 0 || height <= 0 || depth <= 0) {
        document.getElementById('project-message').textContent = "Please enter valid positive dimensions for Roof.";
        return;
    }

    const geometry = new THREE.BoxGeometry(width, height, depth);
    const material = createMaterial(0x654321, 'none'); // Brown color for roof
    const roof = new THREE.Mesh(geometry, material);

    roof.position.set(0, 3 + (height / 2), 0);
    roof.userData.isCustomComponent = true;
    roof.userData.componentType = 'roof';
    roof.userData.width = width;
    roof.userData.height = height;
    roof.userData.depth = depth;
    scene.add(roof);
    window.selectObject(roof);
    document.getElementById('project-message').textContent = "Roof added. Select it to move/rotate/scale. Double-click to edit material.";
};

/**
 * Initiates the drawing mode for walls or floors.
 * @param {string} type - 'wall' or 'floor'.
 */
window.startDrawing = function(type) {
    isDrawing = true;
    drawingType = type;
    document.getElementById('model-status').textContent = `Drawing ${type}: Click on the ground plane to set start point.`;
    window.deselectObject();
    window.clearMeasurements();
    window.cancelOffsetDrawing();
    if (isTourActive) window.stopTour();
};

/**
 * Updates the temporary drawing line as the user drags.
 * @param {THREE.Vector3} currentPoint - The current intersection point on the ground.
 */
window.updateDrawing = function(currentPoint) {
    if (!isDrawing || !drawingStartPoint) return;

    if (currentDrawingLine) {
        scene.remove(currentDrawingLine);
        currentDrawingLine.geometry.dispose();
        currentDrawingLine.material.dispose();
    }

    const p1 = drawingStartPoint;
    const p2 = new THREE.Vector3(currentPoint.x, p1.y, p1.z);
    const p3 = currentPoint;
    const p4 = new THREE.Vector3(p1.x, p1.y, currentPoint.z);

    const rectPoints = [p1, p2, p3, p4, p1];

    const geometry = new THREE.BufferGeometry().setFromPoints(rectPoints);
    const material = new THREE.LineDashedMaterial({
        color: DRAWING_LINE_COLOR,
        dashSize: DRAWING_LINE_DASH_SIZE,
        gapSize: DRAWING_LINE_GAP_SIZE
    });
    currentDrawingLine = new THREE.Line(geometry, material);
    currentDrawingLine.computeLineDistances();
    scene.add(currentDrawingLine);

    const width = Math.abs(currentPoint.x - drawingStartPoint.x);
    const depth = Math.abs(currentPoint.z - drawingStartPoint.z);
    dimWidthInput.value = width.toFixed(2);
    dimDepthInput.value = depth.toFixed(2);
    if (drawingType === 'wall') {
        dimHeightInput.value = 3;
    } else if (drawingType === 'floor') {
        dimHeightInput.value = 0.1;
    }
};

/**
 * Finalizes the drawing and creates the component.
 * @param {THREE.Vector3} endPoint - The end point of the drawing.
 */
window.endDrawing = function(endPoint) {
    if (!isDrawing) return;

    if (currentDrawingLine) {
        scene.remove(currentDrawingLine);
        currentDrawingLine.geometry.dispose();
        currentDrawingLine.material.dispose();
        currentDrawingLine = null;
    }

    const startX = drawingStartPoint.x;
    const startZ = drawingStartPoint.z;
    const endX = endPoint.x;
    const endZ = endPoint.z;

    const width = Math.abs(endX - startX);
    const depth = Math.abs(endZ - startZ);
    const centerX = (startX + endX) / 2;
    const centerZ = (startZ + endZ) / 2;

    const height = parseFloat(dimHeightInput.value);

    if (width === 0 || depth === 0 || height === 0) {
        document.getElementById('project-message').textContent = "Dimensions cannot be zero. Drawing canceled.";
        window.cancelDrawing();
        return;
    }

    let newObject;
    if (drawingType === 'wall') {
        newObject = createWallMesh(width, height, depth);
        newObject.position.set(centerX, height / 2, centerZ);
    } else if (drawingType === 'floor') {
        newObject = createFloorMesh(width, height, depth);
        newObject.position.set(centerX, height / 2, centerZ);
    }

    if (newObject) {
        scene.add(newObject);
        window.selectObject(newObject);
        document.getElementById('model-status').textContent = `${drawingType.charAt(0).toUpperCase() + drawingType.slice(1)} created.`;
    }

    isDrawing = false;
    drawingType = '';
    drawingStartPoint = new THREE.Vector3();
};

/**
 * Cancels the current drawing operation.
 */
window.cancelDrawing = function() {
    isDrawing = false;
    drawingType = '';
    drawingStartPoint = new THREE.Vector3();
    if (currentDrawingLine) {
        scene.remove(currentDrawingLine);
        currentDrawingLine.geometry.dispose();
        currentDrawingLine.material.dispose();
        currentDrawingLine = null;
    }
    document.getElementById('model-status').textContent = "Drawing canceled.";
};

/**
 * Initiates offset drawing mode.
 * The currently selected object must be a 'floor' or 'wall'.
 */
window.startOffsetMode = function() {
    if (!selectedObject || (selectedObject.userData.componentType !== 'floor' && selectedObject.userData.componentType !== 'wall')) {
        document.getElementById('project-message').textContent = "Please select a floor or wall to offset.";
        return;
    }
    isOffsetMode = true;
    offsetReferenceObject = selectedObject;
    document.getElementById('model-status').textContent = `Offsetting ${offsetReferenceObject.userData.componentType}: Click and drag on the object to define inner area.`;
    window.cancelDrawing();
    window.clearMeasurements();
    if (isTourActive) window.stopTour();
};

/**
 * Updates the temporary offset drawing line as the user drags.
 * @param {THREE.Vector3} currentPoint - The current intersection point on the object.
 */
window.updateOffsetDrawing = function(currentPoint) {
    if (!isOffsetMode || !offsetReferenceObject || !offsetStartPoint) return;

    if (currentOffsetLine) {
        offsetReferenceObject.remove(currentOffsetLine);
        currentOffsetLine.geometry.dispose();
        currentOffsetLine.material.dispose();
    }

    const localStart = offsetReferenceObject.worldToLocal(offsetStartPoint.clone());
    const localCurrent = offsetReferenceObject.worldToLocal(currentPoint.clone());

    const minX = Math.min(localStart.x, localCurrent.x);
    const maxX = Math.max(localStart.x, localCurrent.x);
    const minZ = Math.min(localStart.z, localCurrent.z);
    const maxZ = Math.max(localStart.z, localCurrent.z);

    const refWidth = offsetReferenceObject.userData.width;
    const refDepth = offsetReferenceObject.userData.depth;

    const halfRefWidth = refWidth / 2;
    const halfRefDepth = refDepth / 2;

    const clampedMinX = Math.max(minX, -halfRefWidth);
    const clampedMaxX = Math.min(maxX, halfRefWidth);
    const clampedMinZ = Math.max(minZ, -halfRefDepth);
    const clampedMaxZ = Math.min(maxZ, halfRefDepth);

    const p1 = new THREE.Vector3(clampedMinX, localStart.y, clampedMinZ);
    const p2 = new THREE.Vector3(clampedMaxX, localStart.y, clampedMinZ);
    const p3 = new THREE.Vector3(clampedMaxX, localStart.y, clampedMaxZ);
    const p4 = new THREE.Vector3(clampedMinX, localStart.y, clampedMaxZ);

    const rectPoints = [p1, p2, p3, p4, p1];

    const geometry = new THREE.BufferGeometry().setFromPoints(rectPoints);
    const material = new THREE.LineDashedMaterial({
        color: DRAWING_LINE_COLOR,
        dashSize: DRAWING_LINE_DASH_SIZE,
        gapSize: DRAWING_LINE_GAP_SIZE
    });
    currentOffsetLine = new THREE.Line(geometry, material);
    currentOffsetLine.computeLineDistances();
    offsetReferenceObject.add(currentOffsetLine);
};

/**
 * Finalizes the offset drawing and creates a new component (e.g., a rug or wall panel).
 * @param {THREE.Vector3} endPoint - The end intersection point on the object.
 */
window.endOffsetDrawing = function(endPoint) {
    if (!isOffsetMode || !offsetReferenceObject) return;

    if (currentOffsetLine) {
        offsetReferenceObject.remove(currentOffsetLine);
        currentOffsetLine.geometry.dispose();
        currentOffsetLine.material.dispose();
        currentOffsetLine = null;
    }

    const localStart = offsetReferenceObject.worldToLocal(offsetStartPoint.clone());
    const localEnd = offsetReferenceObject.worldToLocal(endPoint.clone());

    const minX = Math.min(localStart.x, localEnd.x);
    const maxX = Math.max(localStart.x, localEnd.x);
    const minZ = Math.min(localStart.z, localEnd.z);
    const maxZ = Math.max(localStart.z, localEnd.z);

    const width = Math.abs(maxX - minX);
    const depth = Math.abs(maxZ - minZ);

    if (width === 0 || depth === 0) {
        document.getElementById('project-message').textContent = "Offset area is too small. Offset canceled.";
        window.cancelOffsetDrawing();
        return;
    }

    const centerX = (minX + maxX) / 2;
    const centerZ = (minZ + maxZ) / 2;

    let newOffsetObject;

    if (offsetReferenceObject.userData.componentType === 'floor') {
        const rugThickness = 0.05;
        newOffsetObject = createOffsetFloorMesh(width, rugThickness, depth);
        newOffsetObject.position.set(
            offsetReferenceObject.position.x + centerX,
            offsetReferenceObject.position.y + (offsetReferenceObject.userData.height / 2) + (rugThickness / 2) + 0.01,
            offsetReferenceObject.position.z + centerZ
        );
        newOffsetObject.userData.offsetOf = offsetReferenceObject.uuid;
        document.getElementById('model-status').textContent = "Rug (offset floor) created.";
    } else if (offsetReferenceObject.userData.componentType === 'wall') {
        const panelThickness = 0.05;
        newOffsetObject = createWallMesh(width, offsetReferenceObject.userData.height, panelThickness);
        newOffsetObject.position.set(
            offsetReferenceObject.position.x + centerX,
            offsetReferenceObject.position.y,
            offsetReferenceObject.position.z + centerZ + (offsetReferenceObject.userData.depth / 2) - (panelThickness / 2) - 0.01
        );
        newOffsetObject.userData.offsetOf = offsetReferenceObject.uuid;
        newOffsetObject.userData.componentType = 'wallPanel'; // Differentiate from main walls
        document.getElementById('model-status').textContent = "Wall panel (offset wall) created.";
    }

    if (newOffsetObject) {
        scene.add(newOffsetObject);
        window.selectObject(newOffsetObject);
    }

    window.cancelOffsetDrawing();
};

/**
 * Cancels the current offset drawing operation.
 */
window.cancelOffsetDrawing = function() {
    isOffsetMode = false;
    offsetReferenceObject = null;
    offsetStartPoint = new THREE.Vector3();
    if (currentOffsetLine) {
        scene.remove(currentOffsetLine);
        currentOffsetLine.geometry.dispose();
        currentOffsetLine.material.dispose();
        currentOffsetLine = null;
    }
    document.getElementById('model-status').textContent = "Offset drawing canceled.";
};

/**
 * Helper function for creating offset floor meshes (e.g., rugs).
 */
function createOffsetFloorMesh(width, height, depth) {
    const geometry = new THREE.BoxGeometry(width, height, depth);
    const material = new THREE.MeshStandardMaterial({ color: 0x8B0000 }); // Red for a rug
    const rug = new THREE.Mesh(geometry, material);
    rug.userData.isCustomComponent = true;
    rug.userData.componentType = 'rug';
    rug.userData.width = width;
    rug.userData.height = height;
    rug.userData.depth = depth;
    return rug;
}

/**
 * Adds a simple table to the scene.
 */
window.addTable = function() {
    const tableWidth = 2;
    const tableHeight = 0.8;
    const tableDepth = 1;
    const legThickness = 0.1;

    const tableGroup = new THREE.Group();
    tableGroup.userData.isCustomComponent = true;
    tableGroup.userData.componentType = 'table';
    tableGroup.userData.width = tableWidth;
    tableGroup.userData.height = tableHeight;
    tableGroup.userData.depth = tableDepth;

    // Tabletop
    const tabletopGeometry = new THREE.BoxGeometry(tableWidth, legThickness, tableDepth);
    const tabletopMaterial = createMaterial(0xA0522D, 'wood'); // Sienna wood color
    const tabletop = new THREE.Mesh(tabletopGeometry, tabletopMaterial);
    tabletop.position.y = tableHeight - (legThickness / 2);
    tableGroup.add(tabletop);

    // Legs
    const legHeight = tableHeight - legThickness;
    const legGeometry = new THREE.BoxGeometry(legThickness, legHeight, legThickness);
    const legMaterial = createMaterial(0x8B4513, 'wood'); // SaddleBrown wood color

    const halfWidth = tableWidth / 2 - legThickness / 2;
    const halfDepth = tableDepth / 2 - legThickness / 2;
    const legY = legHeight / 2;

    const leg1 = new THREE.Mesh(legGeometry, legMaterial);
    leg1.position.set(halfWidth, legY, halfDepth);
    tableGroup.add(leg1);

    const leg2 = new THREE.Mesh(legGeometry, legMaterial);
    leg2.position.set(-halfWidth, legY, halfDepth);
    tableGroup.add(leg2);

    const leg3 = new THREE.Mesh(legGeometry, legMaterial);
    leg3.position.set(halfWidth, legY, -halfDepth);
    tableGroup.add(leg3);

    const leg4 = new THREE.Mesh(legGeometry, legMaterial);
    leg4.position.set(-halfWidth, legY, -halfDepth);
    tableGroup.add(leg4);

    tableGroup.position.set(0, 0, 0); // Position on ground
    scene.add(tableGroup);
    window.selectObject(tableGroup);
    document.getElementById('project-message').textContent = "Table added. Double-click to edit material.";
};

/**
 * Adds a simple chair to the scene.
 */
window.addChair = function() {
    const chairWidth = 0.5;
    const chairHeight = 0.9;
    const chairDepth = 0.5;
    const legThickness = 0.05;
    const seatHeight = 0.45;
    const seatThickness = 0.05;

    const chairGroup = new THREE.Group();
    chairGroup.userData.isCustomComponent = true;
    chairGroup.userData.componentType = 'chair';
    chairGroup.userData.width = chairWidth;
    chairGroup.userData.height = chairHeight;
    chairGroup.userData.depth = chairDepth;

    // Seat
    const seatGeometry = new THREE.BoxGeometry(chairWidth, seatThickness, chairDepth);
    const seatMaterial = createMaterial(0x8B4513, 'wood'); // SaddleBrown for seat
    const seat = new THREE.Mesh(seatGeometry, seatMaterial);
    seat.position.y = seatHeight - (seatThickness / 2);
    chairGroup.add(seat);

    // Backrest
    const backrestHeight = chairHeight - seatHeight;
    const backrestGeometry = new THREE.BoxGeometry(chairWidth, backrestHeight, legThickness);
    const backrestMaterial = createMaterial(0x8B4513, 'wood');
    const backrest = new THREE.Mesh(backrestGeometry, backrestMaterial);
    backrest.position.set(0, seatHeight + (backrestHeight / 2), -(chairDepth / 2) + (legThickness / 2));
    chairGroup.add(backrest);

    // Legs
    const legHeight = seatHeight;
    const legGeometry = new THREE.BoxGeometry(legThickness, legHeight, legThickness);
    const legMaterial = createMaterial(0x8B4513, 'wood');

    const halfWidth = chairWidth / 2 - legThickness / 2;
    const halfDepth = chairDepth / 2 - legThickness / 2;
    const legY = legHeight / 2;

    const leg1 = new THREE.Mesh(legGeometry, legMaterial);
    leg1.position.set(halfWidth, legY, halfDepth);
    chairGroup.add(leg1);

    const leg2 = new THREE.Mesh(legGeometry, legMaterial);
    leg2.position.set(-halfWidth, legY, halfDepth);
    chairGroup.add(leg2);

    const leg3 = new THREE.Mesh(legGeometry, legMaterial);
    leg3.position.set(halfWidth, legY, -halfDepth);
    chairGroup.add(leg3);

    const leg4 = new THREE.Mesh(legGeometry, legMaterial);
    leg4.position.set(-halfWidth, legY, -halfDepth);
    chairGroup.add(leg4);

    chairGroup.position.set(0, 0, 0);
    scene.add(chairGroup);
    window.selectObject(chairGroup);
    document.getElementById('project-message').textContent = "Chair added. Double-click to edit material.";
};

/**
 * Adds a simple couch to the scene.
 */
window.addCouch = function() {
    const couchWidth = 2.5;
    const couchHeight = 0.8;
    const couchDepth = 1.0;
    const seatHeight = 0.35;
    const armrestWidth = 0.15;
    const backrestHeight = 0.4;

    const couchGroup = new THREE.Group();
    couchGroup.userData.isCustomComponent = true;
    couchGroup.userData.componentType = 'couch';
    couchGroup.userData.width = couchWidth;
    couchGroup.userData.height = couchHeight;
    couchGroup.userData.depth = couchDepth;

    const couchMaterial = createMaterial(0x6B8E23, 'none'); // Olive Drab color

    // Main seat cushion
    const seatGeometry = new THREE.BoxGeometry(couchWidth - armrestWidth * 2, seatHeight, couchDepth * 0.9);
    const seat = new THREE.Mesh(seatGeometry, couchMaterial);
    seat.position.y = seatHeight / 2;
    couchGroup.add(seat);

    // Backrest
    const backrestGeometry = new THREE.BoxGeometry(couchWidth, backrestHeight, armrestWidth);
    const backrest = new THREE.Mesh(backrestGeometry, couchMaterial);
    backrest.position.set(0, seatHeight + backrestHeight / 2, -(couchDepth / 2) + (armrestWidth / 2));
    couchGroup.add(backrest);

    // Armrests
    const armrestGeometry = new THREE.BoxGeometry(armrestWidth, couchHeight, couchDepth);
    const armrestLeft = new THREE.Mesh(armrestGeometry, couchMaterial);
    armrestLeft.position.set(-(couchWidth / 2) + (armrestWidth / 2), couchHeight / 2, 0);
    couchGroup.add(armrestLeft);

    const armrestRight = new THREE.Mesh(armrestGeometry, couchMaterial);
    armrestRight.position.set((couchWidth / 2) - (armrestWidth / 2), couchHeight / 2, 0);
    couchGroup.add(armrestRight);

    couchGroup.position.set(0, 0, 0);
    scene.add(couchGroup);
    window.selectObject(couchGroup);
    document.getElementById('project-message').textContent = "Couch added. Double-click to edit material.";
};


/**
 * Applies the selected color from the color picker to the currently selected object.
 */
window.applyColorToSelected = function() {
    if (selectedObject) {
        const newColor = colorPickerElement.value;
        const color = new THREE.Color(newColor).getHex();

        // If X-Ray mode is active, update the original material's color
        let targetMaterial = selectedObject.material;
        if (originalMaterials.has(selectedObject.uuid)) {
            targetMaterial = originalMaterials.get(selectedObject.uuid);
        }

        if (selectedObject.userData.componentType === 'window' || selectedObject.userData.componentType === 'door') {
            // For groups, find the main mesh (glass/panel) and apply color
            selectedObject.traverse(child => {
                if (child instanceof THREE.Mesh && (child.material.transparent || child.userData.isPanel)) { // Target glass or main door panel
                    child.material.color.set(newColor);
                }
            });
            selectedObject.userData.material.color = color; // Update stored color
        } else if (targetMaterial) {
            targetMaterial.color.set(newColor);
            selectedObject.userData.material.color = color; // Update stored color
        }
        document.getElementById('project-message').textContent = `Color applied to ${selectedObject.userData.componentType || 'object'}.`;
    } else {
        document.getElementById('project-message').textContent = "No object selected to apply color.";
    }
};

/**
 * Applies the selected texture to the currently selected object.
 */
window.applyTextureToSelected = function() {
    if (selectedObject) {
        const textureName = textureSelectElement.value;
        let newMaterial;
        let currentOriginalMaterial = originalMaterials.has(selectedObject.uuid) ? originalMaterials.get(selectedObject.uuid) : selectedObject.material;

        // Ensure we have a material to work with, especially for groups like windows/doors
        // For windows/doors, we'll apply texture to the frame, and keep glass transparent
        if (selectedObject.userData.componentType === 'window' || selectedObject.userData.componentType === 'door') {
            selectedObject.traverse(child => {
                if (child instanceof THREE.Mesh && child.material && !child.material.transparent && !child.userData.isPanel) { // Target frame, not glass/panel
                    const frameColor = child.material.color.getHex();
                    if (textureName === 'none') {
                        newMaterial = new THREE.MeshStandardMaterial({ color: frameColor });
                    } else if (textures[textureName]) {
                        newMaterial = new THREE.MeshStandardMaterial({
                            map: textures[textureName],
                            color: frameColor
                        });
                    } else {
                        document.getElementById('project-message').textContent = "Texture not found.";
                        return;
                    }
                    child.material.dispose(); // Dispose old material
                    child.material = newMaterial;
                } else if (child instanceof THREE.Mesh && child.userData.isPanel) { // For door panel
                    const panelColor = child.material.color.getHex();
                    if (textureName === 'none') {
                        newMaterial = new THREE.MeshStandardMaterial({ color: panelColor });
                    } else if (textures[textureName]) {
                        newMaterial = new THREE.MeshStandardMaterial({
                            map: textures[textureName],
                            color: panelColor
                        });
                    } else {
                        document.getElementById('project-message').textContent = "Texture not found.";
                        return;
                    }
                    child.material.dispose(); // Dispose old material
                    child.material = newMaterial;
                }
            });
            selectedObject.userData.material.texture = textureName; // Update stored texture name for the group
        } else if (currentOriginalMaterial) { // For single meshes
            const currentColor = currentOriginalMaterial.color.getHex();
            if (textureName === 'none') {
                newMaterial = new THREE.MeshStandardMaterial({ color: currentColor });
            } else if (textures[textureName]) {
                newMaterial = new THREE.MeshStandardMaterial({
                    map: textures[textureName],
                    color: currentColor
                });
            } else {
                document.getElementById('project-message').textContent = "Texture not found.";
                return;
            }

            if (selectedObject.material && selectedObject.material !== currentOriginalMaterial) {
                selectedObject.material.dispose();
            }

            selectedObject.material = newMaterial;
            originalMaterials.set(selectedObject.uuid, newMaterial); // Update original material reference

            selectedObject.userData.material.texture = textureName;
            selectedObject.userData.material.color = newMaterial.color.getHex();

            if (isXRayMode) {
                applyXRayMaterial(selectedObject, true);
            }
        }
        document.getElementById('project-message').textContent = `Texture "${textureName}" applied to ${selectedObject.userData.componentType || 'object'}.`;
    } else {
        document.getElementById('project-message').textContent = "No object selected to apply texture.";
    }
};

/**
 * Applies a CSG cut (subtraction) to a base mesh using a cutter mesh.
 * This function replaces the base mesh in the scene with the new CSG result.
 * @param {THREE.Mesh} baseMesh - The mesh to be cut (e.g., a wall).
 * @param {THREE.Object3D} cutterObject - The object used to cut (e.g., a window group or door group).
 * @param {string} operationType - 'subtract', 'union', or 'intersect'.
 */
function applyCSGCut(baseMesh, cutterObject, operationType) {
    if (!baseMesh || !cutterObject) return;

    // Create a temporary mesh from the cutter's bounding box or a simple representation
    // For windows/doors, we need a simple box that represents the hole they cut.
    const cutterGeometry = new THREE.BoxGeometry(
        cutterObject.userData.width,
        cutterObject.userData.height,
        cutterObject.userData.depth
    );
    const cutterMesh = new THREE.Mesh(cutterGeometry);
    cutterMesh.position.copy(cutterObject.position);
    cutterMesh.rotation.copy(cutterObject.rotation);
    cutterMesh.scale.copy(cutterObject.scale);

    // Ensure the base mesh is a CSG-compatible mesh (BufferGeometry)
    // If it's already a CSG result, it will be a BufferGeometry.
    // If it's a primitive like a new wall, convert it.
    let csgBaseMesh = baseMesh;
    if (!(baseMesh.geometry instanceof THREE.BufferGeometry)) {
        const tempGeometry = new THREE.BufferGeometry().fromGeometry(baseMesh.geometry);
        csgBaseMesh = new THREE.Mesh(tempGeometry, baseMesh.material);
        csgBaseMesh.position.copy(baseMesh.position);
        csgBaseMesh.rotation.copy(baseMesh.rotation);
        csgBaseMesh.scale.copy(baseMesh.scale);
        csgBaseMesh.uuid = baseMesh.uuid; // Keep original UUID
        csgBaseMesh.userData = { ...baseMesh.userData }; // Copy user data
    }


    const csg = new CSG();
    let newResultMesh;

    try {
        if (operationType === 'subtract') {
            csg.subtract(csgBaseMesh, cutterMesh);
        } else if (operationType === 'union') {
            csg.union(csgBaseMesh, cutterMesh);
        } else if (operationType === 'intersect') {
            csg.intersect(csgBaseMesh, cutterMesh);
        }
        newResultMesh = csg.toMesh();
    } catch (e) {
        console.error("CSG operation failed:", e);
        document.getElementById('project-message').textContent = "CSG operation failed. Invalid geometry or operation.";
        return;
    }

    // Transfer original material and user data to the new mesh
    newResultMesh.material = baseMesh.material; // Keep the original material
    newResultMesh.userData = { ...baseMesh.userData };
    newResultMesh.position.copy(baseMesh.position);
    newResultMesh.rotation.copy(baseMesh.rotation);
    newResultMesh.scale.copy(baseMesh.scale);
    newResultMesh.uuid = baseMesh.uuid; // Maintain UUID for selection/saving

    // Remove old base mesh and add new one
    scene.remove(baseMesh);
    if (baseMesh.geometry) baseMesh.geometry.dispose();
    if (baseMesh.material) {
        if (Array.isArray(baseMesh.material)) {
            baseMesh.material.forEach(m => m.dispose());
        } else {
            baseMesh.material.dispose();
        }
    }
    scene.add(newResultMesh);

    // Update the reference in selectedObject if it was the baseMesh
    if (selectedObject === baseMesh) {
        selectedObject = newResultMesh;
        // Update selection outline to new mesh
        if (selectionOutline) {
            scene.remove(selectionOutline);
            selectionOutline = new THREE.BoxHelper(selectedObject, SELECTION_COLOR);
            scene.add(selectionOutline);
        }
    }

    // Store the CSG operation in the cutter's userData for saving/loading
    const operation = {
        type: operationType,
        targetId: baseMesh.uuid, // The ID of the wall being cut
        cutterId: cutterObject.uuid, // The ID of the window/door doing the cutting
        cutterPosition: { x: cutterObject.position.x, y: cutterObject.position.y, z: cutterObject.position.z },
        cutterRotation: { x: cutterObject.rotation.x, y: cutterObject.rotation.y, z: cutterObject.rotation.z },
        cutterScale: { x: cutterObject.scale.x, y: cutterObject.scale.y, z: cutterObject.scale.z },
        cutterGeometry: { width: cutterObject.userData.width, height: cutterObject.userData.height, depth: cutterObject.userData.depth }
    };
    // Ensure csgOperations array exists on the cutter
    if (!cutterObject.userData.csgOperations) {
        cutterObject.userData.csgOperations = [];
    }
    // Add or update the operation for this specific target wall
    const existingOpIndex = cutterObject.userData.csgOperations.findIndex(op => op.targetId === baseMesh.uuid);
    if (existingOpIndex > -1) {
        cutterObject.userData.csgOperations[existingOpIndex] = operation;
    } else {
        cutterObject.userData.csgOperations.push(operation);
    }
}

/**
 * Adds the current camera position and target to the tour points.
 */
window.addTourPoint = function() {
    tourPoints.push({
        position: camera.position.clone(),
        target: cameraTarget.clone() // Or camera.getWorldDirection for walk mode
    });
    renderTourPointsList();
    document.getElementById('model-status').textContent = `Tour point ${tourPoints.length} added.`;
};

/**
 * Renders the list of tour points in the UI.
 */
function renderTourPointsList() {
    const tourPointsUl = document.getElementById('tour-points-ul');
    tourPointsUl.innerHTML = '';
    if (tourPoints.length === 0) {
        tourPointsUl.innerHTML = '<li>No tour points added yet.</li>';
        return;
    }
    tourPoints.forEach((point, index) => {
        const li = document.createElement('li');
        li.textContent = `Point ${index + 1}: Pos(${point.position.x.toFixed(1)}, ${point.position.y.toFixed(1)}, ${point.position.z.toFixed(1)})`;
        tourPointsUl.appendChild(li);
    });
}

/**
 * Clears all stored tour points.
 */
window.clearTourPoints = function() {
    tourPoints = [];
    renderTourPointsList();
    document.getElementById('model-status').textContent = "All tour points cleared.";
};

/**
 * Starts the virtual tour animation.
 */
window.startTour = function() {
    if (tourPoints.length < 2) {
        document.getElementById('project-message').textContent = "Need at least 2 tour points to start a tour.";
        return;
    }
    if (isTourActive) return; // Already touring

    isTourActive = true;
    currentTourPointIndex = 0;
    document.getElementById('model-status').textContent = "Tour started.";
    window.stopTour(); // Ensure any previous animation is stopped
    animateTour();
};

/**
 * Stops the virtual tour animation.
 */
window.stopTour = function() {
    isTourActive = false;
    if (tourAnimationId) {
        cancelAnimationFrame(tourAnimationId);
        tourAnimationId = null;
    }
    document.getElementById('model-status').textContent = "Tour stopped.";
};

/**
 * Animates the camera along the defined tour path.
 */
function animateTour() {
    if (!isTourActive || tourPoints.length < 2) {
        window.stopTour();
        return;
    }

    const startPoint = tourPoints[currentTourPointIndex];
    const endPoint = tourPoints[(currentTourPointIndex + 1) % tourPoints.length]; // Loop back to start

    const startTime = performance.now();

    function moveCamera() {
        const elapsed = performance.now() - startTime;
        let progress = elapsed / TOUR_TRANSITION_DURATION;

        if (progress > 1) {
            progress = 1;
        }

        // Interpolate position
        camera.position.lerpVectors(startPoint.position, endPoint.position, progress);

        // Interpolate look-at target
        cameraTarget.lerpVectors(startPoint.target, endPoint.target, progress);
        camera.lookAt(cameraTarget);

        if (progress < 1) {
            tourAnimationId = requestAnimationFrame(moveCamera);
        } else {
            currentTourPointIndex = (currentTourPointIndex + 1) % tourPoints.length;
            animateTour(); // Move to the next segment
        }
    }
    tourAnimationId = requestAnimationFrame(moveCamera);
}


/**
 * The main animation loop.
 * Renders the scene and updates first-person camera movement.
 */
window.animate = function() {
    requestAnimationFrame(window.animate);

    // Apply object movement if an object is selected and not in walk mode or drawing/offsetting or tour active
    if (selectedObject && !isWalkMode && !isDrawing && !isOffsetMode && !isTourActive) {
        if (objectMoveForward) selectedObject.position.z -= OBJECT_MOVE_SPEED;
        if (objectMoveBackward) selectedObject.position.z += OBJECT_MOVE_SPEED;
        if (objectMoveLeft) selectedObject.position.x -= OBJECT_MOVE_SPEED;
        if (objectMoveRight) selectedObject.position.x += OBJECT_MOVE_SPEED;
        if (objectMoveUp) selectedObject.position.y += OBJECT_MOVE_SPEED;
        if (objectMoveDown) selectedObject.position.y -= OBJECT_MOVE_SPEED;

        if (objectRotateLeft) selectedObject.rotation.y += OBJECT_ROTATION_SPEED;
        if (objectRotateRight) selectedObject.rotation.y -= OBJECT_ROTATION_SPEED;

        updateSelectedObjectPropertiesUI();
    }

    if (isWalkMode) {
        const direction = new THREE.Vector3();
        const cameraRight = new THREE.Vector3();
        camera.getWorldDirection(direction);
        camera.getWorldDirection(cameraRight);
        cameraRight.crossVectors(camera.up, direction);

        if (moveForward) camera.position.addScaledVector(direction, cameraSpeed);
        if (moveBackward) camera.position.addScaledVector(direction, -cameraSpeed);
        if (moveLeft) camera.position.addScaledVector(cameraRight, -cameraSpeed);
        if (moveRight) camera.position.addScaledVector(cameraRight, cameraSpeed);

        if (camera.position.y < CAMERA_HEIGHT) {
            camera.position.y = CAMERA_HEIGHT;
        }
    }

    // Update selection outline position/rotation to match selected object
    if (selectedObject && selectionOutline) {
        selectionOutline.update();
    }

    if (renderer && scene && camera) {
        renderer.render(scene, camera);
    }
};
