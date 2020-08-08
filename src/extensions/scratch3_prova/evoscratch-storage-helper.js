
const md5 = require('js-md5');

//const log = require('./log');
scratchStorage = require('scratch-storage');

const Asset = scratchStorage.Asset;
const AssetType = scratchStorage.AssetType;
const DataFormat = scratchStorage.DataFormat;
//const Helper = require('scratch-storage/Helper');
const Helper = require('scratch-storage/src/Helper.js');


/**
 * @typedef {object} BuiltinAssetRecord
 * @property {AssetType} type - The type of the asset.
 * @property {DataFormat} format - The format of the asset's data.
 * @property {?string} id - The asset's unique ID.
 * @property {Buffer} data - The asset's data.
 */

/**
 * @type {BuiltinAssetRecord[]}
 * @since evoscratch-0.1
 */
const EvoScratchBuiltinAssets = [
    /** TODO PUT OURS
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
 * Default sprites, in a format suitable for libraries
 * TODO Substitute Scratch sprites with our own, 
 * for now I just prepended 'Mutant'
 * @since evoscratch-0.1
 */
const DEFAULT_LIBRARY_SPRITES = [
    {
        "name": "Mutant Beetle",               
        "md5": "46d0dfd4ae7e9bfe3a6a2e35a4905eae.svg",
        "type": "sprite",
        "tags": [
            "animals",
            "insect",
            "bug",
            "antennae",
            "evoscratch",
            "mutant"
        ],
        "info": [
            0,
            1,
            1
        ],
        "json": {
            "isStage": false,
            "name": "Mutant Beetle",
            "variables": {},
            "lists": {},
            "broadcasts": {},
            "blocks": {},
            "comments": {},
            "currentCostume": 0,
            "costumes": [
                {
                    "assetId": "46d0dfd4ae7e9bfe3a6a2e35a4905eae",
                    "name": "beetle",
                    "bitmapResolution": 1,
                    "md5ext": "46d0dfd4ae7e9bfe3a6a2e35a4905eae.svg",
                    "dataFormat": "svg",
                    "rotationCenterX": 43,
                    "rotationCenterY": 38
                }
            ],
            "sounds": [
                {
                    "assetId": "83a9787d4cb6f3b7632b4ddfebf74367",
                    "name": "pop",
                    "dataFormat": "wav",
                    "format": "",
                    "rate": 44100,
                    "sampleCount": 1032,
                    "md5ext": "83a9787d4cb6f3b7632b4ddfebf74367.wav"
                }
            ],
            "volume": 100,
            "layerOrder": 9,
            "visible": true,
            "x": 77,
            "y": -42,
            "size": 100,
            "direction": 90,
            "draggable": false,
            "rotationStyle": "all around",
            "objName": "MutantBeetle"
        }
    },
    {
        "name": "Mutant Ladybug1",
        "md5": "169c0efa8c094fdedddf8c19c36f0229.svg",
        "type": "sprite",
        "tags": [
            "animals",
            "insect",
            "bug",
            "antennae"
        ],
        "info": [
            0,
            1,
            1
        ],
        "json": {
            "isStage": false,
            "name": "Mutant Ladybug1",
            "variables": {},
            "lists": {},
            "broadcasts": {},
            "blocks": {},
            "comments": {},
            "currentCostume": 0,
            "costumes": [
                {
                    "assetId": "169c0efa8c094fdedddf8c19c36f0229",
                    "name": "ladybug2",
                    "bitmapResolution": 1,
                    "md5ext": "169c0efa8c094fdedddf8c19c36f0229.svg",
                    "dataFormat": "svg",
                    "rotationCenterX": 41,
                    "rotationCenterY": 43
                }
            ],
            "sounds": [
                {
                    "assetId": "83a9787d4cb6f3b7632b4ddfebf74367",
                    "name": "pop",
                    "dataFormat": "wav",
                    "format": "",
                    "rate": 44100,
                    "sampleCount": 1032,
                    "md5ext": "83a9787d4cb6f3b7632b4ddfebf74367.wav"
                }
            ],
            "volume": 100,
            "layerOrder": 23,
            "visible": true,
            "x": -90,
            "y": 42,
            "size": 100,
            "direction": 90,
            "draggable": false,
            "rotationStyle": "all around",
            "objName": "Mutant Ladybug1"
        }
    },
]


/**
 * In-memory storage for EvoScratch assets
 * 
 * Mostly copied from scratch-storage.js  BuiltinHelper
 * @since evoscratch-0.1
 */
class EvoScratchStorageHelper extends Helper {
    constructor (parent) {        
        super(parent);
        
        /**
         * In-memory storage for EvoScratch assets
         * @type {Object.<AssetType, AssetIdMap>} Maps asset type to a map of asset ID to actual assets.
         * @typedef {Object.<string, BuiltinAssetRecord>} AssetIdMap - Maps asset ID to asset.
         */
        this.assets = {};

        EvoScratchBuiltinAssets.forEach(assetRecord => {
            assetRecord.id = this._store(assetRecord.type, assetRecord.format, assetRecord.data, assetRecord.id);
        });
    }

    /**
     * Call `setDefaultAssetId` on the parent `ScratchStorage` instance to register all built-in default assets.
     * @since evoscratch-0.1
     */
    registerDefaultAssets () {
        const numAssets = DefaultAssets.length;
        for (let assetIndex = 0; assetIndex < numAssets; ++assetIndex) {
            const assetRecord = DefaultAssets[assetIndex];
            this.parent.setDefaultAssetId(assetRecord.type, assetRecord.id);
        }
    }


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
     * @deprecated Use EvoScratchStorageHelper.store
     * @param {AssetType} assetType - The type of the asset to cache.
     * @param {DataFormat} dataFormat - The dataFormat of the data for the cached asset.
     * @param {Buffer} data - The data for the cached asset.
     * @param {string} id - The id for the cached asset.
     * @returns {string} The calculated id of the cached asset, or the supplied id if the asset is mutable.
     * @since evoscratch-0.1
     */
    cache (assetType, dataFormat, data, id) {
        log.warn('Deprecation: EvoScratchStorageHelper.cache has been replaced with EvoScratchStorageHelper.store.');
        return this.store(assetType, dataFormat, data, id);
    }

    /**
     * EvoScratch: we can use this one even if it supposed to be private, 
     * since as of (Aug 2020) using store() from ScratchStorage only stores 
     * via default webhelper stores
     * 
     * Cache an asset for future lookups by ID.
     * @param {AssetType} assetType - The type of the asset to cache.
     * @param {DataFormat} dataFormat - The dataFormat of the data for the cached asset.
     * @param {Buffer} data - The data for the cached asset.
     * @param {(string|number)} id - The id for the cached asset.
     * @returns {string} The calculated id of the cached asset, or the supplied id if the asset is mutable.
     */
    _store (assetType, dataFormat, data, id) {
        if (!dataFormat) throw new Error('Data cached without specifying its format');
        if (id !== '' && id !== null && typeof id !== 'undefined') {
            if (this.assets.hasOwnProperty(id) && assetType.immutable) return id;
        } else if (assetType.immutable) {
            id = md5(data);
        } else {
            throw new Error('Tried to cache data without an id');
        }
        this.assets[id] = {
            type: assetType,
            format: dataFormat,
            id: id,
            data: data
        };
        return id;
    }

    /**
     * Fetch an asset but don't process dependencies.
     * @param {AssetType} assetType - The type of asset to fetch.
     * @param {string} assetId - The ID of the asset to fetch: a project ID, MD5, etc.
     * @return {?Promise.<Asset>} A promise for the contents of the asset.
     * @since evoscratch-0.1
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
     * @since evoscratch 0.1
     */    
    get_all_tags(){
        s = new Set()
        for (const id in this.assets){
            asset = this.assets[id]
            if (asset.tags){
                for (tag of assets.tags){
                    s.add(tag)
                }
            }
        }
        for (asset in DEFAULT_LIBRARY_SPRITES){            
            if (asset.tags){
                for (tag of assets.tags){
                    s.add(tag)
                }
            }
        }

        let sorted = Array.from(s);
        sorted.sort();
        ret = []
        for (tag of sorted){
            ret.push({tag: tag, tag}); //intlLabel: messages.animals})
        }
        return ret;
    }
    
    /**
     * Loads a sprite from the store and outputs a Promise containing 
     * the sprite in a format suitable to be viewed in a library panel
     * 
     * @since evoscratch-0.1
     * @param id 
     */
    load_library_sprite(id){
        
        const JSZip = require('jszip');

        const storage = this.parent;
        
        let storedSprite = this.assets[id];

        console.log('storedSprite=',storedSprite);
        
        return JSZip.loadAsync(storedSprite.data).then((zipObj)=>{
            let spriteFile = zipObj.file('sprite.json');
            if (!spriteFile) {
                log.error("Couldn't find sprite.json inside stored Sprite !");
                return Promise.resolve(null);
                
            }
            if (!JSZip.support.uint8array) {
                log.error('JSZip uint8array is not supported in this browser.');
                return Promise.resolve(null);
            }
            return spriteFile.async('string').then(data => {
                console.log('EvoScratch: unzipped data:', data)
                sprite = JSON.parse(data);
                
                // in deserialize-assets is written:
                //    "Zip will not be provided if loading project json from server"
                //let zip = null;
                //const sb3 = require('../../serialization/sb3');   
                // deserialize injects lots of runtime stuff we don't need              
                //return sb3.deserialize(obj, this.runtime, zip, true)
                //    .then(({targets, extensions}) => {   
                //        if (targets.length > 1){
                //            console.error(targets);
                //            throw new Error("Found more than one target!!")
                //        }
                asset = {}
                asset.type = storage.AssetType.Sprite;
                // storage.DataFormat.SB3,
                asset.tags = [
                    "evoscratch",                
                ]
                asset.info = [   // TODO What is this ??
                    0,
                    1,
                    1
                ]
                

                // TODO what about the id? createAsset setss assetId and assetName
                asset.name = sprite.name
                asset.md5 =  sprite.costumes && sprite.costumes[0].md5ext;
                asset.json = sprite; // TODO
                sprite.objName = sprite.name;
                    //this.installTargets(targets, extensions, false)
                return asset
                  
            });            
        });   
        
    }
    
    /**
     * Loads all sprites from the store and outputs a Promise containing 
     * the sprites in a format suitable to be viewed in a library panel
     * 
     * @see load_library_sprite     
     * @since evoscratch-0.1     
     */    
    load_library_sprites(){
        ret = []
        for (const id in this.assets){
            ret.push(this.load_library_sprite(id))
        }
        return Promise.all(ret).then((lib_sprites)=>{
            console.log('lib_sprites=',lib_sprites)
            return lib_sprites.concat(DEFAULT_LIBRARY_SPRITES);
        });
                
    }

}

module.exports = EvoScratchStorageHelper;
