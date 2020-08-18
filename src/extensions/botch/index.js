let _TextEncoder;
if (typeof TextEncoder === 'undefined') {
    _TextEncoder = require('text-encoding').TextEncoder;
} else {
    /* global TextEncoder */
    _TextEncoder = TextEncoder;
}

/* eslint-disable no-negated-condition */
const Runtime = require('../../engine/runtime');
const ArgumentType = require('../../extension-support/argument-type');
const BlockType = require('../../extension-support/block-type');
const Cast = require('../../util/cast');
const Organism = require('./organism');
const svgen = require('./svg-generator');
const BotchStorageHelper = require('./botch-storage-helper.js');
const BotchUtil = require('./botchUtil');
const Enemy = require('./enemy');
const DEFAULT_BOTCH_SPRITES = require('./default-botch-sprites.js');
const log = require('../../util/log');
const md5 = require('js-md5');
class Scratch3Botch {

    static get BOTCH_STORAGE_HELPER_UPDATE (){
        return 'BOTCH_STORAGE_HELPER_UPDATE';
    }

    constructor (runtime) {
        this.runtime = runtime;
        this.child = '';
        this.vehicleMap = new Map();
        this.organismMap = new Map();
        this.enemiesMap = new Map();
        this.storage = this.runtime.storage;
        this.foodMap = new Map();
        this.poisonMap = new Map();
        this.foodTarget = {};
        this.poisonTarget = {};
        this.maxForce = 0.5;
        this.enemiesMaxForce = 0.3;
        this.mass = 1;
        this.botchUtil = new BotchUtil(this.runtime);
        
        this.runtime.on(Runtime.PROJECT_LOADED, (() => {
            log.log('Botch: on PROJECT_LOADED');
            this.storage = this.runtime.storage;
            if (!this.storageHelper){
                // in some tests it is not defined ...
                if (this.storage && this.storage.addHelper){
                    this.storageHelper = new BotchStorageHelper(this.runtime.storage);
                    this.storage.addHelper(this.storageHelper);
                } else {
                    log.log('this.runtime.storage is not defined, skipping BotchStorageHelper initialization');
                }

            }
            // this.testStoreSprite();
        }));
        
        log.log('Botch runtime:', runtime);
        log.log('Botch custom storageHelper:', this.storageHelper);

        // browser detection arcana https://stackoverflow.com/a/41863502
        if (this.window === this){
            window.BOTCH = this; // browser
        } else {
            global.BOTCH = this; // node
        }

        // show the organism when stopped
        this.runtime.on(Runtime.PROJECT_STOP_ALL, (() => {
            if (this.organismMap && this.organismMap.size > 0) {
                this.organismMap.entries().next().value[1].target.setVisible(true);
            }
        }));
    }
    
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
                    opcode: 'setAs', // TODO define a tendina
                    blockType: BlockType.COMMAND,
                    text: 'set as [TYPE]',
                    arguments: {
                        TYPE: {
                            type: ArgumentType.String,
                            defaultValue: 'organism',
                            menu: 'speciesMenu'
                        }
                    }
                },
                {
                    opcode: 'generatePopulation', // TODO generate n child con tendina
                    blockType: BlockType.COMMAND,
                    text: 'generate [COPIES] children',
                    arguments: {
                        COPIES: {
                            type: ArgumentType.NUMBER,
                            defaultValue: 1
                        }
                    }
                },
                {
                    opcode: 'behaviors',
                    blockType: BlockType.COMMAND,
                    text: 'behave with poison'
                },
                {
                    opcode: 'behaveEnemies',
                    blockType: BlockType.COMMAND,
                    text: 'behave with enemies'
                },
                {
                    opcode: 'moveEnemies',
                    blockType: BlockType.COMMAND,
                    text: 'move enemies'
                },
                {
                    opcode: 'removeOrganism',
                    blockType: BlockType.COMMAND,
                    text: 'remove organism'
                },
                {
                    opcode: 'isDeadHat',
                    blockType: BlockType.HAT,
                    text: 'when an organism dies'
                },
                {
                    opcode: 'isOrganismDead',
                    blockType: BlockType.BOOLEAN,
                    text: 'is organism dead?'
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
                    text: 'poison dist. best:'
                },
                {
                    opcode: 'health',
                    blockType: BlockType.REPORTER,
                    text: 'health best:'
                },
                {
                    opcode: 'living',
                    blockType: BlockType.REPORTER,
                    text: 'life span:'
                }
            ],
            menus: {
                speciesMenu: {
                    acceptReporters: true,
                    items: ['organism', 'food', 'poison', 'enemy']
                },
                getSprite: {
                    acceptReporters: true,
                    items: 'getSpriteMenu'
                }
            }
        };
    }

    getSpriteMenu () {
        if (this.runtime.targets.length > 1) {
            return this.runtime.targets.filter(t => t.isOriginal && !t.isStage).map(t => t.getName());
        }
    }

    debugConsole (args, util) {
        log.log(this);
        log.log(args);
        log.log(util);
    }

    /**
     * Check if the organismMap or the enemiesMap are already defined
     * and if true, reinitialize it
     * @param {string} id target id
     * @since botch-0.2
     */
    checkMap (id) {
        if (this.organismMap.size > 0 &&
            this.organismMap.entries().next().value[0] === id) {
            this.organismMap = new Map();
        }
        if (this.enemiesMap.size > 0 &&
            this.enemiesMap.entries().next().value[0] === id) {
            this.enemiesMap = new Map();
        }
    }

    /**
     * Check if the foodTarget or poisonTarget are already defined
     * and if true, reinitialize it
     * @param {string} id target id
     * @since botch-0.2
     */
    checkTarget (id) {
        if (this.foodTarget.id === id) {
            this.foodTarget = {};
        }
        if (this.poisonTarget === id) {
            this.poisonTarget = {};
        }
    }
    
    /**
     * Delete all the "non original" costumes of a sprite
     * starting with org_
     * @param {target} target target
     * @since botch-0.2
     */
    deleteAllCostumes (target) {
        const costumeNum = target.sprite.costumes.length;
        for (let i = costumeNum - 1; i >= 1; i--) {
            if (target.sprite.costumes[i].name.startsWith('org_')) {
                target.deleteCostume(i);
            }
        }
    }

    /**
     * Define a sprite as one of the available species
     * @param {args} args args
     * @param {util} util util
     * @since botch-0.2
     */
    setAs (args, util) {
        if (args.TYPE === 'organism') {
            this.botchUtil.deleteClones(util.target.id);
            this.botchUtil.deleteAllOrgCostumes(util.target);
            // check if it is already assigned somewhere
            if (this.enemiesMap.size > 0 &&
                util.target.id === this.enemiesMap.entries().next().value[0]) {
                this.enemiesMap = new Map();
            }
            this.checkTarget(util.target.id);

            util.target.goToFront();
            this.organismMap = new Map();

            const org = new Organism(
                util.target, this.mass, this.maxForce);

            // change the costume of the original sprite
            const newSvg = new svgen(130, 130).generateMultiple(org.dna[0], org.dna[1], 5);
            org.svg = newSvg;

            this.organismMap.set(util.target.id, org);

            util.target.setVisible(true);
            // this.uploadCostumeEdit(newSvg, util.target.id); // for now it will not assign a costume to the original
        }
        if (args.TYPE === 'food') {
            this.botchUtil.deleteClones(util.target.id);
            // check if it is already assigned somewhere
            if (this.poisonTarget.id === util.target.id) {
                this.poisonTarget = {};
            }
            this.checkMap(util.target.id);

            util.target.setVisible(true);
            this.foodTarget = util.target;
        }
        if (args.TYPE === 'poison') {
            this.botchUtil.deleteClones(util.target.id);
            // check if it is already assigned somewhere
            if (this.foodTarget.id === util.target.id) {
                this.foodTarget = {};
            }
            this.checkMap(util.target.id);

            util.target.setVisible(true);
            this.poisonTarget = util.target;
        }
        if (args.TYPE === 'enemy') {
            this.botchUtil.deleteClones(util.target.id);
            // check if it is already assigned somewhere
            if (this.organismMap.size > 0 &&
                util.target.id === this.organismMap.entries().next().value[0]) {
                this.organismMap = new Map();
            }
            this.checkTarget(util.target.id);

            util.target.goToFront();
            this.enemiesMap = new Map();
            util.target.setVisible(true);
            const enemy = new Enemy(
                util.target, this.mass, this.enemiesMaxForce);

            this.enemiesMap.set(util.target.id, enemy);
        }
    }

    /**
     * Generate an organism with clones, the first clone will assign the same costume
     * to the original target for the preview icon
     * @param {target} target target
     * @param {number} i index
     * @since botch-0.2
     */
    createOrganismClone (target, i) {
        const newClone = this.botchUtil.createClone(target);
        if (newClone) {
            newClone.setVisible(true);
            this.runtime.addTarget(newClone);

            const org = new Organism(newClone, this.mass, this.maxForce);
            this.organismMap.set(newClone.id, org);
            
            // Place behind the original target.
            newClone.goBehindOther(target);
            // Set a random size
            newClone.setSize((Math.random() * 100) + 30);
            if (i === 0) { // the first clone is placed where is the original
                newClone.setXY(target.x, target.y);
                target.setCostume(org.target.currentCostume); // don't know why this does not work!
            } else {
            // place the new clone in a random position
                const stageW = this.runtime.constructor.STAGE_WIDTH;
                const stageH = this.runtime.constructor.STAGE_HEIGHT;
                newClone.setXY((Math.random() - 0.5) * stageW, (Math.random() - 0.5) * stageH);
            }
        }
    }

    /**
     * Generate an enemy with clones
     * @param {target} target target
     * @since botch-0.2
     */
    createEnemyClone (target) {
        const newClone = this.botchUtil.createClone(target);
        if (newClone) {
            newClone.setVisible(true);
            this.runtime.addTarget(newClone);

            // Place behind the original target.
            newClone.goBehindOther(target);

            // place the new clone in a random position
            const stageW = this.runtime.constructor.STAGE_WIDTH;
            const stageH = this.runtime.constructor.STAGE_HEIGHT;
            newClone.setXY((Math.random() - 0.5) * stageW, (Math.random() - 0.5) * stageH);

            const en = new Enemy(newClone, this.mass, this.maxForce);

            this.enemiesMap.set(newClone.id, en);
        }
    }

    /**
     * Generate n children of Organism or Enemy
     * @param {args} args args
     * @param {util} util util
     * @returns {string} message
     * @since botch-0.1
     */
    generatePopulation (args, util) {
        if (this.organismMap.size > 0 &&
            this.organismMap.get(util.target.id)) { // util.target.id === this.organismMap.entries().next().value[0]
            util.target.setVisible(false); // hide the original
            const copies = Cast.toNumber(args.COPIES);
            if (this.organismMap.size === 1) {
                if (copies === 0) {
                    this.createOrganismClone(util.target, copies);
                } else if (copies <= 30) {
                    for (let i = 0; i <= copies; i++) {
                        this.createOrganismClone(util.target, i);
                    }
                }
            } else {
                for (let i = 1; i <= copies; i++) {
                    this.createOrganismClone(util.target, i);
                }
            }
        } else if (this.enemiesMap.size > 0 &&
            util.target.id === this.enemiesMap.entries().next().value[0]) {
            const copies = Cast.toNumber(args.COPIES);
            if (copies > 0 && copies <= 30) {
                for (let i = 0; i < copies; i++) {
                    this.createEnemyClone(util.target);
                }
            }
        } else {
            return 'There is no organism or enemy definition';
        }
    }

    /**
     * Only move the organism randomly
     * @param {RenderedTarget} target target
     * @param {string} message message to say
     * @since botch-0.2
     */
    confusion (target, message) {
        const org = this.organismMap.get(target.id);
        if (!org.target.isOriginal) { // Only the clones are managed
            org.boundaries(
                this.runtime.constructor.STAGE_WIDTH,
                this.runtime.constructor.STAGE_HEIGHT);
            org.refreshArgs(this.mass, this.maxForce);
            org.update();
            this.runtime.emit('SAY', org.target, 'say', message);
        }
    }

    /**
     * Create a food in x, y
     * @param {number} x x coordinate
     * @param {number} y y coordinate
     * @since botch-0.1
     */
    createFoodXY (x, y) {
        const newClone = this.botchUtil.createClone(this.foodTarget);
        if (newClone) {
            this.runtime.addTarget(newClone);
            newClone.setXY(x, y);
            newClone.goBehindOther(this.foodTarget);
        }
    }

    /**
     * Function seek,
     * http://www.red3d.com/cwr/steer/gdc99/
     * https://natureofcode.com/book/chapter-6-autonomous-agents/
     */

    /**
     * Behave with the food and poison
     * now this block works with "when I start as a clone", botch-0.2
     * @param {args} args args
     * @param {util} util util
     * @returns {string} message
     * @since botch-0.1
     */
    behaviors (args, util) {
        if (this.poisonTarget === {}) {
            this.confusion(util.target, '?');
            return 'I need poison';
        }
        if (this.foodTarget === {}) {
            this.confusion(util.target, '?');
            return 'I need food';
        }

        // Now I don't have control of this part of code
        // this because the event is fired only when it start as a clone
        // an when all the organism die there is no clones
        if (this.organismMap.size <= 1) {
            util.target.setVisible(true);
            this.runtime.stopAll();
            return 'There is no organism';
        }
        const org = this.organismMap.get(util.target.id);
        if (!org.target.isOriginal) { // Only the clones are managed
            if (org.health > 0) {
                org.boundaries(
                    this.runtime.constructor.STAGE_WIDTH,
                    this.runtime.constructor.STAGE_HEIGHT);
                org.refreshArgs(this.mass, this.maxForce);
                // org.behaviors(this.foodMap, this.poisonMap);
                org.behaviors(this.foodTarget, this.poisonTarget);
                org.update();

                const newOrg = org.clone();
                if (newOrg !== null) {
                    const newClone = this.botchUtil.createClone(org.target);
                    if (newClone) {
                        this.runtime.addTarget(newClone);
                        newClone.clearEffects();
                        newOrg.target = newClone;
                    }
                    this.organismMap.set(newClone.id, newOrg);
                }
            }
            if (org.dead()) {
                this.runtime.startHats('botch_isDeadHat', null, org.target.sprite);
            }
            /* if (org.dead()) {
                if (org.deathAnimation(util)) { // wait the end of animation
                    // this.runtime.disposeTarget(org.target);
                    // this.runtime.stopForTarget(org.target);
                    // this.organismMap.delete(org.target.id);

                    // when an organism die, it will drop a food
                    // this.createFoodXY(org.target.x, org.target.y);
                }
            } */
        }
    }

    /**
     * Behave with non static sprite (enemies)
     * this block works with "when I start as a clone"
     * @param {args} args args
     * @param {util} util util
     * @return {string} message
     * @since botch-0.2
     */
    behaveEnemies (args, util) {
        if (this.foodTarget === {}) {
            this.confusion(util.target, '?');
            return 'I need food';
        }

        if (this.organismMap.size <= 1) {
            util.target.setVisible(true);
            this.runtime.stopAll();
            return 'There is no organism';
        }
        const org = this.organismMap.get(util.target.id);
        if (!org.target.isOriginal) { // Only the clones are managed
            if (org.health > 0) {
                org.boundaries(
                    this.runtime.constructor.STAGE_WIDTH,
                    this.runtime.constructor.STAGE_HEIGHT);
                org.refreshArgs(this.mass, this.maxForce);
                org.behaviourEnemy(this.foodTarget, this.enemiesMap);
                org.update();

                const newOrg = org.clone();
                if (newOrg !== null) {
                    const newClone = this.botchUtil.createClone(org.target);
                    if (newClone) {
                        this.runtime.addTarget(newClone);
                        newClone.clearEffects();
                        newOrg.target = newClone;
                    }
                    this.organismMap.set(newClone.id, newOrg);
                }
            }

            if (org.dead()) {
                this.runtime.startHats('botch_isDeadHat', null, org.target.sprite);
            }
            /* if (org.dead()) {
                if (org.deathAnimation(util)) { // wait the end of animation
                    // this.runtime.disposeTarget(org.target);
                    // this.runtime.stopForTarget(org.target);
                    // this.organismMap.delete(org.target.id);

                    // when an organism die, it will drop a food
                    // this.createFoodXY(org.target.x, org.target.y);
                }
            } */
        }
    }

    /**
     * Return true if an organism id dead
     * @param {args} args args
     * @param {util} util util
     * @returns {boolean} true if dead
     * @since botch-0.2
     */
    isOrganismDead (args, util) {
        if (this.organismMap.size > 0) {
            const org = this.organismMap.get(util.target.id);
            if (org) {
                return (org.dead());
            }
        }
    }

    isDeadHat () {
        return true;
    }

    removeOrganism (args, util) {
        if (this.organismMap.size > 1) {
            const org = this.organismMap.get(util.target.id);
            if (org.deathAnimation(util)) {
                if (org) {
                    this.runtime.disposeTarget(org.target);
                    this.runtime.stopForTarget(org.target);
                    this.organismMap.delete(org.target.id);
                }
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
      * @param {string=} optZipType Optional type that the resulting zip should be outputted in.
      *                             Options are: base64, binary string,
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
        log.log('md5(soundDescs)', md5(soundDescs));
        const costumeDescs = serializeCostumes(this.runtime, targetId);
        log.log('md5(costumeDescs)', md5(costumeDescs));
        const serialized = sb3.serialize(this.runtime, targetId);
        
        if (newName){
            serialized.name = newName;
        }
        const spriteJson = StringUtil.stringify(serialized);

        log.log('md5(spriteJson)', md5(spriteJson));

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
        log.log('Botch: trying to store sprite with original id', id);

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

        const retp = p.then(data => {
            
            log.log('Botch: using newId from md5:', newId);
            this.storageHelper._store(
                this.storage.AssetType.Sprite,
                this.storage.DataFormat.SB3,
                data,
                newId,
                newName ? newName : this.runtime.getTargetById(id).sprite.name
            );
            log.log('Botch: emitting ', Scratch3Botch.BOTCH_STORAGE_HELPER_UPDATE);
            this.runtime.emit(Scratch3Botch.BOTCH_STORAGE_HELPER_UPDATE);
            log.log('Botch: stored sprite with newId', newId);

        });
        
        retp.md5 = newId;
        return retp;
    }
    
    /**
     * Loads a sprite from the store
     *
     * @since botch-0.1
     * @param {string} id  Sprite id
     * @returns {Promise} Promise containing
     * the sprite in a format suitable to be viewed in a library panel
     */
    loadLibrarySprite (id) {
        const sb3 = require('../../serialization/sb3');
        const JSZip = require('jszip');

        const storage = this.storage;

        const storedSprite = this.storageHelper.assets[id];

        log.log('storedSprite=', storedSprite);

        return JSZip.loadAsync(storedSprite.data).then(zipObj => {
            const spriteFile = zipObj.file('sprite.json');
            if (!spriteFile) {
                log.log.error("Couldn't find sprite.json inside stored Sprite !");
                return Promise.resolve(null);

            }
            if (!JSZip.support.uint8array) {
                log.log.error('JSZip uint8array is not supported in this browser.');
                return Promise.resolve(null);
            }
            return spriteFile.async('string').then(data => {
                log.log('Botch: unzipped data (only sprite, no costume/sound data):', data);
                const sprite = JSON.parse(data);

                // in deserialize-assets is written:
                //    "Zip will not be provided if loading project json from server"
                // let zip = null;
                
                // deserialize injects lots of runtime stuff we don't need
                return sb3.deserialize(sprite, this.runtime, zipObj, true)
                    .then(({targets/* , extensions */}) => {
                        if (targets.length > 1){
                            log.error(targets);
                            throw new Error('Found more than one target!!');
                        }
                        const asset = {};
                        asset.type = storage.AssetType.Sprite;
                        // storage.DataFormat.SB3,
                        asset.tags = [
                            'botch'
                        ];
                        asset.info = [ // What is this ??
                            0,
                            1,
                            1
                        ];


                        // TO DO what about the id? createAsset setss assetId and assetName
                        asset.name = sprite.name;
                        // Botch: this was original line of code, don't like it, should consider whole sprite
                        // asset.md5 = sprite.costumes && sprite.costumes[0].md5ext;
                        asset.md5 = id;
                        asset.json = sprite;
                        // overriding so it also contains costume assets data
                        
                        sprite.costumes = targets[0].sprite.costumes;
                        for (const cost of sprite.costumes){
                            // NOTE 1: in costumes 'md5' field also has '.svg' appended
                            
                            // this way it will have inside the precious encodeDataURI method
                            cost.asset = new this.storage.Asset(
                                cost.asset.assetType,
                                cost.asset.assetId,
                                cost.asset.dataFormat,
                                cost.asset.data,
                                false
                            );
                            cost.md5ext = cost.md5;
                            // NOTE 2: in preloaded data there is no md5, only md5ext
                            delete cost.md5;
                        }
                        
                        sprite.objName = sprite.name;
                        // this.installTargets(targets, extensions, false)
                        log.log('Botch: completely loaded asset:', asset);
                        return asset;
                    });
            });
        });

    }

    /**
     * Loads all sprites from the store
     *
     * @see loadLibrarySprite
     * @since botch-0.1
     * @returns {Promise} outputs a Promise containing
     * the sprites in a format suitable to be viewed in a library panel
     */
    loadLibrarySprites () {
        const inStorage = [];
        for (const id in this.storageHelper.assets) {
            inStorage.push(this.loadLibrarySprite(id));
        }
        return Promise.all(inStorage).then(libSprites => {
            const ret = libSprites.concat(DEFAULT_BOTCH_SPRITES);
            log.log('libSprites=', ret);
            return ret;
        });

    }

    /**
     * Shows how to directly start user defined hats
     * @param {int} nTarget the index of a target
     * @returns {object} the new threads
     * @since botch-0.2
     */
    testHats (nTarget){
        this.runtime._hats.botch_isDeadHat.edgeActivated = false;
        return this.runtime.startHats('botch_isDeadHat', null, this.runtime.targets[nTarget]);
    }
    /**
     * Quick and dirty test, stores first sprite in the custom storageHelper
     * @since botch-0.1
     */
    testStoreSprite () {
        log.log('BOTCH TEST: storing first sprite in custom storageHelper');
        const id = this.runtime.targets[1].id;

        this.storeSprite(id).then(() => {

            this.runtime.storage.load('sb3', id).then(storedSprite => {
                log.log('loaded storedSprite', storedSprite);
                this.loadLibrarySprite(id).then(spriteAsset => {
                    log.log('Sprite for library (sort of an asset):', spriteAsset);
                    this.loadLibrarySprites().then(libSprites => {
                        log.log('All sprites for library:', libSprites);
                    });
                });
            });
        });
    }

    /**
     * Update the enemies position and behave with the environment
     * @param {args} args args
     * @param {util} util util
     * @returns {string} error message
     * @since botch-0.2
     */
    moveEnemies (args, util) {
        if (this.organismMap.size < 1) {
            return 'There is no organism';
        }
        const enemy = this.enemiesMap.get(util.target.id);
        if (enemy) {
            enemy.boundaries(
                this.runtime.constructor.STAGE_WIDTH - 150,
                this.runtime.constructor.STAGE_HEIGHT - 150);
            enemy.refreshArgs(this.mass, this.enemiesMaxForce);
            enemy.behaviors(this.organismMap);
            enemy.update();
        }
    }

    /**
     * Find the best organism according to its life span
     * @returns {Organism} best organism
     * @since botch-0.2
     * TO DO to improve performance this can be refreshed less time
     */
    findBestOrganism () {
        let best = null;
        let max = -1;
        for (const org of this.organismMap.values()) {
            if (!org.target.isOriginal) {
                if (org.living > max) {
                    best = org;
                    max = org.living;
                }
            }
        }
        return best;
    }

    /**
     * Return the food attraction of the best organism
     * @returns {number} food attraction
     * @since botch-0.2
     */
    foodAtt () {
        const best = this.findBestOrganism();
        if (best) {
            return best.dna[0];
        }
        return 'nothing';
    }

    /**
     * Return the poison attraction of the best organism
     * @returns {number} poison attraction
     * @since botch-0.2
     */
    poisonAtt () {
        const best = this.findBestOrganism();
        if (best) {
            return best.dna[1];
        }
        return 'nothing';
    }

    /**
     * Return the food perception of the best organism
     * @returns {number} food perception
     * @since botch-0.2
     */
    foodDist () {
        const best = this.findBestOrganism();
        if (best) {
            return best.dna[2];
        }
        return 'nothing';
    }

    /**
     * Return the poison perception of the best organism
     * @returns {number} poison perception
     * @since botch-0.2
     */
    poisonDist () {
        const best = this.findBestOrganism();
        if (best) {
            return best.dna[3];
        }
        return 'nothing';
    }

    /**
     * Return the health  of the best organism
     * @returns {number} health
     * @since botch-0.2
     */
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

    /**
     * Return the life span of an organism
     * @param {args} args args
     * @param {util} util util
     * @returns {number} living parameter
     * @since botch-0.2
     */
    living (args, util) {
        if (this.organismMap.size > 0) {
            const org = this.organismMap.get(util.target.id);
            if (org) {
                return org.living;
            }
        }
    }

    /**
     * The best organism will say something
     * @param {args} args args
     * @since botch-0.2
     */
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
