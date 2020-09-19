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
const Clone = require('../../util/clone');
const BotchStorageHelper = require('./botch-storage-helper.js');
const BotchUtil = require('./botch_util');
const DEFAULT_BOTCH_SPRITES = require('./default-botch-sprites.js');
const log = require('../../util/log');
const md5 = require('js-md5');
const MathUtil = require('../../util/math-util');
const sb3 = require('../../serialization/sb3');
const {serializeSounds, serializeCostumes} = require('../../serialization/serialize-assets');
const StringUtil = require('../../util/string-util');
const JSZip = require('jszip');


class Scratch3Botch {

    static get BOTCH_STORAGE_HELPER_UPDATE (){
        return 'BOTCH_STORAGE_HELPER_UPDATE';
    }

    /** In millisecs
     * @since botch-0.3
     */
    static get STORAGE_DELAY (){
        return 1000;
    }

    /**
     * The key to load & store a target's botch-related state.
     * @type {string}
     * @since botch-0.2
     */
    static get STATE_KEY () {
        return 'Botch.state';
    }

    /**
     * The default botch-related state, to be used when a target has no existing botch state.
     * @type {MusicState}
     * @return {BotchState} the default state
     * @since botch-0-2
     */
    static get DEFAULT_BOTCH_STATE () {
        return {
            type: 'undefined'
        };
    }

    /**
     * Food type
     * @return {string} food type
     * @since botch-0-2
     */
    static get FOOD_TYPE () {
        return 'food';
    }

    /**
     * Poison type
     * @return {string} poison type
     * @since botch-0-2
     */
    static get POISON_TYPE () {
        return 'poison';
    }

    /**
     * Organism type
     * @return {string} organism type
     * @since botch-0-2
     */
    static get ORGANISM_TYPE () {
        return 'organism';
    }

    /**
     * Poison type
     * @return {string} poison type
     * @since botch-0-2
     */
    static get ENEMY_TYPE () {
        return 'enemy';
    }

    /**
     * @return {int} maximum allowed number of sprites in storage (including parent_0).
     * @since botch-0.3
     */
    static get MAX_STORAGE (){
        return 3;
    }

    /**
     * @return {int} Storage full code.
     * @since botch-0.3
     */
    static get STORAGE_FULL (){
        return 1;
    }

    static calcSpriteMd5 (spriteJson, soundDescs, costumeDescs){
        return md5(spriteJson + StringUtil.stringify(soundDescs.concat(costumeDescs)));
    }

    constructor (runtime) {
        this.debugMode = false;
        this.runtime = runtime;
        this.storage = this.runtime.storage;
        this.storageRequestsSize = 0;
        this.storageLastRequestPromise = null;
        this.storageRequests = {};
        // map that contains the organism <id, org> or enemies
        this.organismMap = new Map();
        this.enemiesMap = new Map();
        // default option for the new organism
        this.maxForce = 0.5;
        this.enemiesMaxForce = 0.3;
        this.mass = 1;
        // utils
        this.botchUtil = new BotchUtil(this.runtime);
        this.currentOrgCounter = 0;
        this.originalOrg = null; // this is the clone that hide the original when set as organism
        
        // since that the project is loaded at the startup
        // for some reasons the storage is not already defined and it needs to
        // be redefined
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
            this.resetStoragePendingRequests();
            if (this.organismMap && this.organismMap.size > 0) {
                for (const org of this.organismMap.values()) {
                    org.target.setVisible(true);
                }
            }
            if (this.enemiesMap && this.enemiesMap.size > 0) {
                for (const en of this.enemiesMap.values()) {
                    en.target.setVisible(true);
                }
            }
            this.organismMap = new Map();
            this.enemiesMap = new Map();
            this.currentOrgCounter = 0;
            // check if needed
            this.runtime.targets.forEach(element => {
                if (!element.isStage) {
                    element._customState = {};
                }
            });
        }));

        this.runtime.on(Runtime.SCRIPT_GLOW_OFF, (params => {
            log.log('script glowing off:', params);
            this.resetStoragePendingRequests(params.id);
        }));
        this.runtime.on(Runtime.BLOCK_GLOW_OFF, params => {
            log.log('block glowing off:', params);
            this.resetStoragePendingRequests(params.id);
        });
        this.runtime.on(Runtime.STOP_FOR_TARGET, params => {
            log.log('STOP_FOR_TARGET:', params);
            for (const blockId in params.target.blocks._blocks){
                this.resetStoragePendingRequests(blockId);
            }
        });

        // copy the custom state when clone
        this._onTargetCreated = this._onTargetCreated.bind(this);
        this.runtime.on('targetWasCreated', this._onTargetCreated);
        this.resetStorage = this.resetStorage.bind(this);
        this.runtime.on('PROJECT_START', this.resetStorage);
        
    }

    
    switchDebugMode (){
        this.debugMode = !this.debugMode;
        // TO DO would like to force refresh, tried to emit Runtime.PROJECT_CHANGED and didn't work
        
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
                    opcode: 'setAs',
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
                    opcode: 'generatePopulation',
                    blockType: BlockType.COMMAND,
                    text: 'populate with [COPIES] elements',
                    arguments: {
                        COPIES: {
                            type: ArgumentType.NUMBER,
                            defaultValue: 1
                        }
                    }
                },
                {
                    opcode: 'behaveGeneral',
                    blockType: BlockType.COMMAND,
                    text: 'update'
                },
                {
                    opcode: 'reproduceChild',
                    blockType: BlockType.COMMAND,
                    text: 'reproduce with [MR] mutation',
                    arguments: {
                        MR: {
                            type: ArgumentType.NUMBER,
                            defaultValue: 5
                        }
                    }
                },
                {
                    opcode: 'isDeadHat',
                    blockType: BlockType.HAT,
                    isEdgeActivated: false,
                    text: 'when an organism dies'
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
                    opcode: 'living',
                    blockType: BlockType.REPORTER,
                    text: 'life span'
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
    

    /**
     * @param {Target} target - collect botch state for this target.
     * @returns {BotchState} the mutable botch state associated with that target. This will be created if necessary.
     * @since botch-0.2
     */
    getBotchState (target) {
        let botchState = target.getCustomState(Scratch3Botch.STATE_KEY);
        if (!botchState) {
            botchState = Clone.simple(Scratch3Botch.DEFAULT_BOTCH_STATE);
            target.setCustomState(Scratch3Botch.STATE_KEY, botchState);
        }
        return botchState;
    }

    /**
     * When a botch-target Target is cloned, clone the botch state.
     * @param {Target} newTarget - the newly created target.
     * @param {Target} [sourceTarget] - the target used as a source for the new clone, if any.
     * @listens Runtime#event:targetWasCreated
     * @private
     * @since botch-0.2
     */
    _onTargetCreated (newTarget, sourceTarget) {
        if (sourceTarget) {
            const botchState = sourceTarget.getCustomState(Scratch3Botch.STATE_KEY);
            if (botchState) {
                newTarget.setCustomState(Scratch3Botch.STATE_KEY, Clone.simple(botchState));
            }
        }
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
            // check if it is already set as organism, if true don't delete the sprites
            if (!(this.organismMap.size > 0 && this.organismMap.get(util.target.id))) {
                this.botchUtil.deleteClones(util.target.id);
                this.botchUtil.deleteAllOrgCostumes(util.target); // TO DO mettere nel stop all
                this.organismMap = new Map();
                // check if it is already assigned somewhere
                if (this.enemiesMap.size > 0 &&
                util.target.id === this.enemiesMap.entries().next().value[0]) {
                    this.enemiesMap = new Map();
                }
                
                // create an organism with the original
                const org = new Organism(util.target, this.mass, this.maxForce);
                this.organismMap.set(util.target.id, org);
                org.setParentVariable();
                org.setOrgDna();
                org.assignOrgCostume().then(() => {
                    this.currentOrgCounter++;
                    org.currentName = this.currentOrgCounter.toString();
                    const p = this.storeSprite(util.target.id, org.currentName);
                    util.target.setCustomState('storedMd5', p.md5);
                    return p;
                });
                const state = this.getBotchState(util.target);
                state.type = Scratch3Botch.ORGANISM_TYPE;
            }
        }
        if (args.TYPE === 'food') {
            this.botchUtil.deleteClones(util.target.id);
            this.botchUtil.deleteAllOrgCostumes(util.target);
            util.target.setVisible(true);

            // if it was set as enemy or organism, reset
            if (this.organismMap.size > 0 && this.organismMap.get(util.target.id)) {
                this.organismMap = new Map();
            }
            if (this.enemiesMap.size > 0 && this.enemiesMap.get(util.target.id)) {
                this.enemiesMap = new Map();
            }

            const state = this.getBotchState(util.target);
            state.type = Scratch3Botch.FOOD_TYPE;
        }
        if (args.TYPE === 'poison') {
            this.botchUtil.deleteClones(util.target.id);
            this.botchUtil.deleteAllOrgCostumes(util.target);
            util.target.setVisible(true);

            // if it was set as enemy or organism, reset
            if (this.organismMap.size > 0 && this.organismMap.get(util.target.id)) {
                this.organismMap = new Map();
            }
            if (this.enemiesMap.size > 0 && this.enemiesMap.get(util.target.id)) {
                this.enemiesMap = new Map();
            }

            const state = this.getBotchState(util.target);
            state.type = Scratch3Botch.POISON_TYPE;
        }
        if (args.TYPE === 'enemy') {
            if (!(this.enemiesMap.size > 0 && this.enemiesMap.get(util.target.id))) {
                this.botchUtil.deleteClones(util.target.id);
                this.botchUtil.deleteAllOrgCostumes(util.target);
                // check if it is already assigned somewhere
                if (this.organismMap.size > 0 &&
                util.target.id === this.organismMap.entries().next().value[0]) {
                    this.organismMap = new Map();
                }

                this.enemiesMap = new Map();
                this.enemiesMap.set(util.target.id, new Organism(util.target));

                const en = new Organism(util.target, this.mass, this.maxForce);
                this.enemiesMap.set(util.target.id, en);
                en.assignEnemyCostume();
        
                const state = this.getBotchState(util.target);
                state.type = Scratch3Botch.ENEMY_TYPE;
            }
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
            org.setParentVariable();
            org.setOrgDna();
            org.assignOrgCostume().then(() => {
                this.currentOrgCounter++;
                org.currentName = this.currentOrgCounter.toString();
                const p = this.storeSprite(newClone.id, org.currentName);
                newClone.setCustomState('storedMd5', p.md5);
                return p;
            });

            // Place behind the original target.
            newClone.goBehindOther(target);
            // Set a random size
            // newClone.setSize((Math.random() * 100) + 40);
            if (i === 0) { // the first clone is placed where is the original
                newClone.setXY(target.x, target.y);
            } else {
            // place the new clone in a random position
                const stageW = this.runtime.constructor.STAGE_WIDTH;
                const stageH = this.runtime.constructor.STAGE_HEIGHT;
                newClone.setXY((Math.random() - 0.5) * stageW, (Math.random() - 0.5) * stageH);
            }
            const state = this.getBotchState(newClone);
            state.type = Scratch3Botch.ORGANISM_TYPE;
        }
    }

    /**
     * Generate enemy with clones, the first clone will have the same position
     * of the original
     * @param {target} target target
     * @param {number} i index
     * @since botch-0.2
     */
    createEnemyClone (target, i) {
        const newClone = this.botchUtil.createClone(target);
        if (newClone) {
            newClone.setVisible(true);
            this.runtime.addTarget(newClone);

            const en = new Organism(newClone, this.mass, this.maxForce);
            this.enemiesMap.set(newClone.id, en);
            en.assignEnemyCostume();

            // Place behind the original target.
            newClone.goBehindOther(target);

            if (i === 0) { // the first clone is placed where is the original
                newClone.setXY(target.x, target.y);
                target.setCostume(en.target.currentCostume); // don't know why this does not work!
            } else {
            // place the new clone in a random position
                const stageW = this.runtime.constructor.STAGE_WIDTH;
                const stageH = this.runtime.constructor.STAGE_HEIGHT;
                newClone.setXY((Math.random() - 0.5) * stageW, (Math.random() - 0.5) * stageH);
            }
            const state = this.getBotchState(newClone);
            state.type = Scratch3Botch.ENEMY_TYPE;
        }
    }

    /**
     * Generate n children of Organism or Enemy
     * all the organism that are in the stage are clones
     * this is to have the control of when an organism die
     * @param {args} args args
     * @param {util} util util
     * @returns {string} message
     * @since botch-0.1
     */
    generatePopulation (args, util) {
        const copies = MathUtil.clamp(Cast.toNumber(args.COPIES), 1, 30);
        if (this.organismMap.size > 0 &&
            this.organismMap.get(util.target.id)) {
            if (this.organismMap.size > 1) { // if there are already organism create one more
                this.createOrganismClone(util.target, 1);
            }
            for (let i = 1; i < copies; i++) {
                this.createOrganismClone(util.target, i);
            }
        } else if (this.enemiesMap.size > 0 &&
            this.enemiesMap.get(util.target.id)) {
            if (this.enemiesMap.size > 1) { // if there are already organism create one more
                this.createEnemyClone(util.target, 1);
            }
            for (let i = 1; i < copies; i++) {
                this.createEnemyClone(util.target);
            }
        } else {
            return 'Set it first as organism or enemy!';
        }
    }

    /**
     * Create a food in x, y
     * @param {number} x x coordinate
     * @param {number} y y coordinate
     * @since botch-0.1
     */
    createFoodXY (x, y) {
        if (this.foodTarget.hasOwnProperty('sprite')) { // if food is defined
            const newClone = this.botchUtil.createClone(this.foodTarget);
            if (newClone) {
                this.runtime.addTarget(newClone);
                newClone.setXY(x, y);
                newClone.goBehindOther(this.foodTarget);
            }
        }
    }

    /**
     * Function seek,
     * http://www.red3d.com/cwr/steer/gdc99/
     * https://natureofcode.com/book/chapter-6-autonomous-agents/
     */

    /**
     * General approach to behave, works with food poison and enemies
     * now this block works with "when I start as a clone", botch-0.2
     * @param {args} args args
     * @param {util} util util
     * @returns {string} message
     * @since botch-0.2
     */
    behaveGeneral (args, util) {
        // check if its an organism or an enemy
        if (this.organismMap.size > 0 && this.organismMap.get(util.target.id)) {
            const org = this.organismMap.get(util.target.id);
            if (org.health > 0) {
                org.stepOrganism(this.enemiesMap, this.organismMap);
            }

            if (org.dead()) {
                if (org.deadSignal()) {
                    this.runtime._hats.botch_isDeadHat.edgeActivated = false;
                    this.runtime.startHats(
                        'botch_isDeadHat', null, org.target);
                    this.organismMap.delete(org.target.id);
                }
            }
        } else if (this.enemiesMap.size > 0 && this.enemiesMap.get(util.target.id)) {
            const enemy = this.enemiesMap.get(util.target.id);
            if (enemy) {
                enemy.stepEnemy(this.organismMap, this.enemiesMap);
            }
        } else {
            return 'Set it first as organism or enemy!';
        }
    }

    reproduceChild (args, util) {
        const mr = MathUtil.clamp(Cast.toNumber(args.MR), 0, 100);
        if (this.organismMap.size > 0 && this.organismMap.get(util.target.id)) {
            const org = this.organismMap.get(util.target.id);
            if (org) {
                if (org.health >= 0) {
                    const newClone = this.botchUtil.createClone(org.target);
                    if (newClone) {
                        this.runtime.addTarget(newClone);
                        const newOrg = org.clone(mr, newClone, true);
                        newClone.clearEffects();
                        org.childNumber++;
                        newOrg.currentName = `${org.currentName}.${org.childNumber}`;
                        /* newOrg.prom.then(() => {
                            const p = this.storeSprite(newClone.id, newOrg.currentName);
                            newClone.setCustomState('storedMd5', p.md5);
                            newOrg.setParentVariable(org.target.getCustomState('storedMd5'));
                            return p;
                        }); */
                        
                        newOrg.assignOrgCostume().then(() => {
                            const p = this.storeSprite(newClone.id, newOrg.currentName);
                            newClone.setCustomState('storedMd5', p.md5);
                            newOrg.setParentVariable(org.target.getCustomState('storedMd5'));
                            return p;
                        });

                        
                        newOrg.setOrgDna();
                        this.organismMap.set(newClone.id, newOrg);
                    }
                }
            }
        } else if (this.enemiesMap.size > 0 && this.enemiesMap.get(util.target.id)) {
            const enemy = this.enemiesMap.get(util.target.id);
            if (enemy) {
                const newClone = this.botchUtil.createClone(enemy.target);
                if (newClone) {
                    this.runtime.addTarget(newClone);
                    const newOrg = enemy.clone(mr, newClone, false);
                    // newClone.clearEffects();
                    this.enemiesMap.set(newClone.id, newOrg);
                }
            }
        } else {
            return 'Set it first as organism or enemy!';
        }
    }
    
    /**
     * the hat of "when an organism dies"
     * the block is defined with isEdgeTriggered: false
     * in this way it return true only when the hat is activated
     * (when it dies)
     * @returns {boolean} true
     * @since botch-0.2
     */
    isDeadHat () {
        return true;
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

    serializeSprite (targetId, newName = ''){
        if (!targetId){
            throw new Error(`Got empty id:${targetId}!`);
        }
        if (newName){
            if (!newName.trim()){
                throw new Error('Got an all blank name for sprite !');
            }
        }
                

        const soundDescs = serializeSounds(this.runtime, targetId);
        // log.log('md5(soundDescs)', md5(soundDescs));
        const costumeDescs = serializeCostumes(this.runtime, targetId);
        // log.log('md5(costumeDescs)', md5(costumeDescs));
        const serialized = sb3.serialize(this.runtime, targetId);
        
        if (newName){
            serialized.name = newName;
        }
        const spriteJson = StringUtil.stringify(serialized);

        return {spriteJson: spriteJson,
            soundDescs: soundDescs,
            costumeDescs: costumeDescs};
        // log.log('md5(spriteJson)', md5(spriteJson));

        // Botch: would have been nicer to calculate md5 of the zip
        // but md5 varies between zips: https://github.com/Stuk/jszip/issues/590
        
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
        
        const ser = this.serializeSprite(targetId, newName);
        const theMd5 = Scratch3Botch.calcSpriteMd5(ser.spriteJson, ser.soundDescs, ser.costumeDescs);
        
        const zip = new JSZip();
        zip.file('sprite.json', ser.spriteJson);
        this._addFileDescsToZip(ser.soundDescs.concat(ser.costumeDescs), zip);

        return zip.generateAsync({
            type: typeof optZipType === 'string' ? optZipType : 'blob',
            mimeType: 'application/x.scratch.sprite3',
            compression: 'DEFLATE',
            compressionOptions: {
                level: 6
            }
        }).then(
            data => ({newId: theMd5, data: data})
        );
    }

    _storeSprite (id, {newName, group}){
        log.log('Botch: _storeSprite is called');

        const req = id + newName + group;

        const p = this.exportSprite(id, 'uint8array', newName);
        return p.then(({newId, data}) => {

            this.storageRequestsSize -= 1;
            if (!this.storageRequests[group]) {
                throw new Error(`Botch: sprite storage request was cancelled (group ${group} does not exists anymore)`);
            }
            if (!this.storageRequests[group].has(req)){
                throw new Error(`Botch: sprite storage request was cancelled (key ${req} does not exists anymore in group ${group})`);
            }
            
            let res = null;
            if (this.storageHelper.size >= Scratch3Botch.MAX_STORAGE){
                log.log('Botch: storage full!');
                    
                res = {
                    md5: newId,
                    response: Scratch3Botch.STORAGE_FULL
                };
            } else {
                const target = this.runtime.getTargetById(id);
                log.log('Botch: using newId from md5:', newId);
                
                let parentId = 'parent_0';
            
                if (target.variables &&
                    target.variables.botch_parent &&
                    target.variables.botch_parent.value){
                    const candidate = target.variables.botch_parent.value;
                    if (candidate !== 'parent_0'){
                        if (candidate in this.storageHelper.assets){
                            parentId = target.variables.botch_parent.value;
                        } else {
                            log.warn('Trying to store sprite with parentId not in store, defaulting to parent_0');
                        }
                    }
                } else {
                    log.warn('Trying to store sprite with no valid parentId, defaulting to parent_0');
                }
                
                // log.log('Botch: using newId from md5:', newId);
    
                this.storageHelper._store(
                    this.storage.AssetType.Sprite,
                    this.storage.DataFormat.SB3,
                    data,
                    newId,
                    newName ? newName : target.sprite.name,
                    parentId
                );
                // log.log('Botch: emitting ', Scratch3Botch.BOTCH_STORAGE_HELPER_UPDATE);
                this.runtime.emit(Scratch3Botch.BOTCH_STORAGE_HELPER_UPDATE);
                // log.log('Botch: stored sprite with newId', newId);
                res = {
                    md5: newId,
                    response: 0 // ok
                };
            }
            
            log.log('Botch _storeSprite', p);
            this.storageRequests[group].delete(req);
            const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
            return wait(Scratch3Botch.STORAGE_DELAY)
                .then(() => (res));
        });
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
     * @param {{newName:string, group: string}} options newName   for the sprite, if unspecified uses existing one. the group to which the storage request belongs to.
     * @returns {Promise} A promise returning {md5, response}. NOTE: the md5 is *not* the md5 of
     * the zipped data, because zips md5 is not stable: https://github.com/Stuk/jszip/issues/590
     * @since botch-0.1
     */
    storeSprite (id, options = {newName: '', group: 'default'}) {
        // log.log('Botch: trying to store sprite with original id', id);
        
        options = {newName: '', group: 'default', ...options};
        

        if (!id){
            throw new Error(`Got empty id:${id}!`);
        }
        if (options.newName){
            if (!options.newName.trim()){
                throw new Error('Got all blank name for sprite !');
            }
        }
        if (!this.storageRequests[options.group]){
            this.storageRequests[options.group] = new Set();
        }
        const req = id + options.newName + options.group;
        this.storageRequests[options.group].add(req);
        

        let p = null;
        if (!this.storageLastRequestPromise){
            p = this._storeSprite(id, options);
            this.storageRequestsSize = 0;
        } else { // delay after last is resolved
            p = this.storageLastRequestPromise
                .catch(err => {
                    log.log(err.message);
                })
                .then(() => this._storeSprite(id, options))
                .catch(err => {
                    log.log(err.message);
                });
        }
        
        this.storageRequestsSize += 1;
        this.storageLastRequestPromise = p;
        return p;
    }

    /**
     * @param {?string} group the group to clear if provided, otherwise removes all pending requests.
     * @since botch-0.3
     */
    resetStoragePendingRequests (group){

        if (group){
            if (this.storageRequests[group]){
                this.storageRequests[group].clear();
                delete this.storageRequests[group];
            }
        } else {
            // just to be extra-sure we don't have stuff around
            for (const requestGroup in this.storageRequests){
                this.storageRequests[requestGroup].clear();
            }
            this.storageRequests = [];
        }
        
    }
    
    /**
     * @since botch-0.3
     */
    resetStorage (){
        if (this.storageHelper){
            this.storageHelper.clear();
            this.resetStoragePendingRequests();
            this.runtime.emit(Scratch3Botch.BOTCH_STORAGE_HELPER_UPDATE);
        } else {
            log.log('this.storageHelper undefined, skipping resetStorage');
        }
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
        

        const storage = this.storage;

        const storedSprite = this.storageHelper.assets[id];

        // log.log('storedSprite=', storedSprite);

        return JSZip.loadAsync(storedSprite.data).then(zipObj => {
            const spriteFile = zipObj.file('sprite.json');
            if (!spriteFile) {
                // log.log.error("Couldn't find sprite.json inside stored Sprite !");
                return Promise.resolve(null);

            }
            if (!JSZip.support.uint8array) {
                // log.log.error('JSZip uint8array is not supported in this browser.');
                return Promise.resolve(null);
            }
            return spriteFile.async('string').then(data => {
                // log.log('Botch: unzipped data (only sprite, no costume/sound data):', data);
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

                        // Botch: we added this
                        asset.parentId = storedSprite.parentId;

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
                        // log.log('Botch: completely loaded asset:', asset);
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
            // log.log('libSprites=', ret);
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
        log.log('testStoreSprite...');
        // const id = this.runtime.targets[1].id;

        this.storeSprite(this.runtime.targets[1].id, {newName: 'A'}).then(
            diz => log.log('Got first storeSprite result:', diz)
        );
        this.storeSprite(this.runtime.targets[1].id, {newName: 'B'}).then(
            diz => log.log('Got second storeSprite result:', diz)
        );
        this.storeSprite(this.runtime.targets[1].id, {newName: 'C'}).then(
            diz => log.log('Got third storeSprite result:', diz)
        );
        this.storeSprite(this.runtime.targets[1].id, {newName: 'D'}).then(
            diz => log.log('Got fourth storeSprite result:', diz)
        );

        /*
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
        });*/
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
            if (org.living > max) {
                best = org;
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
