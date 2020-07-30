const Vehicle = require('./vehicle');

class Organism extends Vehicle {
    constructor (x, y, mass_, maxForce_, sprite_, svg_, dna_) {
        super(x, y, mass_, maxForce_, sprite_);
        this.svg = svg_;
        this.dna = dna_;
    }
        
}

module.exports = Organism;
