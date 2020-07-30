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
const Food = require('./food');
const Poison = require('./poison');
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
        this.food = [];
        this.poison = [];
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
                    text: 'define as food'
                },
                {
                    opcode: 'definePoison',
                    blockType: BlockType.COMMAND,
                    text: 'define as poison'
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
        this.refreshClonesMap(util.target.id);
        // if there is no organism, seek works with common sprites
        if (!this.organismMap.get(util.target.id)) {
            this.seekVehicle(args, util);
        } else {
            this.seekOrganism(args, util);
        }
    }

    seekOrganism (args, util) {
        // This line can be more efficient TODO
        this.organismMap.get(util.target.id).changeArgs(args.MASS, args.AGILITY);

        // Get the target position
        const pointTarget = this.runtime.getSpriteTargetByName(args.TARGET);
        if (!pointTarget) return;
        const targetX = pointTarget.x;
        const targetY = pointTarget.y;

        this.organismMap.get(util.target.id).seek(targetX, targetY);
        this.organismMap.get(util.target.id).update();
        this.point(args, util);
    }

    seekVehicle (args, util) {
        // Check if is already instantiated
        if (!this.vehicleMap.get(util.target.id)) {
            this.vehicleMap.set(util.target.id, (
                new Vehicle(
                    util.target.x, util.target.y, parseFloat(args.MASS),
                    parseFloat(args.AGILITY), util.target
                )
            ));
        } else {
            // This line can be more efficient TODO
            this.vehicleMap.get(util.target.id).changeArgs(args.MASS, args.AGILITY);

            // Get the target position
            const pointTarget = this.runtime.getSpriteTargetByName(args.TARGET);
            if (!pointTarget) return;
            const targetX = pointTarget.x;
            const targetY = pointTarget.y;

            this.vehicleMap.get(util.target.id).seek(targetX, targetY);
            this.vehicleMap.get(util.target.id).update();
            this.point(args, util);
        }
    }

    createPopulation (args, util) {
        this.deleteClones(util.target.id);
        this.refreshClonesMap(util.target.id); // reset the clones

        const copies = Cast.toString(args.COPIES);
        if (copies > 0 && copies <= 30) {
            for (let i = 0; i < copies; i++) {
                // Set clone target
                const cloneTarget = util.target;
                
                // If clone target is not found, return
                if (!cloneTarget) return;

                // Create clone
                const newClone = cloneTarget.makeClone();
                if (newClone) {
                    this.runtime.addTarget(newClone);

                    // Place behind the original target.
                    newClone.goBehindOther(cloneTarget);
                    // Set a random size
                    newClone.setSize((Math.random() * 100) + 30);
                    // Move back the clone to not overlap
                    newClone.setXY(util.target.x - (20 * i), util.target.y);

                    const newSvg = new svgen(100, 100).generateSVG();

                    this.organismMap.set(newClone.id, new Organism(
                        newClone.x, newClone.y, 1, 1, newClone, newSvg, 'dna'));

                    this.uploadCostumeEdit(newSvg, newClone.id);

                    // Add new costume to the new clone
                    // newClone.setCostume(1);
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
     * Refresh the clone Map
     * @param {string} id id of the target (not the clone)
     */
    refreshClonesMap (id) {
        this.organismMap = this.getCloneMap(id);
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
     * Return the clone map
     * @param {string} id the id of the target (not the clone)
     * @returns {Map<id, clone>} map of the clones
     */
    getCloneMap (id) {
        const clones = this.getClones(id);
        const map = new Map();
        clones.forEach(c => {
            map.set(c.id, c);
        });
        return map;
    }

    /**
     * Create clones of the selected sprite as "food"
     * @param {*} args args
     * @param {*} util util
     */
    defineFood (args, util) {
        this.deleteClones(util.target.id);
        this.food = [];
        this.food.push((new Food(util.target.x, util.target.y)));

        // Create maximum 7 clones
        const foodN = (Math.random() * 7) + 1;
        for (let i = 0; i < foodN; i++) {
            // Set clone target
            const cloneTarget = util.target;
            
            // If clone target is not found, return
            if (!cloneTarget) return;

            // Create clone
            const newClone = cloneTarget.makeClone();
            if (newClone) {
                this.runtime.addTarget(newClone);

                // Place behind the original target.
                newClone.goBehindOther(cloneTarget);
                
                const stageW = this.runtime.constructor.STAGE_WIDTH;
                const stageH = this.runtime.constructor.STAGE_HEIGHT;
                // Move in a random position and avoid that anyone is touching the other
                let maxIt = 20; // Max 20 try to find a place where is not touch other clones
                while (newClone.isTouchingSprite(util.target.sprite.name) && maxIt > 0) {
                    newClone.setXY((Math.random() - 0.5) * stageW, (Math.random() - 0.5) * stageH);
                    maxIt--;
                }
                this.food.push((new Food(newClone.x, newClone.y)));
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
        this.poison = [];
        this.poison.push((new Poison(util.target.x, util.target.y)));

        // Create maximum 5 clones
        const poiN = (Math.random() * 5) + 1;
        for (let i = 0; i < poiN; i++) {
            // Set clone target
            const cloneTarget = util.target;
            
            // If clone target is not found, return
            if (!cloneTarget) return;

            // Create clone
            const newClone = cloneTarget.makeClone();
            if (newClone) {
                this.runtime.addTarget(newClone);

                // Place behind the original target.
                newClone.goBehindOther(cloneTarget);
                
                const stageW = this.runtime.constructor.STAGE_WIDTH;
                const stageH = this.runtime.constructor.STAGE_HEIGHT;
                // Move in a random position and avoid that anyone is touching the other
                let maxIt = 20; // Max 20 try to find a place where is not touch other clones
                while (newClone.isTouchingSprite(util.target.sprite.name) && maxIt > 0) {
                    newClone.setXY((Math.random() - 0.5) * stageW, (Math.random() - 0.5) * stageH);
                    maxIt--;
                }
                this.poison.push((new Poison(newClone.x, newClone.y)));
            }
        }
    }
}

module.exports = Scratch3Prova;
