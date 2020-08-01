const Vehicle = require('./vehicle');

class Organism extends Vehicle {
    constructor (x, y, mass_ = 1, maxForce_ = 0.3, target_, svg_, dna_) {
        super(x, y, mass_, maxForce_, target_);
        this.svg = svg_;
        this.dna = dna_;
    }

    seekFood (food) {
        let record = Infinity;
        let closest = null;
        food.forEach(f => {
            const d = f.position.dist(this.position);
            if (d < record) {
                record = d;
                closest = f;
            }
        });
                
        this.seek(closest.position.x, closest.position.y);
    }
        
}

module.exports = Organism;
