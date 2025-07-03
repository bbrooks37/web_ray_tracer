// public/js/ui.js
// Manages the user interface elements, updating displays and handling input from HTML controls.

import { Vec3 } from './math.js';

export class UIManager {
    /**
     * @param {object} cameraControls - Object containing references to camera control HTML input elements (e.g., sliders).
     * @param {object} cameraValueDisplays - Object containing references to HTML span/p elements to display camera values.
     * @param {object} selectedObjectControls - Object containing references to selected object control HTML elements (e.g., color picker).
     * @param {object} modelTextureControls - NEW: Object containing references to model/texture related HTML elements.
     */
    constructor(cameraControls, cameraValueDisplays, selectedObjectControls, modelTextureControls) {
        this.cameraControls = cameraControls;
        this.cameraValueDisplays = cameraValueDisplays;
        this.selectedObjectControls = selectedObjectControls;
        this.modelTextureControls = modelTextureControls; // NEW: Assign new controls

        // Initialize display of camera values based on their initial slider values
        this.updateCameraValues(
            new Vec3(
                parseFloat(this.cameraControls.eyeX.value),
                parseFloat(this.cameraControls.eyeY.value),
                parseFloat(this.cameraControls.eyeZ.value)
            ),
            new Vec3(
                parseFloat(this.cameraControls.lookAtX.value),
                parseFloat(this.cameraControls.lookAtY.value),
                parseFloat(this.cameraControls.lookAtZ.value)
            ),
            parseFloat(this.cameraControls.fov.value),
            parseFloat(this.cameraControls.orbitRadius.value)
        );
    }

    /**
     * Updates the UI slider values and their corresponding text displays for camera properties.
     * This is typically called when the camera's state changes programmatically (e.g., via mouse orbit).
     * @param {Vec3} eyePosition - The current eye position of the camera.
     * @param {Vec3} lookAt - The current lookAt point of the camera.
     * @param {number} fov - The current FOV of the camera.
     * @param {number} orbitRadius - The current orbit radius of the camera.
     */
    updateCameraValues(eyePosition, lookAt, fov, orbitRadius) {
        // Update slider values (though eyePosition is read-only for sliders when orbiting)
        this.cameraControls.eyeX.value = eyePosition.x.toFixed(1);
        this.cameraControls.eyeY.value = eyePosition.y.toFixed(1);
        this.cameraControls.eyeZ.value = eyePosition.z.toFixed(1);

        this.cameraControls.lookAtX.value = lookAt.x.toFixed(1);
        this.cameraControls.lookAtY.value = lookAt.y.toFixed(1);
        this.cameraControls.lookAtZ.value = lookAt.z.toFixed(1);

        this.cameraControls.fov.value = fov.toFixed(0);
        this.cameraControls.orbitRadius.value = orbitRadius.toFixed(1);


        // Update text displays
        this.cameraValueDisplays.lookAtXValue.textContent = lookAt.x.toFixed(1);
        this.cameraValueDisplays.lookAtYValue.textContent = lookAt.y.toFixed(1);
        this.cameraValueDisplays.lookAtZValue.textContent = lookAt.z.toFixed(1);

        this.cameraValueDisplays.fovValue.textContent = fov.toFixed(0);
        this.cameraValueDisplays.orbitRadiusValue.textContent = orbitRadius.toFixed(1);
    }

    /**
     * Specifically updates the displayed eye position text, as its slider is not directly manipulated.
     * @param {Vec3} eyePosition - The current eye position of the camera.
     */
    updateEyePositionDisplay(eyePosition) {
        this.cameraValueDisplays.eyeXValue.textContent = eyePosition.x.toFixed(2);
        this.cameraValueDisplays.eyeYValue.textContent = eyePosition.y.toFixed(2);
        this.cameraValueDisplays.eyeZValue.textContent = eyePosition.z.toFixed(2);
    }

    /**
     * Displays the properties of the currently selected object in the UI.
     * @param {Object} obj - The object that was selected.
     */
    displaySelectedObject(obj) {
        this.selectedObjectControls.selectedObjectInfo.textContent = `Selected: ${obj.constructor.name}`;
        this.selectedObjectControls.colorPickerGroup.style.display = 'flex'; // Show the color picker
        this.modelTextureControls.modelTextureGroup.style.display = 'flex'; // NEW: Show model/texture controls

        // Set the color picker's value to the selected object's color
        this.selectedObjectControls.objectColor.value = obj.color.toHexString()

        // NEW: Update model/texture display (placeholders for now)
        this.modelTextureControls.modelFileName.textContent = obj.modelName || 'No model loaded';
        this.modelTextureControls.textureFileName.textContent = obj.textureName || 'No texture applied';
    }

    /**
     * Clears the selected object display in the UI.
     */
    clearSelectedObjectDisplay() {
        this.selectedObjectControls.selectedObjectInfo.textContent = 'No object selected. Click on a sphere to select it.';
        this.selectedObjectControls.colorPickerGroup.style.display = 'none'; // Hide the color picker
        this.modelTextureControls.modelTextureGroup.style.display = 'none'; // NEW: Hide model/texture controls
    }

    /**
     * NEW: Updates the displayed model file name for the selected object.
     * @param {string} fileName - The name of the loaded model file.
     */
    updateModelFileName(fileName) {
        this.modelTextureControls.modelFileName.textContent = fileName;
    }

    /**
     * NEW: Updates the displayed texture file name for the selected object.
     * @param {string} fileName - The name of the applied texture file.
     */
    updateTextureFileName(fileName) {
        this.modelTextureControls.textureFileName.textContent = fileName;
    }
}