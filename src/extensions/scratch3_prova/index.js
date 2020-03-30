const ArgumentType = require('../../extension-support/argument-type');
const BlockType = require('../../extension-support/block-type');
const Cast = require('../../util/cast');
const log = require('../../util/log');

class Scratch3Prova {
    constructor (runtime) {
        this.runtime = runtime;
        this.child = "";
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
                            defaultValue: "abcde"
                        },
                        TEXT_2: {
                            type: ArgumentType.STRING,
                            defaultValue: "fghilm"
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
                            defaultValue: "aaaaa"
                        }
                    }
                }
            ],
            menus: {
            }
        };
    }

    var1 (args) {
        return this.child;
    }

    crossover (args) {
        let text1 = Cast.toString(args.TEXT_1);
        let text2 = Cast.toString(args.TEXT_2);
        this.child = text1.slice(0, (text1.length/2)) + text2.slice(text2.length/2, text2.length);
        log.log(this.child);
    }
}

module.exports = Scratch3Prova;