const Vector2 = require('../../util/vector2');
const MathUtil = require('../../util/math-util');

class Vehicle {
    /**
     * Vehicle class
     * @param {RenderedTarget} target_ target
     * @param {number} mass_ mass
     * @param {number} maxForce_ maxForce
     */
    constructor (target_, mass_, maxForce_) {
        this.acceleration = new Vector2(0, 0);
        this.velocity = new Vector2(0, 2);
        this.position = new Vector2(target_.x, target_.y);
        this.maxSpeed = 5;
        this.maxForce = maxForce_; // agility ?
        this.target = target_;
        this.mass = mass_;
    }
  
    /**
     * Since that the object will be instantiated only once, this function
     * will change the new arguments that will be passed.
     * UPDATE THE LOCATION IF THE SPRITE IS MANUALLY MOVED
     *
     * If we change manually the position, mass or maxForce of the sprite
     * @param {Number} x_
     * @param {Number} y_
     * @param {Number} mass_
     * @param {Number} maxForce_
     */

    refreshArgs (mass_, maxForce_) {
        this.position.x = parseFloat(this.target.x);
        this.position.y = parseFloat(this.target.y);
        this.mass = parseFloat(mass_);
        this.maxForce = parseFloat(maxForce_);
    }

    // Method to update location
    update () {
        // Update velocity
        this.velocity.add(this.acceleration);
        // Limit speed
        this.velocity.limit(this.maxSpeed);
        this.position.add(this.velocity);
        // Update sprite position
        this.target.setXY(this.position.x, this.position.y);
        // Reset acceleration 0 each cycle
        this.acceleration.mult(0);
    }
  

    applyForce (force) {
        // With mass
        const f = new Vector2(force.x, force.y);
        f.div(this.mass);

        this.acceleration.add(f);
    }
  
    // A method that calculates a steering force towards a target
    // STEER = DESIRED MINUS VELOCITY
    seek (x, y) {

        const targetS = new Vector2(x, y);

        const desired = Vector2.sub(targetS,
            (new Vector2(this.target.x, this.target.y))); // A vector pointing from the location to the target
  
        // Scale to maximum speed
        desired.setMag(this.maxSpeed);
  
        // Steering = Desired minus velocity
        const steer = Vector2.sub(desired, this.velocity);
        steer.limit(this.maxForce); // Limit to maximum steering force
  
        this.applyForce(steer);
    }

    /**
     * Point towards the target
    */

    pointTarget () {
        const direction = 90 - MathUtil.radToDeg(this.velocity.heading());
        this.target.setDirection(direction);
    }
}

module.exports = Vehicle;
