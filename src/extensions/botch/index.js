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
const Organism = require('./organism');
const svgen = require('../../util/svg-generator');
const {loadCostume} = require('../../import/load-costume.js');
const BotchStorageHelper = require('./botch-storage-helper.js');

const md5 = require('js-md5');

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

class Scratch3Botch {

    static get BOTCH_STORAGE_HELPER_UPDATE (){
        return 'BOTCH_STORAGE_HELPER_UPDATE';
    }

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
        this.storageHelper = new BotchStorageHelper(runtime.storage);
        runtime.storage.addHelper(this.storageHelper);
        console.log('Botch runtime:', runtime);
        console.log('Botch custom storageHelper:', this.storageHelper);

        window.BOTCH = this;
        // this.testStoreSprite()

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
            id: 'botch',
            name: 'Botch',
            blocks: [
                {
                    opcode: 'debugConsole',
                    blockType: BlockType.COMMAND,
                    text: 'console debug'
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
                },
                {
                    opcode: 'sayBest',
                    blockType: BlockType.COMMAND,
                    text: 'the best says [TEXT]',
                    arguments: {
                        TEXT: {
                            type: ArgumentType.STRING,
                            defaultValue: 'Best!'
                        }
                    }
                },
                {
                    opcode: 'foodAtt',
                    blockType: BlockType.REPORTER,
                    text: 'food att. best:'
                },
                {
                    opcode: 'poisonAtt',
                    blockType: BlockType.REPORTER,
                    text: 'poison att. best:'
                },
                {
                    opcode: 'foodDist',
                    blockType: BlockType.REPORTER,
                    text: 'food dist. best:'
                },
                {
                    opcode: 'poisonDist',
                    blockType: BlockType.REPORTER,
                    text: 'posion dist. best:'
                },
                {
                    opcode: 'health',
                    blockType: BlockType.REPORTER,
                    text: 'health best:'
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

    debugConsole (args, util) {
        console.log(this);
        console.log(args);
        console.log(util);
    }

    /**
     * Function seek,
     * http://www.red3d.com/cwr/steer/gdc99/
     * https://natureofcode.com/book/chapter-6-autonomous-agents/
     */

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


    /**  Copied from virtual-machine.js
     * @param {object} fileDescs serialized jsons
     * @param {JSZip} zip zip to add stuff to.
     * @since botch-0.1
     */
    _addFileDescsToZip (fileDescs, zip) {
        for (let i = 0; i < fileDescs.length; i++) {
            const currFileDesc = fileDescs[i];
            zip.file(currFileDesc.fileName, currFileDesc.fileContent);
        }
    }
    /**  Copied from virtual-machine.js
     *
      * Exports a sprite in the sprite3 format.
      * @param {string} targetId ID of the target to export
      * @param {string=} optZipType Optional type that the resulting zip should be outputted in. Options are: base64, binarystring,
      * array, uint8array, arraybuffer, blob, or nodebuffer. Defaults to
      * blob if argument not provided.
      * @param {string=} newName Optional new name
      *
      * See https://stuk.github.io/jszip/documentation/api_jszip/generate_async.html#type-option
      * for more information about these options.
      * @return {Promise} generated zip of the sprite and its assets, plus
      * a monkey patched md5 field.
      * NOTE: the md5 is *not* the md5 of the zipped data, because md5 of zips
      * is not stable: https://github.com/Stuk/jszip/issues/590
      * @since botch-0.1
      */
    exportSprite (targetId, optZipType, newName = '') {
        if (!targetId){
            throw new Error(`Got empty id:${targetId}!`);
        }
        if (newName){
            if (!newName.trim()){
                throw new Error('Got an all blank name for sprite !');
            }
        }
        const JSZip = require('jszip');
        const sb3 = require('../../serialization/sb3');
        const {serializeSounds, serializeCostumes} = require('../../serialization/serialize-assets');
        const StringUtil = require('../../util/string-util');

        const soundDescs = serializeSounds(this.runtime, targetId);
        console.log('md5(soundDescs)', md5(soundDescs));
        const costumeDescs = serializeCostumes(this.runtime, targetId);
        console.log('md5(costumeDescs)', md5(costumeDescs));
        const serialized = sb3.serialize(this.runtime, targetId);
        
        if (newName){
            serialized.name = newName;
        }
        const spriteJson = StringUtil.stringify(serialized);

        console.log('md5(spriteJson)', md5(spriteJson));

        // Botch: would have been nicer to calculate md5 of the zip
        // but md5 varies between zips: https://github.com/Stuk/jszip/issues/590
        const theMd5 = md5(spriteJson + StringUtil.stringify(soundDescs.concat(costumeDescs)));

        const zip = new JSZip();
        zip.file('sprite.json', spriteJson);
        this._addFileDescsToZip(soundDescs.concat(costumeDescs), zip);

        const p = zip.generateAsync({
            type: typeof optZipType === 'string' ? optZipType : 'blob',
            mimeType: 'application/x.scratch.sprite3',
            compression: 'DEFLATE',
            compressionOptions: {
                level: 6
            }
        });
        p.md5 = theMd5; // monkey patching
        return p;

    }

    /** Stores a sprite from runtime into custom storageHelper.
     *
     *  The sprite is stored with a new id calculated from md5 of the whole sprite
     *  (json + entire costumes + entire sounds) and provided newName
     *  If the sprite is a descendent of an existing one, consider reassigning the name.
     *
     *  Does *not* change the current runtime.
     *
     * @param {string} id  the sprite to store
     * @param {string} newName  new name for the sprite, if unspecified uses existing one.
     * @returns {Promise} A promise with an extra md5 field. NOTE: the md5 is *not* the md5 of the zipped data, because zips md5 is not stable: https://github.com/Stuk/jszip/issues/590
     * @since botch-0.1
     */
    storeSprite (id, newName = '') {
        console.log('Botch: trying to store sprite with original id', id);

        if (!id){
            throw new Error(`Got empty id:${id}!`);
        }
        if (newName){
            if (!newName.trim()){
                throw new Error('Got all blank name for sprite !');
            }
        }
        
        const p = this.exportSprite(id, 'uint8array', newName);
        const newId = p.md5;

        return p.then(data => {
            
            console.log('Botch: using newId from md5:', newId);
            this.storageHelper._store(
                this.storage.AssetType.Sprite,
                this.storage.DataFormat.SB3,
                data,
                newId,
                newName ? newName : this.runtime.getTargetById(id).sprite.name
            );
            console.log('Botch: emitting ', Scratch3Botch.BOTCH_STORAGE_HELPER_UPDATE);
            this.runtime.emit(Scratch3Botch.BOTCH_STORAGE_HELPER_UPDATE);
            console.log('Botch: stored sprite with newId', newId);

        });
    }
    

    /**
     * Quick and dirty test, stores first sprite in the custom storageHelper
     * @since botch-0.1
     */
    testStoreSprite () {
        console.log('BOTCH TEST: storing first sprite in custome storageHelper');
        const id = this.runtime.targets[1].id;

        this.storeSprite(id).then(() => {

            this.runtime.storage.load('sb3', id).then(storedSprite => {
                console.log('loaded storedSprite', storedSprite);
                this.storageHelper.loadLibrarySprite(id).then(spriteAsset => {
                    console.log('Sprite for library (sort of an asset):', spriteAsset);
                    this.storageHelper.loadLibrarySprites().then(libSprites => {
                        console.log('All sprites for library:', libSprites);
                    });
                });
            });
        });
    }

    /**
     * Find the best organism according to its life span
     * @returns {Organism} best organism
     * TODO to improve perfomance this can be refreshed less time
     */
    findBestOrganism () {
        let best = null;
        let max = -1;
        for (const org of this.organismMap.values()) {
            if (org.living > max) {
                best = org;
                max = org.living;
            }
        }
        return best;
    }

    foodAtt () {
        const best = this.findBestOrganism();
        if (best) {
            return best.dna[0];
        }
        return 'nothing';
    }

    poisonAtt () {
        const best = this.findBestOrganism();
        if (best) {
            return best.dna[1];
        }
        return 'nothing';
    }

    foodDist () {
        const best = this.findBestOrganism();
        if (best) {
            return best.dna[2];
        }
        return 'nothing';
    }

    poisonDist () {
        const best = this.findBestOrganism();
        if (best) {
            return best.dna[3];
        }
        return 'nothing';
    }

    health () {
        let best = null;
        let max = -1;
        for (const org of this.organismMap.values()) {
            if (org.living > max) {
                best = org.health;
                max = org.living;
            }
        }
        return best;
    }

    sayBest (args) {
        let message = args.TEXT;
        const best = this.findBestOrganism();
        if (best) {
            message = String(message).substr(0, 330);
            this.runtime.emit('SAY', best.target, 'say', message);
        }
    }

}

module.exports = Scratch3Botch;
