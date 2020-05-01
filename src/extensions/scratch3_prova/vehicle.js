const vector2 = require('../../util/vector2');

class Vehicle {
    constructor (x, y, mass_, maxforce_, sprite_) {
        this.acceleration = new vector2(0, 0);
        this.velocity = new vector2(0, 2);
        this.position = new vector2(x, y);
        this.maxspeed = 8;
        this.maxforce = maxforce_; // agility ?
        this.sprite = sprite_;
        this.mass = mass_;
    }
  
    /**
     * Since that the object will be instantiated only once, this function
     * will change the new arguments that will be passed.
     *
     * If we change manually the position, mass or maxforce of the sprite
     * @param {Number} x_
     * @param {Number} y_
     * @param {Number} mass_
     * @param {Number} maxforce_
     */

    changeArgs (mass_, maxforce_) {
        this.position.x = parseFloat(this.sprite.x);
        this.position.y = parseFloat(this.sprite.y);
        this.mass = parseFloat(mass_);
        this.maxforce = parseFloat(maxforce_);
    }

    // Method to update location
    update () {
        // Update velocity
        this.velocity.add(this.acceleration);
        // Limit speed
        this.velocity.limit(this.maxspeed);
        this.position.add(this.velocity);
        // Update sprite postion
        this.sprite.setXY(this.position.x, this.position.y);
        // Reset acceleration 0 each cycle
        this.acceleration.mult(0);
    }
  

    applyForce (force) {
        // With mass
        const f = new vector2(force.x, force.y);
        f.div(this.mass);

        this.acceleration.add(f);
    }
  
    // A method that calculates a steering force towards a target
    // STEER = DESIRED MINUS VELOCITY
    seek (x_, y_) {

        const target = new vector2(x_, y_);

        const desired = vector2.sub(target, this.position); // A vector pointing from the location to the target
  
        // Scale to maximum speed
        desired.setMag(this.maxspeed);
  
        // Steering = Desired minus velocity
        const steer = vector2.sub(desired, this.velocity);
        steer.limit(this.maxforce); // Limit to maximum steering force
  
        this.applyForce(steer);
    }
  
    display () {
        
    }
}

module.exports = Vehicle;
