// public/js/ui.js
// Manages the user interface interactions and updates the display.

import { Vec3 } from './math.js';

export class UIManager {
    /**
     * @param {object} cameraControls - Object containing references to camera control input elements.
     * @param {object} cameraValueDisplays - Object containing references to camera value display elements.
     * @param {object} selectedObjectControls - Object containing references to selected object control input elements.
     * @param {object} fileInputControls - Object containing references to file input related elements.
     */
    constructor(cameraControls, cameraValueDisplays, selectedObjectControls, fileInputControls) {
        this.cameraControls = cameraControls;
        this.cameraValueDisplays = cameraValueDisplays;
        this.selectedObjectControls = selectedObjectControls;
        this.fileInputControls = fileInputControls;

        // Ensure initial state of selected object controls is hidden
        this.selectedObjectControls.selectedObjectInfo.style.display = 'none';
        this.selectedObjectControls.colorPickerGroup.style.display = 'none';
        // NEW: Hide specular group initially
        if (this.selectedObjectControls.specularGroup) {
            this.selectedObjectControls.specularGroup.style.display = 'none';
        }
    }

    /**
     * Updates the camera control sliders and their value displays.
     * @param {Vec3} eyePos - Current camera eye position.
     * @param {Vec3} lookAt - Current camera lookAt point.
     * @param {number} fov - Current camera FOV.
     * @param {number} orbitRadius - Current camera orbit radius.
     */
    updateCameraValues(eyePos, lookAt, fov, orbitRadius) {
        // Update slider values (if they exist)
        if (this.cameraControls.lookAtX) this.cameraControls.lookAtX.value = lookAt.x.toFixed(2);
        if (this.cameraControls.lookAtY) this.cameraControls.lookAtY.value = lookAt.y.toFixed(2);
        if (this.cameraControls.lookAtZ) this.cameraControls.lookAtZ.value = lookAt.z.toFixed(2);
        if (this.cameraControls.fov) this.cameraControls.fov.value = fov.toFixed(1);
        if (this.cameraControls.orbitRadius) this.cameraControls.orbitRadius.value = orbitRadius.toFixed(1);

        // Update display values
        if (this.cameraValueDisplays.eyeXValue) this.cameraValueDisplays.eyeXValue.textContent = eyePos.x.toFixed(2);
        if (this.cameraValueDisplays.eyeYValue) this.cameraValueDisplays.eyeYValue.textContent = eyePos.y.toFixed(2);
        if (this.cameraValueDisplays.eyeZValue) this.cameraValueDisplays.eyeZValue.textContent = eyePos.z.toFixed(2);
        if (this.cameraValueDisplays.lookAtXValue) this.cameraValueDisplays.lookAtXValue.textContent = lookAt.x.toFixed(2);
        if (this.cameraValueDisplays.lookAtYValue) this.cameraValueDisplays.lookAtYValue.textContent = lookAt.y.toFixed(2);
        if (this.cameraValueDisplays.lookAtZValue) this.cameraValueDisplays.lookAtZValue.textContent = lookAt.z.toFixed(2);
        if (this.cameraValueDisplays.fovValue) this.cameraValueDisplays.fovValue.textContent = fov.toFixed(1);
        if (this.cameraValueDisplays.orbitRadiusValue) this.cameraValueDisplays.orbitRadiusValue.textContent = orbitRadius.toFixed(1);
    }

    /**
     * Updates only the displayed eye position.
     * @param {Vec3} eyePos - Current camera eye position.
     */
    updateEyePositionDisplay(eyePos) {
        if (this.cameraValueDisplays.eyeXValue) this.cameraValueDisplays.eyeXValue.textContent = eyePos.x.toFixed(2);
        if (this.cameraValueDisplays.eyeYValue) this.cameraValueDisplays.eyeYValue.textContent = eyePos.y.toFixed(2);
        if (this.cameraValueDisplays.eyeZValue) this.cameraValueDisplays.eyeZValue.textContent = eyePos.z.toFixed(2);
    }

    /**
     * Displays properties of the currently selected object in the UI.
     * @param {Object} obj - The selected object.
     */
    displaySelectedObject(obj) {
        this.selectedObjectControls.selectedObjectInfo.style.display = 'block';
        this.selectedObjectControls.colorPickerGroup.style.display = 'block';
        if (this.selectedObjectControls.specularGroup) { // NEW: Show specular group
            this.selectedObjectControls.specularGroup.style.display = 'block';
        }

        // Update object type/name display
        const objectTypeElement = document.getElementById('objectType');
        if (objectTypeElement) {
            if (obj.modelName && obj.modelName !== '') {
                objectTypeElement.textContent = `Type: ${obj.constructor.name} (${obj.modelName})`;
            } else {
                objectTypeElement.textContent = `Type: ${obj.constructor.name}`;
            }
        }

        // Update diffuse color picker
        this.selectedObjectControls.objectColor.value = obj.color.toHexString();

        // NEW: Update specular color picker, shininess, and reflectivity
        if (this.selectedObjectControls.specularColor) {
            this.selectedObjectControls.specularColor.value = obj.specularColor.toHexString();
        }
        if (this.selectedObjectControls.shininess) {
            this.selectedObjectControls.shininess.value = obj.shininess.toFixed(0);
            this.selectedObjectControls.shininessValue.textContent = obj.shininess.toFixed(0);
        }
        if (this.selectedObjectControls.reflectivity) {
            this.selectedObjectControls.reflectivity.value = obj.reflectivity.toFixed(2);
            this.selectedObjectControls.reflectivityValue.textContent = obj.reflectivity.toFixed(2);
        }

        // Update texture file name display based on selected object's textureId
        this.fileInputControls.textureFileName.textContent = obj.textureName || 'No texture applied';
    }

    /**
     * Clears the selected object display in the UI.
     */
    clearSelectedObjectDisplay() {
        this.selectedObjectControls.selectedObjectInfo.style.display = 'none';
        this.selectedObjectControls.colorPickerGroup.style.display = 'none';
        if (this.selectedObjectControls.specularGroup) { // NEW: Hide specular group
            this.selectedObjectControls.specularGroup.style.display = 'none';
        }

        const objectTypeElement = document.getElementById('objectType');
        if (objectTypeElement) {
            objectTypeElement.textContent = 'Type: None';
        }
        this.fileInputControls.textureFileName.textContent = 'No texture applied'; // Clear texture name
    }

    /**
     * Updates the displayed model file name.
     * @param {string} fileName - The name of the loaded model file.
     */
    updateModelFileName(fileName) {
        this.fileInputControls.modelFileName.textContent = fileName;
    }

    /**
     * Updates the displayed texture file name.
     * @param {string} fileName - The name of the loaded texture file.
     */
    updateTextureFileName(fileName) {
        this.fileInputControls.textureFileName.textContent = fileName;
    }
}
