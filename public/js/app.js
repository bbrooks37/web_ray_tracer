// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, signInWithCustomToken, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, collection, query, where, addDoc, getDocs, deleteDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
// Also include GLTFLoader as it's a Three.js extension
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
    if (!window.userId || !window.db || !window.loadedModel) {
        console.warn("User not logged in, Firestore not initialized, or no model loaded.");
        document.getElementById('project-message').textContent = "Please log in and load a model first.";
        return;
    }

    const projectName = document.getElementById('project-name-input').value.trim();
    if (!projectName) {
        document.getElementById('project-message').textContent = "Please enter a project name.";
        return;
    }

    // Serialize current scene state
    const projectData = {
        modelUrl: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/DamagedHelmet/glTF/DamagedHelmet.gltf', // For now, hardcode the model URL
        position: { x: window.loadedModel.position.x, y: window.loadedModel.position.y, z: window.loadedModel.position.z },
        rotation: { x: window.loadedModel.rotation.x, y: window.loadedModel.rotation.y, z: window.loadedModel.rotation.z },
        scale: { x: window.loadedModel.scale.x, y: window.loadedModel.scale.y, z: window.loadedModel.scale.z },
        // Add any other relevant scene data here (e.g., material changes, light settings)
        createdAt: new Date(),
        lastModifiedAt: new Date()
    };

    try {
        // Store in private user collection
        const projectsCollectionRef = collection(window.db, `artifacts/${appId}/users/${window.userId}/projects`);
        await addDoc(projectsCollectionRef, {
            projectName: projectName,
            sceneData: JSON.stringify(projectData) // Store as string to handle complex objects
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
            const sceneData = JSON.parse(projectData.sceneData); // Parse the stored JSON string

            // Remove existing model if any
            if (window.loadedModel) {
                window.scene.remove(window.loadedModel);
                window.loadedModel.traverse(child => {
                    if (child.isMesh) {
                        child.geometry.dispose();
                        if (Array.isArray(child.material)) {
                            child.material.forEach(m => m.dispose());
                        } else {
                            child.material.dispose();
                        }
                    }
                });
                window.loadedModel = null;
            }

            // Load the model from the saved URL
            const loader = new THREE.GLTFLoader();
            document.getElementById('model-status').textContent = `Loading saved model...`;
            window.loadingOverlay.style.display = 'flex';

            loader.load(
                sceneData.modelUrl,
                function (gltf) {
                    window.loadedModel = gltf.scene;
                    window.scene.add(window.loadedModel);

                    // Apply saved transformations
                    window.loadedModel.position.set(sceneData.position.x, sceneData.position.y, sceneData.position.z);
                    window.loadedModel.rotation.set(sceneData.rotation.x, sceneData.rotation.y, sceneData.rotation.z);
                    window.loadedModel.scale.set(sceneData.scale.x, sceneData.scale.y, sceneData.scale.z);

                    // Recalculate camera target based on loaded model's new position
                    const box = new THREE.Box3().setFromObject(window.loadedModel);
                    window.cameraTarget.copy(box.getCenter(new THREE.Vector3()));
                    window.camera.lookAt(window.cameraTarget); // Make camera look at the model's center

                    document.getElementById('model-status').textContent = `Loaded: ${projectData.projectName}`;
                    window.loadingOverlay.style.display = 'none';
                    document.getElementById('project-message').textContent = `Project "${projectData.projectName}" loaded successfully!`;
                    console.log("Project loaded:", projectData.projectName);
                },
                undefined, // Progress callback
                function (error) {
                    document.getElementById('model-status').textContent = "Error loading saved model.";
                    window.loadingOverlay.style.display = 'none';
                    document.getElementById('project-message').textContent = `Error loading saved model: ${error.message}`;
                    console.error('An error occurred loading the saved model:', error);
                    window.addFallbackBox(); // Add fallback if saved model fails to load
                }
            );

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
        console.warn("User not logged in or Firestore not initialized. Cannot delete project.");
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

// Global variables for Three.js scene (moved from index.html)
let scene, camera, renderer;
let loadedModel = null; // Variable to hold the loaded 3D model (e.g., GLTF scene)
let cameraTarget = new THREE.Vector3(0, 0, 0); // The point the camera orbits around

// Camera controls (moved from index.html)
let isDragging = false;
let previousMouseX = 0;
let previousMouseY = 0;
let rotationSpeed = 0.005;
let zoomSpeed = 0.1;

// UI Elements (moved from index.html)
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


/**
 * Sets up the Three.js scene, camera, and renderer.
 * Initializes GLTFLoader and attempts to load a model.
 * This function is now called AFTER Firebase authentication is ready.
 */
window.setupScene = function() {
    // Only setup scene once
    if (scene) return;

    // Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a202c); // Dark background matching body

    // Camera
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 20, 50); // Initial camera position (will be adjusted after model load)

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
    scene.add(plane);

    // --- Model Loading ---
    const loader = new THREE.GLTFLoader();

    // Sample GLTF model URL (a simple helmet from Khronos Group)
    const modelUrl = 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/DamagedHelmet/glTF/DamagedHelmet.gltf';

    loader.load(
        modelUrl,
        function (gltf) {
            // Model loaded successfully
            loadedModel = gltf.scene;
            scene.add(loadedModel);

            // --- Auto-scale and center the loaded model ---
            const box = new THREE.Box3().setFromObject(loadedModel);
            const center = box.getCenter(new THREE.Vector3());
            const size = box.getSize(new THREE.Vector3());

            // Adjust model position so its center is at (0,0,0)
            loadedModel.position.x += (loadedModel.position.x - center.x);
            loadedModel.position.y += (loadedModel.position.y - center.y);
            loadedModel.position.z += (loadedModel.position.z - center.z);

            // Set camera target to the new center of the model
            cameraTarget.copy(loadedModel.position);

            // Calculate optimal camera distance to frame the model
            const maxDim = Math.max(size.x, size.y, size.z);
            const fov = camera.fov * (Math.PI / 180);
            let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2));
            cameraZ *= 1.5; // Add some padding

            // Set camera initial position relative to the model's center
            camera.position.set(cameraTarget.x, cameraTarget.y + maxDim * 0.5, cameraTarget.z + cameraZ);
            camera.lookAt(cameraTarget); // Make camera look at the model's center

            modelStatusElement.textContent = "Loaded: Damaged Helmet";
            loadingOverlay.style.display = 'none'; // Hide loading overlay
            console.log('Model loaded:', gltf);
        },
        // Called while loading is progressing
        function (xhr) {
            const progress = (xhr.loaded / xhr.total * 100).toFixed(2);
            modelStatusElement.textContent = `Loading... ${progress}%`;
            console.log(`Model loading: ${progress}% loaded`);
        },
        // Called when loading has errors
        function (error) {
            modelStatusElement.textContent = "Error loading model.";
            loadingOverlay.style.display = 'none'; // Hide loading overlay
            console.error('An error occurred loading the model:', error);
            // Fallback to a simple box if model loading fails
            window.addFallbackBox();
        }
    );

    // Event Listeners for camera controls
    renderer.domElement.addEventListener('mousedown', onMouseDown);
    renderer.domElement.addEventListener('mouseup', onMouseUp);
    renderer.domElement.addEventListener('mousemove', onMouseMove);
    renderer.domElement.addEventListener('wheel', onMouseWheel);
    window.addEventListener('resize', onWindowResize);

    // Event Listeners for Walk Mode (Keyboard)
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    // Event listener for measurement clicks
    renderer.domElement.addEventListener('click', onCanvasClick);

    // Add UI elements for Phase 3
    const appSection = document.getElementById('app-section');
    const toolsHtml = `
        <h4>Tools</h4>
        <div class="form-group">
            <button class="btn btn-secondary" id="toggle-walk-mode-btn">Toggle Walk Mode</button>
            <button class="btn btn-secondary" id="measure-distance-btn">Measure Distance</button>
        </div>
        <p>Distance: <span id="measurement-distance">N/A</span></p>
        <p>Midpoint: <span id="measurement-midpoint">N/A</span></p>
    `;
    appSection.insertAdjacentHTML('beforeend', toolsHtml);

    document.getElementById('toggle-walk-mode-btn').addEventListener('click', window.toggleWalkMode);
    document.getElementById('measure-distance-btn').addEventListener('click', window.toggleMeasurementMode);

    // Get UI elements for measurement
    window.measurementDistanceElement = document.getElementById('measurement-distance');
    window.measurementMidpointElement = document.getElementById('measurement-midpoint');
};

/**
 * Adds a simple box as a fallback if external model loading fails.
 */
window.addFallbackBox = function() {
    const geometry = new THREE.BoxGeometry(10, 10, 10);
    const material = new THREE.MeshStandardMaterial({
        color: 0x9f7aea,
        emissive: 0x5500ff,
        emissiveIntensity: 0.2,
        roughness: 0.3,
        metalness: 0.5
    });
    loadedModel = new THREE.Mesh(geometry, material);
    scene.add(loadedModel);

    // Center and position camera for the fallback box
    const box = new THREE.Box3().setFromObject(loadedModel);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());

    loadedModel.position.x += (loadedModel.position.x - center.x);
    loadedModel.position.y += (loadedModel.position.y - center.y);
    loadedModel.position.z += (loadedModel.position.z - center.z);

    cameraTarget.copy(loadedModel.position);

    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = camera.fov * (Math.PI / 180);
    let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2));
    cameraZ *= 1.5;

    camera.position.set(cameraTarget.x, cameraTarget.y + maxDim * 0.5, cameraTarget.z + cameraZ);
    camera.lookAt(cameraTarget);
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
 * Handles mouse down event for camera rotation (Orbit Mode).
 * @param {MouseEvent} event - The mouse event.
 */
function onMouseDown(event) {
    if (!isWalkMode) { // Only orbit if not in walk mode
        isDragging = true;
        previousMouseX = event.clientX;
        previousMouseY = event.clientY;
    }
}

/**
 * Handles mouse up event to stop camera rotation (Orbit Mode).
 */
function onMouseUp() {
    if (!isWalkMode) {
        isDragging = false;
    }
}

/**
 * Handles mouse move event for camera rotation (Orbit Mode) or look (Walk Mode).
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
    } else {
        // Orbit controls
        if (!isDragging) return;

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
 * Handles keyboard key down events for first-person movement.
 * @param {KeyboardEvent} event - The keyboard event.
 */
function onKeyDown(event) {
    if (!isWalkMode) return;
    switch (event.code) {
        case 'KeyW': moveForward = true; break;
        case 'KeyS': moveBackward = true; break;
        case 'KeyA': moveLeft = true; break;
        case 'KeyD': moveRight = true; break;
    }
}

/**
 * Handles keyboard key up events for first-person movement.
 * @param {KeyboardEvent} event - The keyboard event.
 */
function onKeyUp(event) {
    if (!isWalkMode) return;
    switch (event.code) {
        case 'KeyW': moveForward = false; break;
        case 'KeyS': moveBackward = false; break;
        case 'KeyA': moveLeft = false; break;
        case 'KeyD': moveRight = false; break;
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
        // Reset camera to orbit view (re-center on model)
        if (loadedModel) {
            const box = new THREE.Box3().setFromObject(loadedModel);
            cameraTarget.copy(box.getCenter(new THREE.Vector3()));
            const size = box.getSize(new THREE.Vector3());
            const maxDim = Math.max(size.x, size.y, size.z);
            const fov = camera.fov * (Math.PI / 180);
            let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2));
            cameraZ *= 1.5;
            camera.position.set(cameraTarget.x, cameraTarget.y + maxDim * 0.5, cameraTarget.z + cameraZ);
            camera.lookAt(cameraTarget);
        }
    }
    // Disable measurement mode if entering walk mode
    if (isWalkMode && isMeasuring) {
        window.toggleMeasurementMode();
    }
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
 * Handles clicks on the canvas for measurement.
 * @param {MouseEvent} event - The mouse event.
 */
function onCanvasClick(event) {
    if (!isMeasuring) return;

    // Calculate mouse position in normalized device coordinates (-1 to +1)
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    // Update the raycaster with the camera and mouse position
    raycaster.setFromCamera(mouse, camera);

    // Calculate objects intersecting the ray
    const intersects = raycaster.intersectObjects(scene.children, true); // true for recursive check

    if (intersects.length > 0) {
        const intersectionPoint = intersects[0].point;

        // Add point to selected points
        selectedMeasurementPoints.push(intersectionPoint);

        // Visualize the selected point
        const sphereGeometry = new THREE.SphereGeometry(MEASUREMENT_SPHERE_RADIUS, 16, 16);
        const sphereMaterial = new THREE.MeshBasicMaterial({ color: MEASUREMENT_LINE_COLOR });
        const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
        sphere.position.copy(intersectionPoint);
        scene.add(sphere);
        measurementSpheres.push(sphere);

        if (selectedMeasurementPoints.length === 2) {
            // Calculate distance
            const p1 = selectedMeasurementPoints[0];
            const p2 = selectedMeasurementPoints[1];
            const distance = p1.distanceTo(p2);
            window.measurementDistanceElement.textContent = `${distance.toFixed(2)} units`;

            // Calculate midpoint
            const midpoint = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
            window.measurementMidpointElement.textContent = `(${midpoint.x.toFixed(2)}, ${midpoint.y.toFixed(2)}, ${midpoint.z.toFixed(2)})`;

            // Draw a line between the two points
            const lineMaterial = new THREE.LineBasicMaterial({ color: MEASUREMENT_LINE_COLOR });
            const points = [];
            points.push(p1);
            points.push(p2);
            const lineGeometry = new THREE.BufferGeometry().setFromPoints(points);
            const line = new THREE.Line(lineGeometry, lineMaterial);
            line.name = 'measurementLine'; // Give it a name to easily remove later
            scene.add(line);

            // Reset for next measurement after a short delay or explicit clear
            // For now, we'll keep the points, user can click "Exit Measurement" to clear
            // or we could add a "Clear Measurement" button.
            // For simplicity, let's clear after displaying.
            setTimeout(() => {
                window.clearMeasurements();
            }, 3000); // Clear after 3 seconds
        } else if (selectedMeasurementPoints.length > 2) {
            // If more than 2 points are selected, clear and start new measurement
            window.clearMeasurements();
            // Re-add the current click as the first point of a new measurement
            selectedMeasurementPoints.push(intersectionPoint);
            scene.add(sphere); // Re-add the sphere for the new first point
            measurementSpheres.push(sphere);
        }
    }
}


/**
 * The main animation loop.
 * Renders the scene and updates first-person camera movement.
 */
window.animate = function() {
    requestAnimationFrame(window.animate);

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

    if (renderer && scene && camera) {
        renderer.render(scene, camera);
    }
};
