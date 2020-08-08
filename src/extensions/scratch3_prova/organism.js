let _TextEncoder;
if (typeof TextEncoder === 'undefined') {
    _TextEncoder = require('text-encoding').TextEncoder;
} else {
    /* global TextEncoder */
    _TextEncoder = TextEncoder;
}

const Vehicle = require('./vehicle');
const Vector2 = require('../../util/vector2');
const svgen = require('../../util/svg-generator');
const {loadCostume} = require('../../import/load-costume.js');

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

class Organism extends Vehicle {
    /**
     * Class Organism
     * @param {RenderedTarget} target_ target (sprite)
     * @param {number} mass_ mass of the vehicle
     * @param {number} maxForce_ max force of the vehicle
     * @param {string} svg_  new svg of the organism
     * @param {Array} dna dna
     */
    constructor (target_, mass_ = 1, maxForce_ = 0.5, svg_, dna) {
        super(target_, mass_, maxForce_);
        this.svg = svg_;
        this.health = 1;
        this.renderer = this.target.renderer;
        this.runtime = this.target.runtime;
        this.storage = this.runtime.storage;
        this.mr = 0.01;
        
        this.dna = [];

        if (dna) {
            // Mutation
            this.dna[0] = dna[0];
            if (Math.random() < this.mr) {
                this.dna[0] += this.rdn(-0.1, 0.1);
            }
            this.dna[1] = dna[1];
            if (Math.random() < this.mr) {
                this.dna[1] += this.rdn(-0.1, 0.1);
            }
            this.dna[2] = dna[2];
            if (Math.random() < this.mr) {
                this.dna[2] += this.rdn(-10, 10);
            }
            this.dna[3] = dna[3];
            if (Math.random() < this.smr) {
                this.dna[3] += this.rdn(-10, 10);
            }
        } else {
            this.dna[0] = (Math.random() * 10) - 5; // food attraction
            this.dna[1] = (Math.random() * 10) - 5; // poison attraction
            this.dna[2] = Math.random() * 150; // food perception
            this.dna[3] = Math.random() * 150; // poison perception
        }
        
        this.svg = new svgen(130, 130).generateMultiple(this.dna[0], this.dna[1], 5);
        this.uploadCostumeEdit(this.svg, this.target.id);
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
     * Create a clone of a given target
     */
    createClone () {
        // Set clone target
        const cloneTarget = this.target;
            
        // If clone target is not found, return
        if (!cloneTarget) return;

        // Create clone
        this.target = cloneTarget.makeClone();
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
     * @param {Map} list food or poison
     * @param {number} nutrition value for health
     * @param {number} perception distance to see object
     * @returns {Vector2} steer force
     */
    eat (list, nutrition, perception) {
        let record = Infinity;
        let closest = null;
        const stageW = this.target.runtime.constructor.STAGE_WIDTH;
        const stageH = this.target.runtime.constructor.STAGE_HEIGHT;

        for (const f of list.values()) {
            const d = new Vector2(f.x, f.y).dist(new Vector2(this.target.x, this.target.y));

            // If is close to food (eat) change the position if is original
            // otherwise delete the clone
            // Easier
            if (d < 30) { // (this.isTouchingObject(f)) { // there is no isTouchingSprite() with a specific ID
                this.health += nutrition;
                if (f.isOriginal) {
                    f.setXY((Math.random() - 0.5) * stageW, (Math.random() - 0.5) * stageH);
                } else {
                    this.target.runtime.disposeTarget(f);
                    this.target.runtime.stopForTarget(f);
                    list.delete(f.id);
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
        this.health -= 0.005;
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
        
}

module.exports = Organism;
