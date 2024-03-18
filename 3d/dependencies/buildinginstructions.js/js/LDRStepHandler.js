'use strict';

/*
The StepHandler is used for displaying step-by-step building instructions.

If a StepHandler more than one placed part, the color and ID of each part are assumed to be the same as it represents a step where more than one submodel is placed onto a model. Only the first placed part is shown being built, while the rest are added in a "placement step". In this step all placed parts are place onto their parent model.

"current" is used to keep track of the currently shown step. If a model has X steps, then "current" can take the values:
- -1 to indicate that the model is not yet being being built (at the "pre step")
- 0 to X-1 to show the step at these positions
- X to show the placement step.

The builder supports the operations:
- nextStep: Single step forward (if possible)
- prevStep: Single step back (if possible)
- moveTo: Go to a specific step.
- Various methods for trieving information regarding the current step (depth, quantities, etc.)
*/
LDR.StepHandler = function(manager, partDescs, isForMainModel) {
    // Save parameters:
    this.opaqueObject = manager.opaqueObject;
    this.sixteenObject = manager.sixteenObject;
    this.transObject = manager.transObject;
    this.loader = manager.ldrLoader;
    this.manager = manager;
    this.partDescs = partDescs;
    this.isForMainModel = isForMainModel; // If true, then prevent stepping to current === -1.

    // Build state:
    this.part = this.loader.getPartType(partDescs[0].ID);
    this.hasExtraParts = partDescs.length > 1;
    this.rebuild();
}

LDR.StepHandler.prototype.rebuild = function() {
    this.removeGeometries();

    this.current = -1; // �ndex of currently-shown step (call nextStep() to initialize)
    this.length = this.part.steps.length;
    if(this.length === 0) {
	console.dir(this);
	throw "Empty step handler!";
    }

    let partDesc = this.partDescs[0];
    this.steps = []; // Propagate current color from partDescs onto the steps.
    for(let i = 0; i < this.length; i++) {
	let step = this.part.steps[i];
        let sh = null;
        if(step.containsNonPartSubModels(this.loader)) { // All are sub models (not parts):
            let subDescs = step.subModels.map(subModel => subModel.placeAt(partDesc));
            sh = new LDR.StepHandler(this.manager, subDescs, false);
        }
        this.steps.push(new LDR.StepInfo(sh, step.cloneColored(partDesc.c)));
    }
    this.steps.push(new LDR.StepInfo()); // One more for placement step. This is also where extra parts are added.

    if(this.isForMainModel) {
        this.recomputeStepIndices(1);
    }
}

LDR.StepInfo = function(stepHandler, step) {
    this.stepHandler = stepHandler;
    this.step = step;
    this.bounds;
    this.accumulatedBounds;
    this.meshCollector;
}

/**
   Used to compute shown index for all steps.
   Expected to be called each time there are changes to steps.
 */
LDR.StepHandler.prototype.recomputeStepIndices = function(firstShownIndex) {
    this.totalNumberOfSteps = this.length;
    this.firstShownIndex = firstShownIndex;
    let shownIndex = firstShownIndex;
    let self = this;
    this.steps.forEach(step => {
            let subHandler = step.stepHandler;
            if(subHandler) {
                subHandler.recomputeStepIndices(shownIndex);
                self.totalNumberOfSteps += subHandler.totalNumberOfSteps;
                shownIndex += subHandler.totalNumberOfSteps+1;
            }
            else {
                shownIndex++;
            }
        });
}

LDR.StepHandler.prototype.updateRotations = function() {
    let self = this;
    this.steps.forEach(stepInfo => {
	let step = stepInfo.step;
	if(step) {
	    step.rotation = step.original.rotation;
	}
        let subHandler = stepInfo.stepHandler;
        if(subHandler) {
            subHandler.updateRotations();
        }
    });
}

LDR.StepHandler.prototype.removeGeometries = function() {
    if(!this.steps) {
        return; // Not yet built - no geometries.
    }
    this.steps.forEach(stepInfo => stepInfo.meshCollector && stepInfo.meshCollector.removeAllMeshes());
    this.steps.forEach(stepInfo => stepInfo.stepHandler && stepInfo.stepHandler.removeGeometries());
}

LDR.StepHandler.prototype.getCurrentStepIndex = function() {
    if(this.current === -1) {
	return this.firstShownIndex-1;
    }
    let subStepHandler = this.steps[this.current].stepHandler;
    if(subStepHandler) {
        return subStepHandler.getCurrentStepIndex();
    }
    let ret = this.firstShownIndex;
    for(let i = 0; i < this.current; i++) {
        let subStepHandler = this.steps[i].stepHandler;
        if(subStepHandler) {
            ret += subStepHandler.totalNumberOfSteps+1;
        }
        else {
            ret++;
        }
    }
    return ret;
}

LDR.StepHandler.prototype.computeCameraPositionRotation = function(defaultMatrix, currentRotationMatrix, useAccumulatedBounds) {
    if(this.current === -1 || this.current === this.length) {
	throw "Camera position not available for pre step and placement step.";
    }

    let step = this.steps[this.current];
    let subStepHandler = step.stepHandler;
    if(subStepHandler && !subStepHandler.isAtPlacementStep()) {
	return subStepHandler.computeCameraPositionRotation(defaultMatrix, currentRotationMatrix, useAccumulatedBounds); // Delegate to subStepHandler.
    }

    let stepRotation = step.step.rotation;

    // Get the current model rotation matrix and model center:
    let pr = this.partDescs[0].r.elements;
    let modelCenter = new THREE.Vector3(); 
    if(useAccumulatedBounds) {
	step.accumulatedBounds.getCenter(modelCenter);
    }
    else {
	step.bounds.getCenter(modelCenter);
    }

    let partM4 = new THREE.Matrix4();
    partM4.set(pr[0], pr[3], pr[6], 0,
	       pr[1], pr[4], pr[7], 0,
	       pr[2], pr[5], pr[8], 0,
	       0,     0,     0,     1);
    let invM4 = new THREE.Matrix4();
    invM4.copy(partM4).invert();

    let invY = new THREE.Matrix4();
    invY.set(1,0,0,0, 0,-1,0,0, 0,0,-1,0, 0,0,0,1);

    currentRotationMatrix = new THREE.Matrix4();
    currentRotationMatrix.set(1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1);

    let rotationMatrix;
    if(stepRotation) {
	rotationMatrix = stepRotation.getRotationMatrix(defaultMatrix);
	currentRotationMatrix.multiply(rotationMatrix);
    }

    currentRotationMatrix.multiply(invY);
    currentRotationMatrix.multiply(invM4);

    modelCenter.applyMatrix4(invM4);
    modelCenter.applyMatrix4(invY);
    if(rotationMatrix) {
	modelCenter.applyMatrix4(rotationMatrix);
    }

    modelCenter.negate();

    return [modelCenter, currentRotationMatrix];
}

/*
 Adds a step to the model. 

 If stepping into a sub model: 
  - Ghost everything earlier (show again once sub-model is done)
*/
LDR.StepHandler.prototype.nextStep = function(skipDrawing) {
    if(this.isAtPlacementStep() || (this.isForMainModel && this.isAtLastStep())) {
	return false; // Dont walk past placement step.
    }
    let step = this.current === -1 ? new LDR.StepInfo() : this.steps[this.current];
    let subStepHandler = step.stepHandler;
    let meshCollector = step.meshCollector;
    let willStep = !subStepHandler || subStepHandler.isAtPlacementStep();

    this.manager.resetSelectedObjects();

    // Special case: Step to placement step.
    if((this.current === this.length-1) && willStep) { 
	this.updateMeshCollectors(false); // Make whole stepHandler new (for placement):
	this.drawExtras();
	this.current++;
	return true;
    }

    // Step to next:
    if(willStep) {
	if(subStepHandler) {
	    subStepHandler.updateMeshCollectors(true); // Make previous step 'old'.
	}
	else if(meshCollector) {
	    meshCollector.draw(true); // Make previous step 'old'.
	}
	this.current++; // Point to next step.
        step = this.steps[this.current];
	subStepHandler = step.stepHandler;
    }

    // Build what is new:
    if(!subStepHandler) { // Only build DAT-parts:
	let meshCollector = step.meshCollector;
	if(!meshCollector) {
	    let pd = this.partDescs[0];
            step.meshCollector = meshCollector = new LDR.MeshCollector(this.opaqueObject, this.sixteenObject, this.transObject, this.manager);

	    step.step.generateThreePart(this.loader, pd.c, pd.p, pd.r, true, false, meshCollector);
	    if(step.step.original) { // The step contains colored clones, so clean up from the original:
		step.step.original.removePrimitivesAndSubParts(this.loader);
	    }

	    this.setCurrentBounds(meshCollector.boundingBox);

            meshCollector.setOldValue(false); // Ensure outlines shown.

	    // Helper. Uncomment next line for bounding boxes:
	    //this.opaqueObject.add(new THREE.Box3Helper(meshCollector.boundingBox, 0xff0000));
	}
	else if(!skipDrawing) {
	    meshCollector.draw(false); // New part is not 'old'.
	    meshCollector.setVisible(true);
	}
    }
    else { // LDR sub-models:
	if(subStepHandler.current === -1) {
	    // We have just stepped into this sub-model: Set all previous steps to invisible (they are already marked as old):
	    if(!skipDrawing) {
		this.setVisibleUpTo(false, this.current);
            }
	}
	subStepHandler.nextStep(skipDrawing);
	if(subStepHandler.isAtPlacementStep()) {
	    // Add bounds:
	    if(!step.bounds) {
		let b = subStepHandler.steps[subStepHandler.length].accumulatedBounds;
		this.setCurrentBounds(b);
	    }

	    if(!skipDrawing) {
		this.setVisibleUpTo(true, this.current); // Show the invisible steps again.
	    }
	}
    }
    return true;
}

/*
 takes a step back in the building instructions (see nextStep()).
*/
LDR.StepHandler.prototype.prevStep = function(skipDrawing) {
    if(this.isAtPreStep()) {
	return false; // Can't move back (also. Prevent walking to pre-step)
    }

    this.manager.resetSelectedObjects();

    // Step down from placement step:
    if(this.isAtPlacementStep()) {
	if(!skipDrawing && this.hasExtraParts) { // Don't show extra parts:
            let mc = this.steps[this.length].meshCollector;
            mc.setVisible(false);
	}

	// Update all previous steps to be old:
	for(let i = 0; i < this.length-1; i++) {
            let step = this.steps[i];
	    let mc = step.meshCollector;
	    if(mc) {
		mc.draw(true);
	    }
	    let sh = step.stepHandler;
	    if(sh) {
		sh.updateMeshCollectors(true);
	    }
	}

        // Update current step to not be old:
        if(this.length > 0) {
            let step = this.steps[this.length-1];
            if(step.meshCollector) {
                step.meshCollector.setOldValue(false);
            }
        }
	
	this.current--;
	return true;
    }

    // Not at placement step:
    let step = this.steps[this.current];
    let subStepHandler = step.stepHandler;
    if(!subStepHandler) { // Remove standard step:
    	let meshCollector = step.meshCollector;
        if(!skipDrawing) {
            meshCollector.setVisible(false);
        }
	this.stepBack();
    }
    else { // There is a subStepHandler, so we have to step inside of it:
	if(subStepHandler.isAtPlacementStep() && !skipDrawing) {
	    this.setVisibleUpTo(false, this.current);
	}
	subStepHandler.prevStep(skipDrawing);
	if(subStepHandler.isAtPreStep()) {
	    if(!skipDrawing) {
		this.setVisibleUpTo(true, this.current);
            }
	    this.stepBack();
	}
    }
    return true;
}

LDR.StepHandler.prototype.stepBack = function() {    
    this.current--;
    if(this.current === -1) {
	if(this.isForMainModel) {
	    this.nextStep(); // Ensure main step handler can't go back to placement step.
	}
	return;
    }
    let step = this.steps[this.current];
    let mc = step.meshCollector;
    if(mc) {
	mc.draw(false);
    }
    let sh = step.stepHandler;
    if(sh) {
	sh.updateMeshCollectors(false);
    }
}

LDR.StepHandler.prototype.moveTo = function(to) {
    let self = this;

    let currentStep = this.getCurrentStepIndex();
    let steps = to - currentStep;

    let step = steps > 0 ? () => self.nextStep(true) : () => self.prevStep(true);

    const oneStep = steps > 0 ? 1 : -1;
    while(steps !== 0 && step()) {
        steps-=oneStep;
    }

    this.cleanUpAfterWalking();
}

/*
This function is for setting correct visibility after having stepped without updating visibilities:
*/
LDR.StepHandler.prototype.cleanUpAfterWalking = function() {
    let step = this.current === -1 ? new LDR.StepInfo() : this.steps[this.current];
    let subStepHandler = step.stepHandler;
    if(subStepHandler) {
	subStepHandler.cleanUpAfterWalking(); // Clean up visiility of all sub models.
    }

    if(subStepHandler && !subStepHandler.isAtPlacementStep()) {
	// Currently showing a subStepHandler not at its placement step: Clear everything else!
	for(let i = 0; i < this.length; i++) {
            let s = this.steps[i];
	    let mc = s.meshCollector;
	    if(mc && mc.isVisible()) {
		mc.setVisible(false);
	    }
	    let sh = s.stepHandler;
	    if(sh && i !== this.current) {
		sh.setVisible(false);
	    }
	}
	if(this.hasExtraParts) {
            let s = this.steps[this.length];
            if(s.meshCollector) {
                s.meshCollector.setVisible(false);
            }
	}
    }
    else {
	// Currently in a non-subStepHandler step, or placement step:
	for(let i = 0; i < this.length; i++) {
	    let v = i <= this.current; // Make everything up to current step visible.

            let s = this.steps[i];
	    let mc = s.meshCollector;
	    if(mc) {// && mc.isVisible() !== v) {
		mc.setVisible(v);
	    }
	    let sh = s.stepHandler;
	    if(sh) {
		sh.setVisible(v);
	    }
	}
	if(this.hasExtraParts) {
            let s = this.steps[this.length];
            if(s.meshCollector) {
                s.meshCollector.setVisible(this.isAtPlacementStep());
            }
	}
    }
}

LDR.StepHandler.prototype.getCurrentStepInfo = function() {
    let step = this.steps[this.current];
    let subStepHandler = step.stepHandler;
    if(!subStepHandler || subStepHandler.isAtPlacementStep()) {
	return [this.part, this.current, step];
    }
    return subStepHandler.getCurrentStepInfo();
}

LDR.StepHandler.prototype.getCurrentStepHandler = function() {
    let step = this.steps[this.current];
    let subStepHandler = step.stepHandler;
    if(!subStepHandler || subStepHandler.isAtPlacementStep()) {
	return this;
    }
    return subStepHandler.getCurrentStepHandler();
}

LDR.StepHandler.prototype.getCurrentStep = function() {
    return this.getCurrentStepInfo()[2].step;
}

LDR.StepHandler.prototype.getGlowObjects = function(map) {
    for(let i = 0; i <= this.current; i++) {
        let step = this.steps[i];
	let mc = step.meshCollector;
	if(mc) {
	    mc.getGlowObjects(map);
	    continue;
	}
	let sh = step.stepHandler;
	if(sh) {
	    sh.getGlowObjects(map);
	}
    }
}

LDR.StepHandler.prototype.getMultiplierOfCurrentStep = function() {
    let step = this.steps[this.current];
    let subStepHandler = step.stepHandler;
    let ret = this.partDescs.length;
    if(!subStepHandler || subStepHandler.isAtPlacementStep()) {
	return ret; // If a subStepHandler is not active (or at placement step), then return the number of parts this subStepHandler returns. 
    }
    return ret * subStepHandler.getMultiplierOfCurrentStep();
}

/*
  Determine if the rotation icon should e shown for the current step.
 */
LDR.StepHandler.prototype.getShowRotatorForCurrentStep = function() {
    let step = this.steps[this.current];
    let subStepHandler = step.stepHandler;
    if(subStepHandler && !subStepHandler.isAtPlacementStep()) {
        return subStepHandler.getShowRotatorForCurrentStep(); // Let sub step handler handle it.
    }
    if(this.current === 0) {
        return false; // No rotator for first step.
    }
    if(THREE.LDRStepRotation.equals(step.step.rotation, this.steps[this.current-1].step.rotation)) {
        return false; // No rotator for steps without change in rotation.
    }
    return (step.step && step.step.rotation) || this.steps[this.current-1].step.rotation;
}

LDR.BackgroundColors = Array("FFFFFF", "FFFF88", "CCFFCC", "FFBB99", "99AAFF", "FF99FF", "D9FF99", "FFC299");
LDR.StepHandler.prototype.getBackgroundColorOfCurrentStep = function() {
    let level = this.getLevelOfCurrentStep();
    return LDR.BackgroundColors[level%LDR.BackgroundColors.length];
}

LDR.StepHandler.prototype.getLevelOfCurrentStep = function() {
    if(this.current === -1) {
	console.warn('Level of pre-step is not valid!');
        return 0;
    }
    let step = this.steps[this.current];
    let subStepHandler = step.stepHandler;
    if(!subStepHandler || subStepHandler.isAtPlacementStep()) {
	return 0;
    }
    return 1+subStepHandler.getLevelOfCurrentStep();
}

LDR.StepHandler.prototype.getAccumulatedBounds = function() {
    if(this.isAtPreStep()) {
        throw "Can't get bounds for pre step!";
    }
    let step = this.steps[this.current];
    let subStepHandler = step.stepHandler;
    if(subStepHandler && !subStepHandler.isAtPlacementStep()) {
	let ret = subStepHandler.getAccumulatedBounds();
	if(ret) {
	    return ret;
        }
    }
    return step.accumulatedBounds;
}

LDR.StepHandler.prototype.getBounds = function() {
    let step = this.steps[this.current];
    let subStepHandler = step.stepHandler;
    if(subStepHandler && !subStepHandler.isAtPlacementStep()) {
	let ret = subStepHandler.getBounds();
	if(ret) {
	    return ret;
        }
    }
    return step.bounds;
}

LDR.StepHandler.prototype.setCurrentBounds = function(b) {
    let step = this.steps[this.current];
    if(this.current === 0) {
	if(!b) {
	    throw "Illegal state: Empty first step!";
        }
	step.accumulatedBounds = step.bounds = b;
	return;
    }
    step.bounds = b;

    let prevAccumulatedBounds = new THREE.Box3();
    prevAccumulatedBounds.copy(this.steps[this.current-1].accumulatedBounds);
    step.accumulatedBounds = prevAccumulatedBounds;
    if(b) {
	step.accumulatedBounds.expandByPoint(b.min);
	step.accumulatedBounds.expandByPoint(b.max);
    }
}

LDR.StepHandler.prototype.drawExtras = function() {
    let step = this.steps[this.length];
    if(!this.hasExtraParts) { // No extra parts to draw: Copy bounds from previous step:
	if(!step.bounds) {
	    let prevStep = this.steps[this.length-1];
	    step.accumulatedBounds = prevStep.accumulatedBounds;
	    step.bounds = prevStep.bounds;
	}
	return; // Done.
    }

    if(!step.meshCollector) { // Not already loaded
	let meshCollector = new LDR.MeshCollector(this.opaqueObject, this.sixteenObject, this.transObject, this.manager);
        step.meshCollector = meshCollector;

	let prevAccumulatedBounds = new THREE.Box3();
	prevAccumulatedBounds.copy(this.steps[this.length-1].accumulatedBounds);
	step.bounds = step.accumulatedBounds = prevAccumulatedBounds;

	// Add all extra parts to mesh collector:
	for(let i = 1; i < this.partDescs.length; i++) {
	    let pd = this.partDescs[i];
	    // Here it is not necessary to run any "geometryBuilder.buildPart..." due to all parts having already been loaded when the first submodel was built.
	    this.part.generateThreePart(this.loader, pd.c, pd.p, pd.r, true, false, step.meshCollector);
	}

        meshCollector.setOldValue(false); // Ensure outlines shown.

	let b = step.meshCollector.boundingBox;
	step.accumulatedBounds.expandByPoint(b.min);
	step.accumulatedBounds.expandByPoint(b.max);
    }
    else if(this.hasExtraParts) {
	step.meshCollector.setVisible(true); // Show extra parts.
    }
}

LDR.StepHandler.prototype.isAtPreStep = function() {
    return this.current === -1;
}

LDR.StepHandler.prototype.isAtFirstStep = function() {
    if(this.current !== 0) {
        return false;
    }
    let subStepHandler = this.steps[0].stepHandler;
    return !subStepHandler || subStepHandler.isAtFirstStep();
}

LDR.StepHandler.prototype.isAtPlacementStep = function() {
    return this.current === this.length;
}

LDR.StepHandler.prototype.isAtLastStep = function() {
    if(this.isAtPlacementStep()) {
	return true;
    }
    if(this.current < this.length-1) {
	return false;
    }
    let subStepHandler = this.steps[this.current].stepHandler;
    return !subStepHandler || subStepHandler.isAtPlacementStep();    
}

LDR.StepHandler.prototype.setVisibleUpTo = function(v, idx) {
    for(let i = 0; i < idx; i++) {
        let step = this.steps[i];
	let mc = step.meshCollector;
	if(mc) {
	    mc.setVisible(v);
	    continue;
	}
	let sh = step.stepHandler;
	if(sh) {
	    sh.setVisible(v);
	}
    }
}

LDR.StepHandler.prototype.setVisible = function(v) {
    this.setVisibleUpTo(v, this.length);
    if(!this.hasExtraParts) {
        return;
    }
    let mc = this.steps[this.length].meshCollector;
    if(mc) {
        mc.setVisible(v);
    }
}

LDR.StepHandler.prototype.updateMeshCollectors = function(old) {
    for(let i = 0; i < this.length; i++) {
        let step = this.steps[i];
	let mc = step.meshCollector;
	if(mc) {
	    let tOld = old;
	    if(tOld === undefined) {
		tOld = mc.old;
            }
	    mc.draw(tOld);
	}
	let sh = step.stepHandler;
	if(sh) {
	    sh.updateMeshCollectors(old);
	}
    }
    if(this.hasExtraParts) {
        let mc = this.steps[this.length].meshCollector;
        if(mc) {
            let tOld = old;
            if(tOld === undefined) {
                tOld = mc.old;
            }
            mc.draw(tOld);
        }
    }
}
