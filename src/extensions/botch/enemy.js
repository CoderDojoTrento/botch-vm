const Vector2 = require('./vector2');
const MathUtil = require('../../util/math-util');

/**
 * @since botch-0.2
 */
class Enemy {
    /**
     * Class Enemy
     * @param {RenderedTarget} target_ target (sprite)
     * @param {number} mass_ mass of the vehicle
     * @param {number} maxForce_ max force of the vehicle
     */
    constructor (target_, mass_ = 1, maxForce_ = 0.3) {
        this.acceleration = new Vector2(0, 0);
        this.velocity = new Vector2(0, 2);
        this.position = new Vector2(target_.x, target_.y);
        this.maxSpeed = 4;
        this.maxForce = maxForce_; // agility ?
        this.target = target_;
        this.mass = mass_;
        this.perception = 100;
    }

    /**
     * Since that the object will be instantiated only once, this function
     * will change the new arguments that will be passed.
     * UPDATE THE LOCATION IF THE SPRITE IS MANUALLY MOVED
     *
     * If we change manually the position, mass or maxForce of the sprite
     * @param {number} mass_ mass
     * @param {number} maxForce_ maxForce
     */
    refreshArgs (mass_, maxForce_) {
        this.position.x = parseFloat(this.target.x);
        this.position.y = parseFloat(this.target.y);
        this.mass = parseFloat(mass_);
        this.maxForce = parseFloat(maxForce_);
    }

    /**
     * Behave with enemies
     * ApplyForce is called here and not in seek
     * @param {Map} organism the organism map
     * @since botch-0.1
     */
    behaviors (organism) {
        const steerO = this.attack(organism);
        steerO.mult(0.8); // TODO TO DEFINE
        this.applyForce(steerO);
    }
    
    /**
     * Similar to Organism.eat but no sprites are deleted
     * @param {Map} organism organism
     * @param {number} perception_ max distance to organism
     * @returns {Vector2} seek force
     * @since botch-0.2
     */
    attack (organism, perception_) {
        let record = Infinity;
        const perception = this.perception || perception_;
        let closest = null;

        for (const o of organism.values()) {
            if (!o.target.isOriginal) { // do not consider the original
                const d = new Vector2(o.target.x, o.target.y).dist(new Vector2(this.target.x, this.target.y));
                if (d < record && d < perception) {
                    record = d;
                    closest = o;
                }
            }
        }

        if (closest && closest.health > 0) {
            return this.seek(closest.target.x, closest.target.y);
        }

        return new Vector2(0, 0);
    }

    /**
     * A method that calculates a steering force towards a target
     * STEER = DESIRED MINUS VELOCITY
     * REDEFINE the method instead of applyForce it returns the steer
     * @param {number} x x coordinate
     * @param {number} y y coordinate
     * @returns {Vector2} steer force
     * @since botch-0.1
     */
    seek (x, y) {
        const targetS = new Vector2(x, y);

        const desired = Vector2.sub(targetS,
            (new Vector2(this.target.x, this.target.y))); // A vector pointing from the location to the target

        // Scale to maximum speed
        desired.setMag(this.maxSpeed);

        // Steering = Desired minus velocity
        const steer = Vector2.sub(desired, this.velocity);
        steer.limit(this.maxForce); // Limit to maximum steering force

        this.pointTarget();

        return steer;
        // this.applyForce(steer);
    }

    /**
     * Method to update location
     * @since botch-0.1
     */
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

    /**
     * Apply the force to the vehicle
     * @param {Vector2} force force
     * @since botch-0.1
     */
    applyForce (force) {
        // With mass
        const f = new Vector2(force.x, force.y);
        f.div(this.mass);

        this.acceleration.add(f);
    }

    /**
     * Point towards the target
     * @since botch-0.1
     */
    pointTarget () {
        const direction = 90 - MathUtil.radToDeg(this.velocity.heading());
        this.target.setDirection(direction);
    }

    /**
     * Constrain the vehicles inside the stage
     * @param {number} width with of the space where the organism should stay
     * @param {number} height height of the space where the organism should stay
     */
    boundaries (width, height) {
        const d = 5;

        let desired = null;

        if (this.target.x + (width / 2) < d) {
            desired = new Vector2(this.maxSpeed, this.velocity.y);
        } else if (this.position.x > (width / 2) - d) {
            desired = new Vector2(-this.maxSpeed, this.velocity.y);
        }

        if (this.position.y + (height / 2) < d) {
            desired = new Vector2(this.velocity.x, this.maxSpeed);
        } else if (this.position.y > (height / 2) - d) {
            desired = new Vector2(this.velocity.x, -this.maxSpeed);
        }

        if (desired !== null) {
            desired.normalize();
            desired.mult(this.maxSpeed);
            const steer = Vector2.sub(desired, this.velocity);
            steer.limit(this.maxForce);
            this.applyForce(steer);
        }
    }

}

module.exports = Enemy;
