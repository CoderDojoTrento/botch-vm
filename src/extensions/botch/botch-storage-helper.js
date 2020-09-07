const md5 = require('js-md5');

// const log = require('./log');
const scratchStorage = require('scratch-storage');
const log = require('../../util/log');
const Asset = scratchStorage.Asset;
/* const AssetType = scratchStorage.AssetType;
const DataFormat = scratchStorage.DataFormat; */
// const Helper = require('scratch-storage/Helper');
const Helper = require('scratch-storage/src/Helper.js');

const DEFAULT_BOTCH_SPRITES = require('./default-botch-sprites.js');


/**
 * @typedef {object} BuiltinAssetRecord
 * @property {AssetType} type - The type of the asset.
 * @property {DataFormat} format - The format of the asset's data.
 * @property {?string} id - The asset's unique ID.
 * @property {Buffer} data - The asset's data.
 */

/**
 * @type {BuiltinAssetRecord[]}
 * @since botch-0.1
 */
const BotchBuiltinAssets = [
    /** TO DO PUT OURS
    {
        type: AssetType.ImageBitmap,
        format: DataFormat.PNG,
        id: null,
        data: new Buffer(
            require('!arraybuffer-loader!./builtins/defaultBitmap.png') // eslint-disable-line global-require
        )
    },
    {
        type: AssetType.Sound,
        format: DataFormat.WAV,
        id: null,
        data: new Buffer(
            require('!arraybuffer-loader!./builtins/defaultSound.wav') // eslint-disable-line global-require
        )
    },
    {
        type: AssetType.ImageVector,
        format: DataFormat.SVG,
        id: null,
        data: new Buffer(
            require('!arraybuffer-loader!./builtins/defaultVector.svg') // eslint-disable-line global-require
        )
    }
     */
];
/**
 * In-memory storage for Botch assets
 *
 * Mostly copied from scratch-storage.js  BuiltinHelper
 * @since botch-0.1
 */
class BotchStorageHelper extends Helper {
    constructor (parent) {
        super(parent);

        /**
         * In-memory storage for Botch assets
         *
         * Maps asset type to a map of asset ID to actual assets.
         *
         * @type {Object.<AssetType, AssetIdMap>}
         * @typedef {Object.<string, BuiltinAssetRecord>} AssetIdMap
         */
        this.assets = {};

        BotchBuiltinAssets.forEach(assetRecord => {
            assetRecord.id = this._store(assetRecord.type, assetRecord.format,
                assetRecord.data, assetRecord.id, assetRecord.name);
        });
    }

    /**
     * Call `setDefaultAssetId` on the parent `ScratchStorage` instance to register all built-in default assets.
     * @since botch-0.1
     */
    // COMMENTED FOR DefaultBotchSprites not defined Raffaele
    /* registerDefaultAssets () {
        const numAssets = DefaultBotchSprites.length;
        for (let assetIndex = 0; assetIndex < numAssets; ++assetIndex) {
            const assetRecord = DefaultBotchSprites[assetIndex];
            this.parent.setDefaultAssetId(assetRecord.type, assetRecord.id);
        }
    } */


    /**
     * Synchronously fetch a cached asset for a given asset id. Returns null if not found.
     * @param {string} assetId - The id for the asset to fetch.
     * @returns {?Asset} The asset for assetId, if it exists.
     */
    get (assetId) {
        let asset = null;
        if (this.assets.hasOwnProperty(assetId)) {
            /** @type{BuiltinAssetRecord} */
            const assetRecord = this.assets[assetId];
            asset = new Asset(assetRecord.type, assetRecord.id, assetRecord.format, assetRecord.data);
        }
        return asset;
    }

    /**
     * Alias for store (old name of store)
     * @deprecated Use BotchStorageHelper.store
     * @param {AssetType} assetType - The type of the asset to cache.
     * @param {DataFormat} dataFormat - The dataFormat of the data for the cached asset.
     * @param {Buffer} data - The data for the cached asset.
     * @param {string} id - The id for the cached asset.
     * @returns {string} The calculated id of the cached asset, or the supplied id if the asset is mutable.
     * @since botch-0.1
     */
    cache (assetType, dataFormat, data, id) {
        log.log.warn('Deprecation: BotchStorageHelper.cache has been replaced with BotchStorageHelper.store.');
        return this.store(assetType, dataFormat, data, id);
    }

    /**
     * Botch: we can use this one even if it supposed to be private,
     * since as of (Aug 2020) using store() from ScratchStorage only stores
     * via default webhelper stores
     *
     * Cache an asset for future lookups by ID.
     * @param {AssetType} assetType - The type of the asset to cache.
     * @param {DataFormat} dataFormat - The dataFormat of the data for the cached asset.
     * @param {Buffer} data - The data for the cached asset.
     * @param {(string|number)} id - The id for the cached asset.
     * @param {string} name - The name for the cached asset (Botch: we added it)
     * @param {string} parentId - The id of the parent. If missing, use parent_0 (Botch: we added it)
     
     * @returns {string} The calculated id of the cached asset, or the supplied id if the asset is mutable.
     */
    _store (assetType, dataFormat, data, id, name, parentId) {
        if (!name){
            throw new Error(`Missing name:${name}`);
        }
        if (!name.trim()){
            throw new Error('Provided name is all blank !');
        }
        if (parentId !== 'parent_0'){
            if (!parentId){
                throw new Error(`Missing parentId:${parentId}`);
            }
            if (!parentId.trim()){
                throw new Error('Provided parentId is all blank !');
            }
            if (!(parentId in this.assets)){
                throw new Error('Provided parentId is not in assets !');
            }
        }
        
        if (!dataFormat) throw new Error('Data cached without specifying its format');
        if (id !== '' && id !== null && typeof id !== 'undefined') {
            if (this.assets.hasOwnProperty(id) && assetType.immutable) {
                log.log('Item already stored !');
                return id;
            }
        } else if (assetType.immutable) {
            id = md5(data);
        } else {
            throw new Error('Tried to cache data without an id');
        }
        this.assets[id] = {
            type: assetType,
            format: dataFormat,
            id: id,
            data: data,
            name: name,
            parentId: parentId
        };
        return id;
    }

    /**
     * Fetch an asset but don't process dependencies.
     * @param {AssetType} assetType - The type of asset to fetch.
     * @param {string} assetId - The ID of the asset to fetch: a project ID, MD5, etc.
     * @return {?Promise.<Asset>} A promise for the contents of the asset.
     * @since botch-0.1
     */
    load (assetType, assetId) {
        if (!this.get(assetId)) {
            // Return null immediately so Storage can quickly move to trying the
            // next helper.
            return null;
        }
        return Promise.resolve(this.get(assetId));
    }

    /**
     * Returns a list with all the tags of the sprites
     *
     * @returns {object[]} list
     * @since botch 0.1
     */
    getAllTags () {
        const s = new Set();
        for (const id in this.assets) {
            const asset = this.assets[id];
            if (asset.tags) {
                for (const tag of asset.tags) {
                    s.add(tag);
                }
            }
        }
        for (const asset in DEFAULT_BOTCH_SPRITES) {
            if (asset.tags) {
                for (const tag of asset.tags) {
                    s.add(tag);
                }
            }
        }

        const sorted = Array.from(s);
        sorted.sort();
        const ret = [];
        for (const tag of sorted) {
            ret.push({tag: tag, intlLabel: tag}); // intlLabel: messages.animals})
        }
        return ret;
    }

    /**
     * Resets the store
     *
     * @since botch-0.3
     */
    clear (){
        this.assets = {};
    }

}

module.exports = BotchStorageHelper;
