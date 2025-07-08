// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, signInWithCustomToken, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, collection, query, where, addDoc, getDocs, deleteDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
// Also include Three.js core and GLTFLoader as it's a Three.js extension
import "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js";
import "https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js";


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

    // Serialize current scene components
    const components = [];
    scene.traverse(object => {
        if (object.userData && object.userData.isCustomComponent) {
            let materialColor = null;

            // Determine the correct color to save
            if (object.userData.componentType === 'window') {
                // For window groups, the color is stored in userData.material
                materialColor = object.userData.material ? object.userData.material.color : null;
            } else if (object.material) {
                // For other meshes, check if original material exists (if X-Ray was active)
                const currentMaterial = originalMaterials.has(object.uuid) ? originalMaterials.get(object.uuid) : object.material;
                if (currentMaterial && currentMaterial.color) {
                    materialColor = currentMaterial.color.getHex();
                }
            }

            components.push({
                id: object.uuid, // Use Three.js UUID for unique identification
                type: object.userData.componentType,
                geometry: {
                    width: object.userData.width,
                    height: object.userData.height,
                    depth: object.userData.depth
                },
                position: { x: object.position.x, y: object.position.y, z: object.position.z },
                rotation: { x: object.rotation.x, y: object.rotation.y, z: object.rotation.z },
                scale: { x: object.scale.x, y: object.scale.y, z: object.scale.z },
                material: { color: materialColor } // Store material color
            });
        }
    });

    try {
        const projectsCollectionRef = collection(window.db, `artifacts/${appId}/users/${window.userId}/projects`);
        await addDoc(projectsCollectionRef, {
            projectName: projectName,
            sceneData: JSON.stringify(components),
            createdAt: serverTimestamp(),
            lastModifiedAt: serverTimestamp(),
            isXRayMode: isXRayMode // Save the X-Ray mode state
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
            const components = JSON.parse(projectData.sceneData); // Parse the stored JSON string (now only components)
            const savedIsXRayMode = projectData.isXRayMode || false; // Get saved X-Ray mode state

            // Clear existing custom components from the scene
            window.clearCustomComponents();

            // Reconstruct the scene from saved components
            if (components && components.length > 0) {
                components.forEach(compData => {
                    let geometry;
                    let material;
                    let mesh;

                    // Recreate material color
                    const loadedColor = compData.material && compData.material.color !== undefined ? compData.material.color : DEFAULT_MATERIAL_COLOR;

                    // Recreate geometry based on type and dimensions
                    if (compData.type === 'wall' || compData.type === 'floor' || compData.type === 'cube' || compData.type === 'roof') {
                        geometry = new THREE.BoxGeometry(compData.geometry.width, compData.geometry.height, compData.geometry.depth);
                        material = new THREE.MeshStandardMaterial({ color: loadedColor });
                        mesh = new THREE.Mesh(geometry, material);
                    } else if (compData.type === 'window') {
                        const width = compData.geometry.width;
                        const height = compData.geometry.height;
                        const depth = compData.geometry.depth;
                        const frameThickness = 0.1;
                        const glassThickness = 0.01;

                        const windowGroup = new THREE.Group();
                        windowGroup.userData.isCustomComponent = true;
                        windowGroup.userData.componentType = compData.type;
                        windowGroup.userData.width = width;
                        windowGroup.userData.height = height;
                        windowGroup.userData.depth = depth;

                        // Glass pane
                        const glassGeometry = new THREE.BoxGeometry(width - frameThickness * 2, height - frameThickness * 2, glassThickness);
                        const glassMaterial = new THREE.MeshStandardMaterial({
                            color: loadedColor, // Use loaded color for glass
                            transparent: true,
                            opacity: 0.5,
                            roughness: 0.1,
                            metalness: 0.1
                        });
                        const glassMesh = new THREE.Mesh(glassGeometry, glassMaterial);
                        glassMesh.position.z = 0;
                        windowGroup.add(glassMesh);

                        // Frame parts (4 pieces)
                        const frameMaterial = new THREE.MeshStandardMaterial({ color: 0x8B4513 }); // Brown for wood frame
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

                        mesh = windowGroup;
                        mesh.userData.material = { color: loadedColor }; // Store the color on the group's userData
                    }
                    else {
                        console.warn(`Unknown component type: ${compData.type}`);
                        return; // Skip unknown types
                    }

                    // Apply transformations
                    mesh.position.set(compData.position.x, compData.position.y, compData.position.z);
                    mesh.rotation.set(compData.rotation.x, compData.rotation.y, compData.rotation.z);
                    mesh.scale.set(compData.scale.x, compData.scale.y, compData.scale.z);

                    scene.add(mesh);
                });
            }

            // Apply X-Ray mode if it was saved as active
            if (savedIsXRayMode && !isXRayMode) { // Only toggle if current mode is different
                window.toggleXRayMode();
            } else if (!savedIsXRayMode && isXRayMode) { // If it was off but currently on, turn off
                window.toggleXRayMode();
            }


            document.getElementById('model-status').textContent = `Loaded: ${projectData.projectName}`;
            window.loadingOverlay.style.display = 'none';
            document.getElementById('project-message').textContent = `Project "${projectData.projectName}" loaded successfully!`;
            console.log("Project loaded:", projectData.projectName);

            // Clear any selection after loading a new project
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
let isDraggingCamera = false; // Renamed from isDragging to avoid conflict with object dragging
let previousMouseX = 0;
let previousMouseY = 0;
let rotationSpeed = 0.005;
let zoomSpeed = 0.1;

// UI Elements
const modelStatusElement = document.getElementById('model-status');
const loadingOverlay = document.getElementById('loading-overlay');

// --- Phase 3: Measurement & Navigation Variables ---
let isWalkMode = false;
let isMeasuring = false;
let selectedMeasurementPoints = []; // Stores THREE.Vector3 points
let measurementSpheres = []; // Stores the visual spheres for measurement points
const MEASUREMENT_SPHERE_RADIUS = 0.2;
const MEASUREMENT_LINE_COLOR = 0x00ff00; // Green

// First-person movement variables
let moveForward = false;
let moveBackward = false;
let moveLeft = false;
let moveRight = false;
let cameraSpeed = 0.5; // Speed of camera movement in walk mode
const CAMERA_HEIGHT = 1.6; // Approximate human eye height for walk mode

// Raycaster for interaction
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

// --- Phase 4: Building Tools & Selection Variables ---
let selectedObject = null; // Currently selected THREE.Mesh object
let selectionOutline = null; // Helper for visual selection
const SELECTION_COLOR = 0xffff00; // Yellow for selection highlight
const DEFAULT_MATERIAL_COLOR = 0x888888; // Default color for new objects
let isXRayMode = false; // New variable for X-Ray mode

// Store original materials for X-Ray toggle
const originalMaterials = new Map();


// UI elements for selected object properties
let propTypeElement;
let propPositionElement;
let propRotationElement;
let propScaleElement;
let colorPickerElement;

// Input elements for dimensions
let dimWidthInput;
let dimHeightInput;
let dimDepthInput;


// --- Phase 5: Enhanced Navigation, Building, and Visuals Variables ---
let objectMoveForward = false;
let objectMoveBackward = false;
let objectMoveLeft = false;
let objectMoveRight = false;
let objectMoveUp = false;
let objectMoveDown = false;
const OBJECT_MOVE_SPEED = 0.5; // Speed for moving selected objects
let objectRotateLeft = false;
let objectRotateRight = false;
const OBJECT_ROTATION_SPEED = Math.PI / 32; // Rotation speed in radians (e.g., 5.625 degrees per step)

// --- Phase 7: Drawing Mode Variables ---
let isDrawing = false;
let drawingType = ''; // 'wall' or 'floor'
let drawingStartPoint = new THREE.Vector3();
let currentDrawingLine = null; // The temporary dotted line
const DRAWING_LINE_COLOR = 0x00ffff; // Cyan for drawing preview
const DRAWING_LINE_DASH_SIZE = 0.5;
const DRAWING_LINE_GAP_SIZE = 0.2;

let isDraggingObject = false; // New flag for dragging objects
let dragOffset = new THREE.Vector3(); // Offset from object center to click point
let dragPlane = new THREE.Plane(); // Plane for dragging (parallel to ground)

// --- New: Offset Drawing Variables ---
let isOffsetMode = false;
let offsetReferenceObject = null; // The floor/wall being offset from
let offsetStartPoint = new THREE.Vector3();
let currentOffsetLine = null; // The temporary dotted line for offset


/**
 * Sets up the Three.js scene, camera, and renderer.
 * This function is now called AFTER Firebase authentication is ready.
 */
window.setupScene = function() {
    // Only setup scene once
    if (scene) return;

    // Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a202c); // Dark background matching body

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
    camera.position.set(0, 10, 20); // Initial camera position for an empty scene
    camera.lookAt(0, 0, 0);

    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0x404040); // Soft white light
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(1, 1, 1).normalize();
    scene.add(directionalLight);

    // Add a second directional light for better overall illumination
    const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.5);
    directionalLight2.position.set(-1, -1, -1).normalize();
    scene.add(directionalLight2);


    // Ground Plane
    const planeGeometry = new THREE.PlaneGeometry(100, 100);
    const planeMaterial = new THREE.MeshStandardMaterial({
        color: 0x334155, // A darker, muted blue-grey
        roughness: 0.7,
        metalness: 0.1,
        side: THREE.DoubleSide
    });
    const plane = new THREE.Mesh(planeGeometry, planeMaterial);
    plane.rotation.x = Math.PI / 2; // Rotate to be horizontal
    plane.position.y = -0.01; // Slightly below 0
    plane.name = 'groundPlane'; // Give it a name for raycasting
    scene.add(plane);

    // Add AxesHelper
    const axesHelper = new THREE.AxesHelper(10); // Size of the axes
    scene.add(axesHelper);


    // Event Listeners for camera controls
    renderer.domElement.addEventListener('mousedown', onMouseDown);
    renderer.domElement.addEventListener('mouseup', onMouseUp);
    renderer.domElement.addEventListener('mousemove', onMouseMove);
    renderer.domElement.addEventListener('wheel', onMouseWheel);
    window.addEventListener('resize', onWindowResize);

    // Event Listeners for Walk Mode (Keyboard) and Object Movement
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    // Event listener for interaction (selection, measurement, drawing, dragging)
    renderer.domElement.addEventListener('click', onCanvasClick);
    renderer.domElement.addEventListener('dblclick', onCanvasDblClick); // New: Double click for material edit
    renderer.domElement.addEventListener('mousemove', onCanvasMouseMove); // For drawing/dragging previews
    renderer.domElement.addEventListener('mouseup', onCanvasMouseUp); // For ending drawing/dragging


    // Get UI elements for measurement
    window.measurementDistanceElement = document.getElementById('measurement-distance');
    window.measurementMidpointElement = document.getElementById('measurement-midpoint');

    // Get UI elements for selected object properties
    propTypeElement = document.getElementById('prop-type');
    propPositionElement = document.getElementById('prop-position');
    propRotationElement = document.getElementById('prop-rotation');
    propScaleElement = document.getElementById('prop-scale');
    colorPickerElement = document.getElementById('color-picker');

    // Get input elements for dimensions
    dimWidthInput = document.getElementById('dim-width');
    dimHeightInput = document.getElementById('dim-height');
    dimDepthInput = document.getElementById('dim-depth');
};

/**
 * Clears all custom components from the scene.
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
        if (object.geometry) object.geometry.dispose();
        if (object.material) {
            if (Array.isArray(object.material)) {
                object.material.forEach(m => m.dispose());
            } else {
                object.material.dispose();
            }
        }
    });
    window.deselectObject(); // Deselect any active selection
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
    if (isWalkMode) return; // No orbit dragging in walk mode

    // Check if we're clicking on a selectable object to start dragging
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);

    const intersects = raycaster.intersectObjects(scene.children, true); // Intersect with all children

    if (intersects.length > 0) {
        const clickedObject = intersects[0].object;
        let actualSelectedObject = clickedObject;

        // If the clicked object is part of a group (like a window), select the group
        if (clickedObject.parent && clickedObject.parent.userData && clickedObject.parent.userData.isCustomComponent) {
            actualSelectedObject = clickedObject.parent;
        }

        if (actualSelectedObject.userData && actualSelectedObject.userData.isCustomComponent) {
            window.selectObject(actualSelectedObject); // Select the object
            isDraggingObject = true;
            // Calculate offset from object center to click point
            dragOffset.subVectors(intersects[0].point, actualSelectedObject.position);
            // Set up a plane for consistent dragging
            dragPlane.setFromNormalAndCoplanarPoint(camera.getWorldDirection(dragPlane.normal).negate(), intersects[0].point);
            renderer.domElement.style.cursor = 'grabbing';
            return; // Don't start camera drag if object drag is initiated
        }
    }

    // If no object drag, start camera drag
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
 * Handles mouse move event for camera rotation (Orbit Mode) or object dragging.
 * @param {MouseEvent} event - The mouse event.
 */
function onMouseMove(event) {
    if (isWalkMode) {
        // First-person look controls
        const movementX = event.movementX || event.mozMovementX || event.webkitMovementX || 0;
        const movementY = event.movementY || event.mozMovementY || event.webkitMovementY || 0;

        // Rotate camera's yaw (around Y-axis)
        camera.rotation.y -= movementX * rotationSpeed;

        // Rotate camera's pitch (around local X-axis)
        camera.rotation.x -= movementY * rotationSpeed;
        camera.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, camera.rotation.x)); // Clamp pitch
    } else if (isDraggingCamera) {
        // Orbit controls
        const deltaX = event.clientX - previousMouseX;
        const deltaY = event.clientY - previousMouseY;

        // Rotate around the cameraTarget
        const cameraVector = new THREE.Vector3().subVectors(camera.position, cameraTarget);

        // Rotate horizontally (around Y-axis)
        const horizontalAngle = -deltaX * rotationSpeed;
        const horizontalQuaternion = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), horizontalAngle);
        cameraVector.applyQuaternion(horizontalQuaternion);

        // Rotate vertically (around camera's local X-axis)
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
    if (!isWalkMode) { // Only zoom if not in walk mode
        event.preventDefault(); // Prevent page scrolling
        const zoomAmount = event.deltaY * zoomSpeed;
        camera.position.addScaledVector(camera.position.clone().normalize(), zoomAmount);
        // Ensure camera doesn't go too close or too far
        const minDistance = 5; // Example minimum distance
        const maxDistance = 200; // Example maximum distance
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
    } else if (selectedObject) { // Object movement when an object is selected and not in walk mode
        switch (event.code) {
            case 'ArrowUp': objectMoveForward = true; break;
            case 'ArrowDown': objectMoveBackward = true; break;
            case 'ArrowLeft':
                if (event.shiftKey) { objectRotateLeft = true; } // Shift + Left Arrow for rotation
                else { objectMoveLeft = true; } // Left Arrow for movement
                break;
            case 'ArrowRight':
                if (event.shiftKey) { objectRotateRight = true; } // Shift + Right Arrow for rotation
                else { objectMoveRight = true; } // Right Arrow for movement
                break;
            case 'BracketRight': objectMoveUp = true; break; // ']' key
            case 'BracketLeft': objectMoveDown = true; break; // '[' key
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
        // Display rotation in degrees for user-friendliness
        propRotationElement.textContent = `X: ${(selectedObject.rotation.x * 180 / Math.PI).toFixed(1)}°, Y: ${(selectedObject.rotation.y * 180 / Math.PI).toFixed(1)}°, Z: ${(selectedObject.rotation.z * 180 / Math.PI).toFixed(1)}°`;
        propScaleElement.textContent = `X: ${selectedObject.scale.x.toFixed(2)}, Y: ${selectedObject.scale.y.toFixed(2)}, Z: ${selectedObject.scale.z.toFixed(2)}`;
        // Ensure color picker reflects the current color
        if (selectedObject.material && selectedObject.material.color) {
            colorPickerElement.value = `#${selectedObject.material.color.getHexString()}`;
        } else if (selectedObject.userData.material && selectedObject.userData.material.color !== undefined) {
            // For groups like windows, use the stored color
            colorPickerElement.value = `#${new THREE.Color(selectedObject.userData.material.color).getHexString()}`;
        }
    } else {
        propTypeElement.textContent = 'N/A';
        propPositionElement.textContent = 'N/A';
        propRotationElement.textContent = 'N/A';
        propScaleElement.textContent = 'N/A';
        colorPickerElement.value = '#9f7aea'; // Reset to default color
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
        // Attempt to request pointer lock
        renderer.domElement.requestPointerLock = renderer.domElement.requestPointerLock ||
                                                 renderer.domElement.mozRequestPointerLock ||
                                                 renderer.domElement.webkitRequestPointerLock;
        if (renderer.domElement.requestPointerLock) {
            renderer.domElement.requestPointerLock();
        }

        // Set camera to a "human eye" height and look horizontally
        camera.position.y = CAMERA_HEIGHT;
        camera.rotation.x = 0; // Reset pitch
        camera.lookAt(camera.position.x, CAMERA_HEIGHT, camera.position.z - 1); // Look forward
    } else {
        toggleBtn.textContent = "Toggle Walk Mode";
        // Exit pointer lock
        document.exitPointerLock = document.exitPointerLock ||
                                   document.mozExitPointerLock ||
                                   document.webkitExitPointerLock;
        if (document.exitPointerLock) {
            document.exitPointerLock();
        }
        // Reset camera to orbit view (re-center on a reasonable point if no model)
        if (selectedObject) { // If an object is selected, orbit around it
            cameraTarget.copy(selectedObject.position);
            camera.position.set(selectedObject.position.x + 10, selectedObject.position.y + 10, selectedObject.position.z + 20);
        } else { // Default orbit position
            cameraTarget.set(0,0,0);
            camera.position.set(0, 10, 20);
        }
        camera.lookAt(cameraTarget);
    }
    // Disable measurement mode if entering walk mode
    if (isWalkMode && isMeasuring) {
        window.toggleMeasurementMode();
    }
    // Disable drawing mode if entering walk mode
    if (isWalkMode && isDrawing) {
        window.cancelDrawing();
    }
    // Disable offset mode if entering walk mode
    if (isWalkMode && isOffsetMode) {
        window.cancelOffsetDrawing();
    }
    // Deselect any object when changing modes
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
        // Clear any existing measurements when entering mode
        window.clearMeasurements();
    } else {
        measureBtn.textContent = "Measure Distance";
        window.clearMeasurements(); // Clear measurements when exiting
    }
    // Disable walk mode if entering measurement mode
    if (isMeasuring && isWalkMode) {
        window.toggleWalkMode();
    }
    // Disable drawing mode if entering measurement mode
    if (isMeasuring && isDrawing) {
        window.cancelDrawing();
    }
    // Disable offset mode if entering measurement mode
    if (isMeasuring && isOffsetMode) {
        window.cancelOffsetDrawing();
    }
    // Deselect any object when changing modes
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
            // Handle groups (like windows)
            if (object instanceof THREE.Group) {
                object.traverse(child => {
                    if (child instanceof THREE.Mesh && child.material) {
                        if (isXRayMode) {
                            if (!originalMaterials.has(child.uuid)) {
                                originalMaterials.set(child.uuid, child.material);
                            }
                            child.material = new THREE.MeshBasicMaterial({
                                color: child.material.color,
                                transparent: true,
                                opacity: 0.2,
                                wireframe: true
                            });
                        } else {
                            if (originalMaterials.has(child.uuid)) {
                                child.material = originalMaterials.get(child.uuid);
                                originalMaterials.delete(child.uuid);
                            }
                        }
                    }
                });
            } else if (object instanceof THREE.Mesh && object.material) { // Handle single meshes
                if (isXRayMode) {
                    if (!originalMaterials.has(object.uuid)) {
                        originalMaterials.set(object.uuid, object.material);
                    }
                    object.material = new THREE.MeshBasicMaterial({
                        color: object.material.color,
                        transparent: true,
                        opacity: 0.2,
                        wireframe: true
                    });
                } else {
                    if (originalMaterials.has(object.uuid)) {
                        object.material = originalMaterials.get(object.uuid);
                        originalMaterials.delete(object.uuid);
                    }
                }
            }
        }
    });

    xrayBtn.textContent = isXRayMode ? "Exit X-Ray View" : "Toggle X-Ray View";
    document.getElementById('model-status').textContent = isXRayMode ? "X-Ray View ON" : "X-Ray View OFF";
};


/**
 * Clears all visual measurement points and resets display.
 */
window.clearMeasurements = function() {
    selectedMeasurementPoints.forEach(p => scene.remove(p));
    selectedMeasurementPoints = [];
    measurementSpheres.forEach(s => scene.remove(s));
    measurementSpheres = [];
    // Remove any measurement lines
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
 * Handles clicks on the canvas for measurement or selection.
 * @param {MouseEvent} event - The mouse event.
 */
function onCanvasClick(event) {
    // If dragging for orbit controls or object dragging, don't trigger selection/measurement click
    if (isDraggingCamera || isDraggingObject) return;

    // Calculate mouse position in normalized device coordinates (-1 to +1)
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    // Update the raycaster with the camera and mouse position
    raycaster.setFromCamera(mouse, camera);

    // Intersect only with custom components and the ground plane
    const interactableObjects = [];
    scene.traverse(object => {
        if (object.userData && object.userData.isCustomComponent) {
            interactableObjects.push(object);
        }
        // Also include the ground plane for measurement clicks/drawing
        if (object.name === 'groundPlane') {
            interactableObjects.push(object);
        }
    });

    const intersects = raycaster.intersectObjects(interactableObjects, true);

    if (isDrawing) {
        if (intersects.length > 0) {
            const intersectionPoint = intersects[0].point;
            // For drawing, the first click sets the start point
            drawingStartPoint.copy(intersectionPoint);
            document.getElementById('model-status').textContent = `Drawing ${drawingType}: Click and drag to define dimensions.`;
        } else {
            document.getElementById('project-message').textContent = "Click on the ground plane to start drawing.";
            window.cancelDrawing(); // Cancel if clicked elsewhere
        }
    } else if (isOffsetMode) {
        if (intersects.length > 0 && intersects[0].object === offsetReferenceObject) {
            const intersectionPoint = intersects[0].point;
            offsetStartPoint.copy(intersectionPoint);
            document.getElementById('model-status').textContent = `Offsetting ${offsetReferenceObject.userData.componentType}: Click and drag to define inner area.`;
        } else {
            document.getElementById('project-message').textContent = "Click on the selected floor/wall to start offsetting.";
            window.cancelOffsetDrawing();
        }
    }
    else if (isMeasuring) {
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
                selectedMeasurementPoints.push(intersectionPoint); // Start new measurement with current click
                scene.add(sphere);
                measurementSpheres.push(sphere);
            }
        }
    } else { // Selection mode
        if (intersects.length > 0) {
            const clickedObject = intersects[0].object;
            let actualSelectedObject = clickedObject;

            // If the clicked object is part of a group (like a window), select the group
            if (clickedObject.parent && clickedObject.parent.userData && clickedObject.parent.userData.isCustomComponent) {
                actualSelectedObject = clickedObject.parent;
            }

            // Ensure we only select our custom components, not the ground plane or lights
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
            // Programmatically open the color picker or show a material editing modal
            colorPickerElement.click(); // Simulate a click to open the color picker
            document.getElementById('model-status').textContent = `Editing material for ${actualSelectedObject.userData.componentType}.`;
        }
    }
}

/**
 * Handles mouse move event for drawing preview or object dragging.
 * @param {MouseEvent} event - The mouse event.
 */
function onCanvasMouseMove(event) {
    // Update mouse coordinates
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
    }
    else if (isDraggingObject && selectedObject) {
        const intersects = raycaster.intersectObject(scene.getObjectByName('groundPlane')); // Dragging on ground plane
        if (intersects.length > 0) {
            const newPosition = intersects[0].point.clone().sub(dragOffset);
            // Keep object at its original Y-level relative to its base
            selectedObject.position.x = newPosition.x;
            selectedObject.position.z = newPosition.z;
            // Update UI
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
    }
    else if (isDraggingObject) {
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
    if (selectedObject === object) return; // Already selected

    window.deselectObject(); // Deselect previous object

    selectedObject = object;

    // Add a visual highlight (e.g., outline or change material color temporarily)
    // For simplicity, let's add a wireframe helper
    selectionOutline = new THREE.BoxHelper(selectedObject, SELECTION_COLOR);
    scene.add(selectionOutline);

    updateSelectedObjectPropertiesUI(); // Update UI after selection
};

/**
 * Deselects the current 3D object and clears the UI.
 */
window.deselectObject = function() {
    if (selectedObject) {
        // Remove highlight
        if (selectionOutline) {
            scene.remove(selectionOutline);
            selectionOutline = null;
        }
        selectedObject = null;
    }
    updateSelectedObjectPropertiesUI(); // Clear UI after deselection
};

/**
 * Deletes the currently selected object from the scene.
 */
window.deleteSelectedObject = function() {
    if (selectedObject) {
        window.showConfirmModal("Are you sure you want to delete the selected object?", () => {
            scene.remove(selectedObject);
            // Dispose of geometry and material if it's a mesh
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
                // If it's a group (like window), dispose children's resources
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
            window.deselectObject(); // Clear selection after deletion
            console.log("Object deleted.");
        });
    } else {
        document.getElementById('project-message').textContent = "No object selected to delete.";
    }
};

/**
 * Initiates the drawing mode for walls or floors.
 * @param {string} type - 'wall' or 'floor'.
 */
window.startDrawing = function(type) {
    isDrawing = true;
    drawingType = type;
    document.getElementById('model-status').textContent = `Drawing ${type}: Click on the ground plane to set start point.`;
    window.deselectObject(); // Deselect any object when starting to draw
    window.clearMeasurements(); // Clear measurements if active
    window.cancelOffsetDrawing(); // Cancel offset mode
};

/**
 * Updates the temporary drawing line as the user drags.
 * @param {THREE.Vector3} currentPoint - The current intersection point on the ground.
 */
window.updateDrawing = function(currentPoint) {
    if (!isDrawing || !drawingStartPoint) return;

    // Remove previous drawing line
    if (currentDrawingLine) {
        scene.remove(currentDrawingLine);
        currentDrawingLine.geometry.dispose();
        currentDrawingLine.material.dispose();
    }

    const points = [];
    points.push(drawingStartPoint.clone());
    points.push(new THREE.Vector3(currentPoint.x, drawingStartPoint.y, drawingStartPoint.z));
    points.push(currentPoint.clone());
    points.push(new THREE.Vector3(drawingStartPoint.x, drawingStartPoint.y, currentPoint.z)); // This is for 2D rectangle on XZ plane

    // For a rectangle, we need 5 points to close the loop (start, x-end, end, z-end, start)
    const p1 = drawingStartPoint;
    const p2 = new THREE.Vector3(currentPoint.x, p1.y, p1.z);
    const p3 = currentPoint;
    const p4 = new THREE.Vector3(p1.x, p1.y, currentPoint.z);

    const rectPoints = [p1, p2, p3, p4, p1]; // Close the rectangle

    const geometry = new THREE.BufferGeometry().setFromPoints(rectPoints);
    const material = new THREE.LineDashedMaterial({
        color: DRAWING_LINE_COLOR,
        dashSize: DRAWING_LINE_DASH_SIZE,
        gapSize: DRAWING_LINE_GAP_SIZE
    });
    currentDrawingLine = new THREE.Line(geometry, material);
    currentDrawingLine.computeLineDistances(); // Required for dashed lines
    scene.add(currentDrawingLine);

    // Update dimensions in UI
    const width = Math.abs(currentPoint.x - drawingStartPoint.x);
    const depth = Math.abs(currentPoint.z - drawingStartPoint.z);
    dimWidthInput.value = width.toFixed(2);
    dimDepthInput.value = depth.toFixed(2);
    // Height is fixed for walls/floors during drawing, but can be adjusted after
    if (drawingType === 'wall') {
        dimHeightInput.value = 3; // Default wall height
    } else if (drawingType === 'floor') {
        dimHeightInput.value = 0.1; // Default floor thickness
    }
};

/**
 * Finalizes the drawing and creates the component.
 * @param {THREE.Vector3} endPoint - The end point of the drawing.
 */
window.endDrawing = function(endPoint) {
    if (!isDrawing) return;

    // Remove temporary drawing line
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

    const height = parseFloat(dimHeightInput.value); // Get height from input

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
    // For windows and roofs, we'll keep the direct add functions, as drawing them is more complex

    if (newObject) {
        scene.add(newObject);
        window.selectObject(newObject);
        document.getElementById('model-status').textContent = `${drawingType.charAt(0).toUpperCase() + drawingType.slice(1)} created.`;
    }

    isDrawing = false;
    drawingType = '';
    drawingStartPoint = new THREE.Vector3(); // Reset start point
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


// Helper functions for creating meshes with user data
function createWallMesh(width, height, depth) {
    const geometry = new THREE.BoxGeometry(width, height, depth);
    const material = new THREE.MeshStandardMaterial({ color: DEFAULT_MATERIAL_COLOR });
    const wall = new THREE.Mesh(geometry, material);
    wall.userData.isCustomComponent = true;
    wall.userData.componentType = 'wall';
    wall.userData.width = width;
    wall.userData.height = height;
    wall.userData.depth = depth;
    return wall;
}

function createFloorMesh(width, height, depth) {
    const geometry = new THREE.BoxGeometry(width, height, depth);
    const material = new THREE.MeshStandardMaterial({ color: DEFAULT_MATERIAL_COLOR });
    const floor = new THREE.Mesh(geometry, material);
    floor.userData.isCustomComponent = true;
    floor.userData.componentType = 'floor';
    floor.userData.width = width;
    floor.userData.height = height;
    floor.userData.depth = depth;
    return floor;
}

/**
 * Adds a wall component to the scene using input dimensions.
 */
window.addWall = function() {
    const width = parseFloat(dimWidthInput.value);
    const height = parseFloat(dimHeightInput.value);
    const depth = parseFloat(dimDepthInput.value);
    if (isNaN(width) || isNaN(height) || isNaN(depth) || width <= 0 || height <= 0 || depth <= 0) {
        document.getElementById('project-message').textContent = "Please enter valid positive dimensions for Wall.";
        return;
    }
    const wall = createWallMesh(width, height, depth);
    wall.position.set(0, height / 2, 0); // Position on top of the ground plane
    scene.add(wall);
    window.selectObject(wall);
    document.getElementById('project-message').textContent = "Wall added. Select it to move/rotate/scale.";
};

/**
 * Adds a floor component to the scene using input dimensions.
 */
window.addFloor = function() {
    const width = parseFloat(dimWidthInput.value);
    const height = parseFloat(dimHeightInput.value); // Floor thickness
    const depth = parseFloat(dimDepthInput.value);
    if (isNaN(width) || isNaN(height) || isNaN(depth) || width <= 0 || height <= 0 || depth <= 0) {
        document.getElementById('project-message').textContent = "Please enter valid positive dimensions for Floor.";
        return;
    }
    const floor = createFloorMesh(width, height, depth);
    floor.position.set(0, height / 2, 0); // Position on top of the ground plane
    scene.add(floor);
    window.selectObject(floor);
    document.getElementById('project-message').textContent = "Floor added. Select it to move/rotate/scale.";
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
    const material = new THREE.MeshStandardMaterial({ color: DEFAULT_MATERIAL_COLOR });
    const cube = new THREE.Mesh(geometry, material);

    cube.position.set(0, height / 2, 0); // Position on top of the ground plane
    cube.userData.isCustomComponent = true;
    cube.userData.componentType = 'cube';
    cube.userData.width = width;
    cube.userData.height = height;
    cube.userData.depth = depth;
    scene.add(cube);
    window.selectObject(cube);
    document.getElementById('project-message').textContent = "Cube added. Select it to move/rotate/scale.";
};

/**
 * Adds a window component to the scene using input dimensions.
 */
window.addWindow = function() {
    const width = parseFloat(dimWidthInput.value);
    const height = parseFloat(dimHeightInput.value);
    const depth = parseFloat(dimDepthInput.value); // Overall depth of the window, including frame
    if (isNaN(width) || isNaN(height) || isNaN(depth) || width <= 0 || height <= 0 || depth <= 0) {
        document.getElementById('project-message').textContent = "Please enter valid positive dimensions for Window.";
        return;
    }
    const frameThickness = 0.1;
    const glassThickness = 0.01;

    const windowGroup = new THREE.Group();
    windowGroup.userData.isCustomComponent = true; // Tag the group as the component
    windowGroup.userData.componentType = 'window';
    windowGroup.userData.width = width;
    windowGroup.userData.height = height;
    windowGroup.userData.depth = depth;

    // Glass pane
    const glassGeometry = new THREE.BoxGeometry(width - frameThickness * 2, height - frameThickness * 2, glassThickness);
    const glassMaterial = new THREE.MeshStandardMaterial({
        color: 0xADD8E6, // Light blue for glass
        transparent: true,
        opacity: 0.5,
        roughness: 0.1,
        metalness: 0.1
    });
    const glassMesh = new THREE.Mesh(glassGeometry, glassMaterial);
    glassMesh.position.z = 0; // Center glass within the frame depth
    windowGroup.add(glassMesh);

    // Frame parts (4 pieces)
    const frameMaterial = new THREE.MeshStandardMaterial({ color: 0x8B4513 }); // Brown for wood frame
    // Top frame
    const topFrame = new THREE.Mesh(new THREE.BoxGeometry(width, frameThickness, frameThickness), frameMaterial);
    topFrame.position.set(0, (height / 2) - (frameThickness / 2), 0);
    windowGroup.add(topFrame);
    // Bottom frame
    const bottomFrame = new THREE.Mesh(new THREE.BoxGeometry(width, frameThickness, frameThickness), frameMaterial);
    bottomFrame.position.set(0, -(height / 2) + (frameThickness / 2), 0);
    windowGroup.add(bottomFrame);
    // Left frame
    const leftFrame = new THREE.Mesh(new THREE.BoxGeometry(frameThickness, height - frameThickness * 2, frameThickness), frameMaterial);
    leftFrame.position.set(-(width / 2) + (frameThickness / 2), 0, 0);
    windowGroup.add(leftFrame);
    // Right frame
    const rightFrame = new THREE.Mesh(new THREE.BoxGeometry(frameThickness, height - frameThickness * 2, frameThickness), frameMaterial);
    rightFrame.position.set((width / 2) - (frameThickness / 2), 0, 0);
    windowGroup.add(rightFrame);

    windowGroup.position.set(0, height / 2, 0); // Position on top of the ground plane
    scene.add(windowGroup);
    window.selectObject(windowGroup);
    document.getElementById('project-message').textContent = "Window added. Select it to move/rotate/scale.";
};

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
    const material = new THREE.MeshStandardMaterial({ color: 0x654321 }); // Brown color for roof
    const roof = new THREE.Mesh(geometry, material);

    // Position the roof on top of a typical wall height (e.g., 3 units) + half its own height
    roof.position.set(0, 3 + (height / 2), 0);
    roof.userData.isCustomComponent = true;
    roof.userData.componentType = 'roof';
    roof.userData.width = width;
    roof.userData.height = height;
    roof.userData.depth = depth;
    scene.add(roof);
    window.selectObject(roof);
    document.getElementById('project-message').textContent = "Roof added. Select it to move/rotate/scale.";
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
    window.cancelDrawing(); // Cancel drawing mode
    window.clearMeasurements(); // Clear measurements
};

/**
 * Updates the temporary offset drawing line as the user drags.
 * @param {THREE.Vector3} currentPoint - The current intersection point on the object.
 */
window.updateOffsetDrawing = function(currentPoint) {
    if (!isOffsetMode || !offsetReferenceObject || !offsetStartPoint) return;

    // Remove previous offset line
    if (currentOffsetLine) {
        scene.remove(currentOffsetLine);
        currentOffsetLine.geometry.dispose();
        currentOffsetLine.material.dispose();
    }

    // Convert world points to local coordinates of the reference object
    const localStart = offsetReferenceObject.worldToLocal(offsetStartPoint.clone());
    const localCurrent = offsetReferenceObject.worldToLocal(currentPoint.clone());

    // Calculate the corners of the rectangle in local coordinates
    const minX = Math.min(localStart.x, localCurrent.x);
    const maxX = Math.max(localStart.x, localCurrent.x);
    const minZ = Math.min(localStart.z, localCurrent.z);
    const maxZ = Math.max(localStart.z, localCurrent.z);

    // Ensure the offset rectangle stays within the bounds of the reference object
    const refWidth = offsetReferenceObject.userData.width;
    const refDepth = offsetReferenceObject.userData.depth;

    const halfRefWidth = refWidth / 2;
    const halfRefDepth = refDepth / 2;

    const clampedMinX = Math.max(minX, -halfRefWidth);
    const clampedMaxX = Math.min(maxX, halfRefWidth);
    const clampedMinZ = Math.max(minZ, -halfRefDepth);
    const clampedMaxZ = Math.min(maxZ, halfRefDepth);

    // Reconstruct points from clamped local coordinates
    const p1 = new THREE.Vector3(clampedMinX, localStart.y, clampedMinZ);
    const p2 = new THREE.Vector3(clampedMaxX, localStart.y, clampedMinZ);
    const p3 = new THREE.Vector3(clampedMaxX, localStart.y, clampedMaxZ);
    const p4 = new THREE.Vector3(clampedMinX, localStart.y, clampedMaxZ);

    const rectPoints = [p1, p2, p3, p4, p1]; // Close the rectangle in local space

    const geometry = new THREE.BufferGeometry().setFromPoints(rectPoints);
    const material = new THREE.LineDashedMaterial({
        color: DRAWING_LINE_COLOR,
        dashSize: DRAWING_LINE_DASH_SIZE,
        gapSize: DRAWING_LINE_GAP_SIZE
    });
    currentOffsetLine = new THREE.Line(geometry, material);
    currentOffsetLine.computeLineDistances(); // Required for dashed lines
    offsetReferenceObject.add(currentOffsetLine); // Add line as child of reference object
};

/**
 * Finalizes the offset drawing and creates a new component (e.g., a rug).
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
        const rugThickness = 0.05; // A thin rug
        newOffsetObject = createOffsetFloorMesh(width, rugThickness, depth);
        // Position relative to the center of the offset area, slightly above the floor
        newOffsetObject.position.set(
            offsetReferenceObject.position.x + centerX,
            offsetReferenceObject.position.y + (offsetReferenceObject.userData.height / 2) + (rugThickness / 2) + 0.01, // Slightly above the floor
            offsetReferenceObject.position.z + centerZ
        );
        newOffsetObject.userData.offsetOf = offsetReferenceObject.uuid; // Link to parent
        document.getElementById('model-status').textContent = "Rug (offset floor) created.";
    } else if (offsetReferenceObject.userData.componentType === 'wall') {
        // For walls, an offset could mean a thinner inner wall or a decorative panel
        const panelThickness = 0.05;
        newOffsetObject = createWallMesh(width, offsetReferenceObject.userData.height, panelThickness); // Use wall height
        newOffsetObject.position.set(
            offsetReferenceObject.position.x + centerX,
            offsetReferenceObject.position.y, // Same height as wall
            offsetReferenceObject.position.z + centerZ + (offsetReferenceObject.userData.depth / 2) - (panelThickness / 2) - 0.01 // Offset slightly inside
        );
        newOffsetObject.userData.offsetOf = offsetReferenceObject.uuid;
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

// Helper function for creating offset floor meshes (e.g., rugs)
function createOffsetFloorMesh(width, height, depth) {
    const geometry = new THREE.BoxGeometry(width, height, depth);
    const material = new THREE.MeshStandardMaterial({ color: 0x8B0000 }); // Red for a rug
    const rug = new THREE.Mesh(geometry, material);
    rug.userData.isCustomComponent = true;
    rug.userData.componentType = 'rug'; // New component type
    rug.userData.width = width;
    rug.userData.height = height;
    rug.userData.depth = depth;
    return rug;
}


/**
 * Applies the selected color from the color picker to the currently selected object.
 */
window.applyColorToSelected = function() {
    if (selectedObject) {
        const newColor = colorPickerElement.value;
        // If it's a window, apply color to the glass material
        if (selectedObject.userData.componentType === 'window' && selectedObject.children.length > 0) {
            // Find the glass mesh within the window group (assuming it's the first child)
            const glassMesh = selectedObject.children.find(child => child.material && child.material.transparent);
            if (glassMesh && glassMesh.material) {
                glassMesh.material.color.set(newColor);
                selectedObject.userData.material = { color: glassMesh.material.color.getHex() };
            }
        } else {
            // For other objects, apply to their main material
            selectedObject.material.color.set(newColor);
            selectedObject.userData.material = { color: selectedObject.material.color.getHex() };
        }
        document.getElementById('project-message').textContent = `Color applied to ${selectedObject.userData.componentType || 'object'}.`;
    } else {
        document.getElementById('project-message').textContent = "No object selected to apply color.";
    }
};


/**
 * The main animation loop.
 * Renders the scene and updates first-person camera movement.
 */
window.animate = function() {
    requestAnimationFrame(window.animate);

    // Apply object movement if an object is selected and not in walk mode or drawing/offsetting
    if (selectedObject && !isWalkMode && !isDrawing && !isOffsetMode) {
        if (objectMoveForward) selectedObject.position.z -= OBJECT_MOVE_SPEED;
        if (objectMoveBackward) selectedObject.position.z += OBJECT_MOVE_SPEED;
        if (objectMoveLeft) selectedObject.position.x -= OBJECT_MOVE_SPEED;
        if (objectMoveRight) selectedObject.position.x += OBJECT_MOVE_SPEED;
        if (objectMoveUp) selectedObject.position.y += OBJECT_MOVE_SPEED;
        if (objectMoveDown) selectedObject.position.y -= OBJECT_MOVE_SPEED;

        // Apply object rotation
        if (objectRotateLeft) selectedObject.rotation.y += OBJECT_ROTATION_SPEED;
        if (objectRotateRight) selectedObject.rotation.y -= OBJECT_ROTATION_SPEED;


        // Update UI after object movement/rotation
        updateSelectedObjectPropertiesUI();
    }

    if (isWalkMode) {
        // Handle first-person movement
        const direction = new THREE.Vector3();
        const cameraRight = new THREE.Vector3();
        camera.getWorldDirection(direction); // Get forward direction
        camera.getWorldDirection(cameraRight); // Start with forward for right vector
        cameraRight.crossVectors(camera.up, direction); // Get right direction

        if (moveForward) camera.position.addScaledVector(direction, cameraSpeed);
        if (moveBackward) camera.position.addScaledVector(direction, -cameraSpeed);
        if (moveLeft) camera.position.addScaledVector(cameraRight, -cameraSpeed);
        if (moveRight) camera.position.addScaledVector(cameraRight, cameraSpeed);

        // Keep camera at a fixed height (simple ground collision)
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
