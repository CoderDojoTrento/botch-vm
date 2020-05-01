/* eslint-disable no-negated-condition */
const ArgumentType = require('../../extension-support/argument-type');
const BlockType = require('../../extension-support/block-type');
const Cast = require('../../util/cast');
const MathUtil = require('../../util/math-util');
const log = require('../../util/log');
const Vehicle = require('./vehicle');

class Scratch3Prova {
    constructor (runtime) {
        this.runtime = runtime;
        this.child = '';
        this.vehicleMap = new Map();
    }

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
        return this.runtime.targets.filter(t => t.isOriginal && !t.isStage).map(t => t.getName());
    }

    var1 () {
        return this.child;
    }

    crossover (args/* , util */) {
        const text1 = Cast.toString(args.TEXT_1);
        const text2 = Cast.toString(args.TEXT_2);
        this.child = text1.slice(0, (text1.length / 2)) + text2.slice(text2.length / 2, text2.length);
        log.log(this.child);
        /* console.log('args =', args);
        console.log('util = ', util.target.id); */
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
        // Check if is already instantiated
        if (!this.vehicleMap.get(util.target.id)) {
            this.vehicleMap.set(util.target.id, (
                new Vehicle(util.target.x, util.target.y, parseFloat(args.MASS), parseFloat(args.AGILITY), util.target)
            ));
        } else {
            // This line can be more efficient
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

        /*  console.log('args =', args);
        console.log('util = ', util); */
        
    }
}

module.exports = Scratch3Prova;
