const vector2 = require('../../util/vector2');
class Food {
    constructor (x, y) {
        this.position = new vector2(x, y);
    }
}

module.exports = Food;
