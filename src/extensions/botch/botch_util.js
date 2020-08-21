let _TextEncoder;
if (typeof TextEncoder === 'undefined') {
    _TextEncoder = require('text-encoding').TextEncoder;
} else {
    /* global TextEncoder */
    _TextEncoder = TextEncoder;
}

const {loadCostume} = require('../../import/load-costume.js');
const MathUtil = require('../../util/math-util');

/**
 * Create the new costume asset for the VM
 * @param {storage} storage storage
 * @param {assetType} assetType assetType
 * @param {dataFormat} dataFormat dataFormat
 * @param {data} data data
 * @returns {VMAsset} VMAsset
 * @since botch-0.1
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

class BotchUtil {
    constructor (runtime) {
        this.runtime = runtime;
        this.storage = runtime.storage;
    }

    // <MATH UTIL METHODS>

    rdn (min, max) {
        return (Math.random() * (max - min)) + min;
    }

    // </MATH UTIL METHODS>

    // <LOAD COSTUMES METHODS>

    /**
     * COPIED AND ADAPTED FROM virtual-machine.js
     * Add a costume to the current editing target.
     * @param {string} md5ext - the MD5 and extension of the costume to be loaded.
     * @param {!object} costumeObject Object representing the costume.
     * @param {string} optTargetId - the id of the target to add to, if not the editing target.
     * @param {string} optVersion - if this is 2, load costume as sb2, otherwise load costume as sb3.
     * @returns {?Promise} - a promise that resolves when the costume has been added
     * @since botch-0.1
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
            costume.name = `org_${i + 1}`;
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
     * @since botch-0.1
     */
    uploadCostumeEdit (fileData, id) {
        this.addCostumeFromBuffer(new Uint8Array((new _TextEncoder()).encode(fileData)), id);
    }

    // </LOAD COSTUMES METHODS>

    // <GRAPHICS EFFECTS>

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
                BotchUtil.EFFECT_GHOST_LIMIT.min,
                BotchUtil.EFFECT_GHOST_LIMIT.max);
            break;
        case 'brightness':
            clampedValue = MathUtil.clamp(value,
                BotchUtil.EFFECT_BRIGHTNESS_LIMIT.min,
                BotchUtil.EFFECT_BRIGHTNESS_LIMIT.max);
            break;
        }
        return clampedValue;
    }

    /**
     * Change the effect of the target
     * @param {RenderedTarget} target the target sprite
     * @param {string} effect_ scratch effect
     * @param {number} value scratch effect value
     * @since botch-0.2
     */
    changeGraphicsEffect (target, effect_, value) {
        const effect = effect_.toLowerCase();
        if (!target.effects.hasOwnProperty(effect)) return;
        let newValue = value + target.effects[effect];
        newValue = this.clampEffect(effect, newValue);
        target.setEffect(effect, newValue);
    }

    // </GRAPHICS EFFECTS>

    // <CLONE MANAGEMENT>

    /**
     * Create a clone of a given target
     * @param {RenderedTarget} target the target to clone
     * @returns {clone} new clone
     * @since botch-0.1
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
     * Get all the clones (only) of the selected target (not a clone)
     * @param {string} id id of the target
     * @returns {clones[]} list of clones
     * @since botch-0.1
     */
    getClones (id) {
        // Select all the clone of the sprite
        return this.runtime.targets.filter(
            t => !t.isOriginal && !t.isStage && t.sprite.clones[0].id === id
        );
    }

    /**
     * Delete all the "non original" costumes of a sprite
     * starting with org_
     * @param {target} target target
     * @since botch-0.2
     */
    deleteAllOrgCostumes (target) {
        const costumeNum = target.sprite.costumes.length;
        for (let i = costumeNum - 1; i >= 1; i--) {
            if (target.sprite.costumes[i].name.startsWith('org_')) {
                target.deleteCostume(i);
            }
        }
    }

    /**
     * Delete all the clones of a target
     * @param {string} id id of the target (not a clone)
     * @since botch-0.1
     */
    deleteClones (id) {
        const clones = this.getClones(id);
        clones.forEach(c => {
            this.runtime.disposeTarget(c);
            this.runtime.stopForTarget(c);
        });
    }
    
    // </CLONE MANAGEMENT>
}

module.exports = BotchUtil;
