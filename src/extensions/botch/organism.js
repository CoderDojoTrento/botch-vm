let _TextEncoder;
if (typeof TextEncoder === 'undefined') {
    _TextEncoder = require('text-encoding').TextEncoder;
} else {
    /* global TextEncoder */
    _TextEncoder = TextEncoder;
}

const Vector2 = require('../../util/vector2');
const MathUtil = require('../../util/math-util');
const svgen = require('../../util/svg-generator');
const {loadCostume} = require('../../import/load-costume.js');
const Enemy = require('./enemy');

/*
 * Create the new costume asset for the VM
 */
const createVMAsset = function (storage, assetType, dataFormat, data) {
    const asset = storage.createAsset(
        assetType,
        dataFormat,
        data,
        null,
        true // generate md5
    );

    return {
        name: null, // Needs to be set by caller
        dataFormat: dataFormat,
        asset: asset,
        md5: `${asset.assetId}.${dataFormat}`,
        assetId: asset.assetId
    };
};

class Organism {
    /**
     * Class Organism
     * @param {RenderedTarget} target_ target (sprite)
     * @param {number} mass_ mass of the vehicle
     * @param {number} maxForce_ max force of the vehicle
     * @param {string} svg_  new svg of the organism
     * @param {Array} dna dna
     */
    constructor (target_, mass_ = 1, maxForce_ = 0.5, svg_, dna) {
        this.acceleration = new Vector2(0, 0);
        this.velocity = new Vector2(0, 2);
        this.position = new Vector2(target_.x, target_.y);
        this.maxSpeed = 5;
        this.maxForce = maxForce_; // agility ?
        this.target = target_;
        this.mass = mass_;
        this.svg = svg_;
        this.health = 1;
        this.renderer = this.target.renderer;
        this.runtime = this.target.runtime;
        this.storage = this.runtime.storage;
        this.mr = 0.01;
        this.living = 0; // performance.now();
        this.effectStep = 7;
        this.currEffectStep = this.effectStep;
        this.effectSign = 1;

        this.dna = [];

        if (dna) {
            // Mutation
            this.dna[0] = dna[0];
            if (Math.random() < this.mr) {
                this.dna[0] += this.rdn(-0.3, 0.3);
            }
            this.dna[1] = dna[1];
            if (Math.random() < this.mr) {
                this.dna[1] += this.rdn(-0.3, 0.3);
            }
            this.dna[2] = dna[2];
            if (Math.random() < this.mr) {
                this.dna[2] += this.rdn(-15, 15);
            }
            this.dna[3] = dna[3];
            if (Math.random() < this.smr) {
                this.dna[3] += this.rdn(-15, 15);
            }
        } else {
            this.dna[0] = (Math.random() * 10) - 5; // food attraction
            this.dna[1] = (Math.random() * 10) - 5; // poison attraction
            this.dna[2] = Math.random() * 150; // food perception
            this.dna[3] = Math.random() * 150; // poison perception
        }

        this.svg = new svgen(130, 130).generateMultiple(this.dna[0], this.dna[1], 5);
        this.uploadCostumeEdit(this.svg, this.target.id);

        // Variable assignment to the sprite
        // each clone has the its own dna saved and the dna of the non-clone target
        this.target.lookupOrCreateList(this.target.id, `dna_${this.target.id}`);
        const list = this.target.lookupOrCreateList(
            this.target.id, `dna_${this.target.id}`);
        this.dna.forEach(element => {
            list.value.push(element);
        });
        list._monitorUpToDate = false;
    }

    // <LOAD COSTUMES METHODS>

    /**
     * COPIED AND ADAPTED FROM virtual-machine.js
     * Add a costume to the current editing target.
     * @param {string} md5ext - the MD5 and extension of the costume to be loaded.
     * @param {!object} costumeObject Object representing the costume.
     * @param {string} optTargetId - the id of the target to add to, if not the editing target.
     * @param {string} optVersion - if this is 2, load costume as sb2, otherwise load costume as sb3.
     * @returns {?Promise} - a promise that resolves when the costume has been added
     */
    addCostume (md5ext, costumeObject, optTargetId, optVersion) {
        const target = optTargetId ? this.runtime.getTargetById(optTargetId) :
            this.runtime.getEditingTarget();
        if (target) {
            return loadCostume(md5ext, costumeObject, this.runtime, optVersion).then(() => {
                target.addCostume(costumeObject);
                target.setCostume(
                    target.getCostumes().length - 1
                );
                this.runtime.emitProjectChanged();
            });
        }
        // If the target cannot be found by id, return a rejected promise
        return Promise.reject();
    }

    handleNewCostume (costume, id) {
        const costumes = Array.isArray(costume) ? costume : [costume];
        return Promise.all(costumes.map(c => this.addCostume(c.md5, c, id)));
    }

    handleCostume (vmCostumes, id) {
        vmCostumes.forEach((costume, i) => {
            costume.name = `${i}${i ? i + 1 : ''}`;
        });
        this.handleNewCostume(vmCostumes, id); // Tolto .then(
    }

    addCostumeFromBuffer (dataBuffer, id) {
        const costumeFormat_ = this.storage.DataFormat.SVG;
        const assetType_ = this.storage.AssetType.ImageVector;
        const storage_ = this.storage;
        const vmCostume = createVMAsset(
            storage_,
            assetType_,
            costumeFormat_,
            dataBuffer
        );
        this.handleCostume([vmCostume], id);
    }

    /**
     * Assign a new costume (SVG) to the selected target (id)
     * @param {string} fileData string of the svg
     * @param {string?} id id of the target
     */
    uploadCostumeEdit (fileData, id) {
        this.addCostumeFromBuffer(new Uint8Array((new _TextEncoder()).encode(fileData)), id);
    }

    // </LOAD COSTUMES METHODS>


    rdn (min, max) {
        return (Math.random() * (max - min)) + min;
    }

    /**
     * Since that the object will be instantiated only once, this function
     * will change the new arguments that will be passed.
     * UPDATE THE LOCATION IF THE SPRITE IS MANUALLY MOVED
     *
     * If we change manually the position, mass or maxForce of the sprite
     * @param {Number} x_
     * @param {Number} y_
     * @param {Number} mass_
     * @param {Number} maxForce_
     */

    refreshArgs (mass_, maxForce_) {
        this.position.x = parseFloat(this.target.x);
        this.position.y = parseFloat(this.target.y);
        this.mass = parseFloat(mass_);
        this.maxForce = parseFloat(maxForce_);
    }

    /**
     * Create a clone of a given target
     */
    createClone () {
        // Set clone target
        const cloneTarget = this.target;

        // If clone target is not found, return
        if (!cloneTarget) return;

        // Create clone
        this.target = cloneTarget.makeClone();
        
        // Reset the target effect
        this.target.clearEffect();
    }

    behaviors (good, bad) {
        const steerG = this.eat(good, 0.2, this.dna[2]);
        const steerB = this.eat(bad, -0.5, this.dna[3]);

        steerG.mult(this.dna[0]);
        steerB.mult(this.dna[1]);

        this.applyForce(steerG);
        this.applyForce(steerB);
    }

    /**
     * Eat the list passed and set the health of the organism
     * according to the nutrition
     * If the list passed is an enemy it will be treated differently
     * @param {Map} list food or poison
     * @param {number} nutrition value for health
     * @param {number} perception distance to see object
     * @returns {Vector2} steer force
     * @since botch-0.2
     */
    eat (list, nutrition, perception) {
        let record = Infinity;
        let closest = null;
        const stageW = this.target.runtime.constructor.STAGE_WIDTH;
        const stageH = this.target.runtime.constructor.STAGE_HEIGHT;
        let esc = 30;

        for (let f of list.values()) {
            let en = false;
            if (f instanceof Enemy) {
                f = f.target;
                en = true;
                esc = 10;
            }

            const d = new Vector2(f.x, f.y).dist(new Vector2(this.target.x, this.target.y));

            // If is close to food (eat) change the position if is original
            // otherwise delete the clone
            // Easier
            if (d < esc) { // (this.isTouchingObject(f)) { // there is no isTouchingSprite() with a specific ID
                if (en) {
                    this.health -= 0.1;
                } else {
                    this.health += nutrition;
                    if (f.isOriginal) {
                        f.setXY((Math.random() - 0.5) * stageW, (Math.random() - 0.5) * stageH);
                    } else {
                        this.target.runtime.disposeTarget(f);
                        this.target.runtime.stopForTarget(f);
                        list.delete(f.id);
                    }
                }
            } else if (d < record && d < perception) {
                record = d;
                closest = f;
            }
        }

        if (closest) {
            return this.seek(closest.x, closest.y);
        }

        return new Vector2(0, 0);
    }

    /**
     * Check if the sprite touch the object
     * @param {RenderedTarget} obj object to check if touched
     * @returns {boolean} true if is touched
     */
    isTouchingObject (obj) {
        if (!obj || !this.renderer) {
            return false;
        }
        if (this.renderer._allDrawables) {
            return this.renderer.isTouchingDrawables(
                this.target.drawableID, [obj.drawableID]);
        }
    }

    /**
     * Create a clone of itself "Parthenogenesis"
     * @returns {Organism} new copy Organism
     */
    clone () {
        if (/* !this.target.isOriginal &&  */Math.random() < 0.002) {
            return new Organism(this.target, 1, 0.5, this.svg, this.dna);
        }
        return null;
    }

    /**
     * Check if the organism is dead
     * @returns {boolean} dead or not
     */
    dead () {
        return (this.health < 0);
    }

    // A method that calculates a steering force towards a target
    // STEER = DESIRED MINUS VELOCITY
    // REDEFINE the method instead of applyForce it returns the steer
    seek (x, y) {
        const targetS = new Vector2(x, y);

        const desired = Vector2.sub(targetS,
            (new Vector2(this.target.x, this.target.y))); // A vector pointing from the location to the target

        // Scale to maximum speed
        desired.setMag(this.maxSpeed);

        // Steering = Desired minus velocity
        const steer = Vector2.sub(desired, this.velocity);
        steer.limit(this.maxForce); // Limit to maximum steering force

        this.pointTarget();

        return steer;
        // this.applyForce(steer);
    }

    // Method to update location
    update () {
        this.living += 0.001;
        this.health -= 0.005;
        this.breathe();
        // Update velocity
        this.velocity.add(this.acceleration);
        // Limit speed
        this.velocity.limit(this.maxSpeed);
        this.position.add(this.velocity);
        // Update sprite position
        this.target.setXY(this.position.x, this.position.y);
        // Reset acceleration 0 each cycle
        this.acceleration.mult(0);
    }

    applyForce (force) {
        // With mass
        const f = new Vector2(force.x, force.y);
        f.div(this.mass);

        this.acceleration.add(f);
    }

    /**
     * Point towards the target
    */

    pointTarget () {
        const direction = 90 - MathUtil.radToDeg(this.velocity.heading());
        this.target.setDirection(direction);
    }

    // Constrain the vehicles inside the stage
    boundaries (width, height) {
        const d = 5;

        let desired = null;

        if (this.target.x + (width / 2) < d) {
            desired = new Vector2(this.maxSpeed, this.velocity.y);
        } else if (this.position.x > (width / 2) - d) {
            desired = new Vector2(-this.maxSpeed, this.velocity.y);
        }

        if (this.position.y + (height / 2) < d) {
            desired = new Vector2(this.velocity.x, this.maxSpeed);
        } else if (this.position.y > (height / 2) - d) {
            desired = new Vector2(this.velocity.x, -this.maxSpeed);
        }

        if (desired !== null) {
            desired.normalize();
            desired.mult(this.maxSpeed);
            const steer = Vector2.sub(desired, this.velocity);
            steer.limit(this.maxForce);
            this.applyForce(steer);
        }
    }

    /**
     * Method copied from scratch_look.js
     * Limit for ghost effect
     * @const {object}
     * @since botch-0.2
     */
    static get EFFECT_GHOST_LIMIT (){
        return {min: 0, max: 100};
    }

    /**
     * Method copied from scratch_look.js
     * Limit for brightness effect
     * @const {object}
     * @since botch-0.2
     */
    static get EFFECT_BRIGHTNESS_LIMIT (){
        return {min: -100, max: 100};
    }

    /**
     * Method copied from scratch_look.js
     * @param {string} effect effect
     * @param {number} value value
     * @return {number} new value
     * @since botch-0.2
     */
    clampEffect (effect, value) {
        let clampedValue = value;
        switch (effect) {
        case 'ghost':
            clampedValue = MathUtil.clamp(value,
                Organism.EFFECT_GHOST_LIMIT.min,
                Organism.EFFECT_GHOST_LIMIT.max);
            break;
        case 'brightness':
            clampedValue = MathUtil.clamp(value,
                Organism.EFFECT_BRIGHTNESS_LIMIT.min,
                Organism.EFFECT_BRIGHTNESS_LIMIT.max);
            break;
        }
        return clampedValue;
    }

    /**
     * Change the effect of the target
     * @param {string} effect_ scratch effect
     * @param {number} value scratch effect value
     * @since botch-0.2
     */
    changeGraphicsEffect (effect_, value) {
        const effect = effect_.toLowerCase();
        if (!this.target.effects.hasOwnProperty(effect)) return;
        let newValue = value + this.target.effects[effect];
        newValue = this.clampEffect(effect, newValue);
        this.target.setEffect(effect, newValue);
    }

    /**
     * Mimic the "breath effect" with fisheye
     * @since botch-0.2
     */
    breathe () {
        if (this.currEffectStep > 0) {
            const change = 5 * this.effectSign;
            this.changeGraphicsEffect('fisheye', change);
            this.currEffectStep--;
        } else {
            this.currEffectStep = this.effectStep;
            this.effectSign *= -1;
        }
    }

}

module.exports = Organism;
