const vector2 = require('../../util/vector2');

class Vehicle {
    constructor (x, y, sprite_) {
        this.acceleration = new vector2(0, 0);
        this.velocity = new vector2(0, 2);
        this.position = new vector2(x, y);
        this.maxspeed = 8;
        this.maxforce = 0.3;
        this.sprite = sprite_;
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
        // We could add mass here if we want A = F / M
        this.acceleration.add(force);
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
