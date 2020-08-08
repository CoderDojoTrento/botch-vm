let _TextEncoder;
if (typeof TextEncoder === 'undefined') {
    _TextEncoder = require('text-encoding').TextEncoder;
} else {
    /* global TextEncoder */
    _TextEncoder = TextEncoder;
}

/* eslint-disable no-negated-condition */
const ArgumentType = require('../../extension-support/argument-type');
const BlockType = require('../../extension-support/block-type');
const Cast = require('../../util/cast');
const MathUtil = require('../../util/math-util');
const log = require('../../util/log');
const Vehicle = require('./vehicle');
const Organism = require('./organism');
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

class Scratch3Prova {
    constructor (runtime) {
        this.runtime = runtime;
        this.child = '';
        this.vehicleMap = new Map();
        this.organismMap = new Map();
        this.inhabitantsMap = new Map();
        this.storage = runtime.storage;
        this.food = new Map();
        this.poison = new Map();
        this.maxForce = 0.5;
        this.mass = 1;
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

    getInfo () {
        return {
            id: 'prova',
            name: 'Prova',
            blocks: [
                {
                    opcode: 'crossover',
                    blockType: BlockType.COMMAND,
                    text: 'crossover [TEXT_1] with [TEXT_2]',
                    arguments: {
                        TEXT_1: {
                            type: ArgumentType.STRING,
                            defaultValue: 'abcde'
                        },
                        TEXT_2: {
                            type: ArgumentType.STRING,
                            defaultValue: 'fghilm'
                        }
                    }
                },
                {
                    opcode: 'var1',
                    blockType: BlockType.REPORTER,
                    text: 'child',
                    arguments: {
                        TEXT: {
                            type: ArgumentType.STRING,
                            defaultValue: 'aaaaa'
                        }
                    }
                },
                {
                    opcode: 'seek',
                    blockType: BlockType.COMMAND,
                    text: 'seek [TARGET] with mass [MASS] and agility [AGILITY]',
                    arguments: {
                        TARGET: {
                            type: ArgumentType.STRING,
                            menu: 'getSprite'
                        },
                        MASS: {
                            type: ArgumentType.NUMBER,
                            defaultValue: 1
                        },
                        AGILITY: {
                            type: ArgumentType.NUMBER,
                            defaultValue: 0.3
                        }
                    }
                },
                {
                    opcode: 'behaviors',
                    blockType: BlockType.COMMAND,
                    text: 'behave'
                },
                {
                    opcode: 'createPopulation',
                    blockType: BlockType.COMMAND,
                    text: 'create population of [COPIES] copies',
                    arguments: {
                        COPIES: {
                            type: ArgumentType.NUMBER,
                            defaultValue: 1
                        }
                    }
                },
                {
                    opcode: 'defineFood',
                    blockType: BlockType.COMMAND,
                    text: 'generate max: [FOOD] food',
                    arguments: {
                        FOOD: {
                            type: ArgumentType.NUMBER,
                            defaultValue: 8
                        }
                    }
                },
                {
                    opcode: 'definePoison',
                    blockType: BlockType.COMMAND,
                    text: 'generate max: [POISON] poison',
                    arguments: {
                        POISON: {
                            type: ArgumentType.NUMBER,
                            defaultValue: 2
                        }
                    }
                },
                {
                    opcode: 'createFood',
                    blockType: BlockType.COMMAND,
                    text: 'add new food with [FREQUENCY] %',
                    arguments: {
                        FREQUENCY: {
                            type: ArgumentType.NUMBER,
                            defaultValue: 5
                        }
                    }
                },
                {
                    opcode: 'createPoison',
                    blockType: BlockType.COMMAND,
                    text: 'add new poison with [FREQUENCY] %',
                    arguments: {
                        FREQUENCY: {
                            type: ArgumentType.NUMBER,
                            defaultValue: 2
                        }
                    }
                }
            ],
            menus: {
                getSprite: {
                    acceptReporters: true,
                    items: 'getSpriteMenu'
                }
            }
        };
    }

    getSpriteMenu () {
        // TODO remove _editingTarget from menu
        if (this.runtime.targets.length > 1) {
            return this.runtime.targets.filter(t => t.isOriginal && !t.isStage).map(t => t.getName());
        }
    }

    var1 () {
        return this.child;
    }

    crossover (args, util) {
        console.log(this);
        console.log(args);
        console.log(util);

        const text1 = Cast.toString(args.TEXT_1);
        const text2 = Cast.toString(args.TEXT_2);
        this.child = text1.slice(0, (text1.length / 2)) + text2.slice(text2.length / 2, text2.length);
        log.log(this.child);
    }

    /**
     * Point towards the target (SAME AS pointtowards())
     */

    point (args, util) {
        let targetX = 0;
        let targetY = 0;
        
        args.TARGET = Cast.toString(args.TARGET);
        const pointTarget = this.runtime.getSpriteTargetByName(args.TARGET);
        if (!pointTarget) return;
        targetX = pointTarget.x;
        targetY = pointTarget.y;
        

        const dx = targetX - util.target.x;
        const dy = targetY - util.target.y;
        const direction = 90 - MathUtil.radToDeg(Math.atan2(dy, dx));
        util.target.setDirection(direction);
    }

    /**
     * Function seek,
     * http://www.red3d.com/cwr/steer/gdc99/
     * https://natureofcode.com/book/chapter-6-autonomous-agents/
     */

    seek (args, util) {

        /*
        Per ora evito ed elimino i possibili organismi
        this.refreshOrganismMap(util.target.id);
        // if there is no organism, seek works with common sprites
        if (!this.organismMap.get(util.target.id)) {
            this.seekVehicle(args, util);
        } else {
            this.seekOrganism(args, util);
        } */
        this.organismMap = new Map();
        this.seekVehicle(args, util);
    }

    seekOrganism (args, util) {
        // This line can be more efficient TODO
        this.organismMap.get(util.target.id).refreshArgs(args.MASS, args.AGILITY);

        // Get the target position
        const pointTarget = this.runtime.getSpriteTargetByName(args.TARGET);
        if (!pointTarget) return;
        const targetX = pointTarget.x;
        const targetY = pointTarget.y;

        this.organismMap.get(util.target.id).seek(targetX, targetY);
        this.organismMap.get(util.target.id).update();
        this.organismMap.get(util.target.id).pointTarget();
    }

    seekVehicle (args, util) {
        // Check if is already instantiated
        if (!this.vehicleMap.get(util.target.id)) {
            this.vehicleMap.set(util.target.id, (
                new Vehicle(
                    util.target, parseFloat(args.MASS),
                    parseFloat(args.AGILITY)
                )
            ));
        } else {
            // This line can be more efficient ?
            this.vehicleMap.get(util.target.id).refreshArgs(args.MASS, args.AGILITY);

            // Get the target position
            const pointTarget = this.runtime.getSpriteTargetByName(args.TARGET);
            if (!pointTarget) return;
            const targetX = pointTarget.x;
            const targetY = pointTarget.y;

            this.vehicleMap.get(util.target.id).seek(targetX, targetY);
            this.vehicleMap.get(util.target.id).update();
            this.vehicleMap.get(util.target.id).pointTarget();
        }
    }

    /**
     * Behave with the food and poison
     * @param {args} args args
     * @param {util} util util
     * @returns {string} message
     */
    behaviors (args, util) {
        if (this.poison.size > 0 && this.food.size > 0) {
            if (this.organismMap.size > 1) {
                for (const org of this.organismMap.values()) {
                    if (!org.target.isOriginal) { // Only the clones are managed
                        org.boundaries(
                            this.runtime.constructor.STAGE_WIDTH,
                            this.runtime.constructor.STAGE_HEIGHT);
                        org.refreshArgs(this.mass, this.maxForce);
                        org.behaviors(this.food, this.poison);
                        org.update();

                        const newOrg = org.clone();
                        if (newOrg !== null) {
                            const newClone = this.createClone(org.target);
                            if (newClone) {
                                this.runtime.addTarget(newClone);
                                newOrg.target = newClone;
                            }
                            this.organismMap.set(newClone.id, newOrg);
                        }

                        if (org.dead()) {
                            this.runtime.disposeTarget(org.target);
                            this.runtime.stopForTarget(org.target);
                            this.organismMap.delete(org.target.id);

                            // when an organism die, it will drop a food
                            this.createFoodXY(org.target.x, org.target.y);
                        }
                    }
                }
            } else {
                util.target.setVisible(true);
                this.runtime.stopAll();
                return 'There is no organism';
            }
        } else {
            return 'I need food or poison';
        }
    }

    createPopulation (args, util) {
        this.deleteClones(util.target.id);
        util.target.goToFront();
        this.organismMap = new Map();

        let org = new Organism(
            util.target, this.mass, this.maxForce);

        // change the costume of the original sprite
        const newSvg = new svgen(130, 130).generateMultiple(org.dna[0], org.dna[1], 5);

        org.svg = newSvg;

        this.organismMap.set(util.target.id, org); // check if is need to delete this entry somewhere TODO

        this.uploadCostumeEdit(newSvg, util.target.id);
        
        util.target.setVisible(false); // hide the original

        const copies = Cast.toString(args.COPIES);
        if (copies > 0 && copies <= 30) {
            for (let i = 0; i < copies; i++) {
                // Create clone
                const newClone = this.createClone(util.target);
                if (newClone) {
                    newClone.setVisible(true);
                    this.runtime.addTarget(newClone);

                    // Place behind the original target.
                    newClone.goBehindOther(util.target);
                    // Set a random size
                    newClone.setSize((Math.random() * 100) + 30);
                    
                    // place the new clone in a random position
                    const stageW = this.runtime.constructor.STAGE_WIDTH;
                    const stageH = this.runtime.constructor.STAGE_HEIGHT;
                    newClone.setXY((Math.random() - 0.5) * stageW, (Math.random() - 0.5) * stageH);

                    org = new Organism(newClone, this.mass, this.maxForce);

                    this.organismMap.set(newClone.id, org);
                }
            }
        }
    }

    /**
     * Delete all the clones of a target
     * @param {string} id id of the target (not a clone)
     */
    deleteClones (id) {
        const clones = this.getClones(id);
        clones.forEach(c => {
            this.runtime.disposeTarget(c);
            this.runtime.stopForTarget(c);
        });
    }

    /**
     * Get all the clones (only) of the selected target (not a clone)
     * @param {string} id id of the target
     * @returns {clones[]} list of clones
     */
    getClones (id) {
        // Select all the clone of the sprite
        return this.runtime.targets.filter(
            t => !t.isOriginal && !t.isStage && t.sprite.clones[0].id === id
        );
    }

    /**
     * Create a clone of a given target
     * @param {target} target target
     * @returns {clone} new clone
     */
    createClone (target) {
        // Set clone target
        const cloneTarget = target;
            
        // If clone target is not found, return
        if (!cloneTarget) return;

        // Create clone
        return cloneTarget.makeClone();
    }

    /**
     * Create clones of the selected sprite as "food"
     * @param {*} args args
     * @param {*} util util
     */
    defineFood (args, util) {
        this.deleteClones(util.target.id);
        this.food = new Map();
        this.food.set(util.target.id, util.target);

        const foodN = (Math.random() * (args.FOOD - 1));
        for (let i = 0; i < foodN; i++) {
            // Create clone
            const newClone = this.createClone(util.target);
            if (newClone) {
                this.runtime.addTarget(newClone);

                // Place behind the original target.
                newClone.goBehindOther(util.target);
                    
                const stageW = this.runtime.constructor.STAGE_WIDTH;
                const stageH = this.runtime.constructor.STAGE_HEIGHT;
                // Move in a random position and avoid that anyone is touching the other
                let maxIt = 20; // Max 20 try to find a place where is not touch other clones
                while (newClone.isTouchingSprite(util.target.sprite.name) && maxIt > 0) {
                    newClone.setXY((Math.random() - 0.5) * stageW, (Math.random() - 0.5) * stageH);
                    maxIt--;
                }
                this.food.set(newClone.id, newClone);
            }
        }
    }

    /**
     * Create clones of the selected sprite as "poison"
     * @param {*} args args
     * @param {*} util util
     */
    definePoison (args, util) {
        this.deleteClones(util.target.id);
        this.poison = new Map();
        this.poison.set(util.target.id, util.target);

        const poiN = (Math.random() * (args.POISON - 1));
        for (let i = 0; i < poiN; i++) {
            // Create clone
            const newClone = this.createClone(util.target);
            if (newClone) {
                this.runtime.addTarget(newClone);

                // Place behind the original target.
                newClone.goBehindOther(util.target);
                
                const stageW = this.runtime.constructor.STAGE_WIDTH;
                const stageH = this.runtime.constructor.STAGE_HEIGHT;
                // Move in a random position and avoid that anyone is touching the other
                let maxIt = 20; // Max 20 try to find a place where is not touch other clones
                while (newClone.isTouchingSprite(util.target.sprite.name) && maxIt > 0) {
                    newClone.setXY((Math.random() - 0.5) * stageW, (Math.random() - 0.5) * stageH);
                    maxIt--;
                }
                this.poison.set(newClone.id, newClone);
            }
        }
    }

    /**
     * Create a food in x, y
     * @param {number} x x coordinate
     * @param {number} y y coordinate
     */
    createFoodXY (x, y) {
        const first = this.food.values().next().value;
        const newClone = this.createClone(first);
        if (newClone) {
            newClone.setXY(x, y);
            this.runtime.addTarget(newClone);
            newClone.goBehindOther(first);
            this.food.set(newClone.id, newClone);
        }
    }

    createFood (args, util) {
        if (this.food.size < 1) {
            return 'I need a definition';
        }
        const fr = parseFloat(args.FREQUENCY) / 100;
        if (args.FREQUENCY !== 0 && (Math.random() < fr)) {
            const newClone = this.createClone(util.target);
            if (newClone) {
                this.runtime.addTarget(newClone);

                // Place behind the original target.
                newClone.goBehindOther(util.target);
                    
                const stageW = this.runtime.constructor.STAGE_WIDTH;
                const stageH = this.runtime.constructor.STAGE_HEIGHT;
                // Move in a random position and avoid that anyone is touching the other
                let maxIt = 20; // Max 20 try to find a place where is not touch other clones
                while (newClone.isTouchingSprite(util.target.sprite.name) && maxIt > 0) {
                    newClone.setXY((Math.random() - 0.5) * stageW, (Math.random() - 0.5) * stageH);
                    maxIt--;
                }
                this.food.set(newClone.id, newClone);
            }
        }
        
    }

    createPoison (args, util) {
        if (this.food.size < 1) {
            return 'I need a definition';
        }
        const fr = parseFloat(args.FREQUENCY) / 100;
        if (args.FREQUENCY !== 0 && (Math.random() < fr)) {
            const newClone = this.createClone(util.target);
            if (newClone) {
                this.runtime.addTarget(newClone);

                // Place behind the original target.
                newClone.goBehindOther(util.target);
                    
                const stageW = this.runtime.constructor.STAGE_WIDTH;
                const stageH = this.runtime.constructor.STAGE_HEIGHT;
                // Move in a random position and avoid that anyone is touching the other
                let maxIt = 20; // Max 20 try to find a place where is not touch other clones
                while (newClone.isTouchingSprite(util.target.sprite.name) && maxIt > 0) {
                    newClone.setXY((Math.random() - 0.5) * stageW, (Math.random() - 0.5) * stageH);
                    maxIt--;
                }
                this.poison.set(newClone.id, newClone);
            }
        }
        
    }
}

module.exports = Scratch3Prova;
