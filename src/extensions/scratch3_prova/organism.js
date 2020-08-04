const Vehicle = require('./vehicle');
const Vector2 = require('../../util/vector2');

class Organism extends Vehicle {
    /**
     * Class Organism
     * @param {RenderedTarget} target_ target (sprite)
     * @param {number} mass_ mass of the vehicle
     * @param {number} maxForce_ max force of the vehicle
     * @param {string} svg_  new svg of the organism
     */
    constructor (target_, mass_ = 1, maxForce_ = 0.3, svg_) {
        super(target_, mass_, maxForce_);
        this.svg = svg_;
        this.health = 1;
        this.renderer = this.target.renderer;
        this.dna = [];
        this.dna[0] = (Math.random() * 10) - 5; // food attraction
        this.dna[1] = (Math.random() * 10) - 5; // poison attraction
        this.dna[2] = Math.random() * 100; // food perception
        this.dna[3] = Math.random() * 100; // poison perception
    }

    behaviors (good, bad) {
        const steerG = this.eat(good, 0.2, this.dna[2]);
        const steerB = this.eat(bad, -0.5, this.dna[3]);

        steerG.mult(this.dna[0]);
        steerB.mult(this.dna[1]);

        this.applyForce(steerG);
        this.applyForce(steerB);
    }
    
    /**
     * Eat the list passed and set the health of the organism
     * according to the nutrition
     * @param {Map} list food or poison
     * @param {number} nutrition value for health
     * @param {number} perception distance to see object
     * @returns {Vector2} steer force
     */
    eat (list, nutrition, perception) {
        let record = Infinity;
        let closest = null;
        const stageW = this.target.runtime.constructor.STAGE_WIDTH;
        const stageH = this.target.runtime.constructor.STAGE_HEIGHT;

        for (const f of list.values()) {
            const d = new Vector2(f.x, f.y).dist(new Vector2(this.target.x, this.target.y));

            // If is close to food (eat) change the position if is original
            // otherwise delete the clone
            // Easier
            if (this.isTouchingObject(f)) { // there is no isTouchingSprite() with a specific ID
                this.health += nutrition;
                if (f.isOriginal) {
                    f.setXY((Math.random() - 0.5) * stageW, (Math.random() - 0.5) * stageH);
                } else {
                    this.target.runtime.disposeTarget(f);
                    this.target.runtime.stopForTarget(f);
                    list.delete(f.id);
                }
            } else if (d < record && d < perception) {
                record = d;
                closest = f;
            }
        }
        
        if (closest) {
            return this.seek(closest.x, closest.y);
        }

        return new Vector2(0, 0);
    }

    /**
     * Check if the sprite touch the object
     * @param {RenderedTarget} obj object to check if touched
     * @returns {boolean} true if is touched
     */
    isTouchingObject (obj) {
        if (!obj || !this.renderer) {
            return false;
        }
        if (this.renderer._allDrawables) {
            return this.renderer.isTouchingDrawables(
                this.target.drawableID, [obj.drawableID]);
        }
    }

    /**
     * Check if the organism is dead
     * @returns {boolean} dead or not
     */
    dead () {
        return (this.health < 0);
    }

    // A method that calculates a steering force towards a target
    // STEER = DESIRED MINUS VELOCITY
    // REDEFINE the method instead of applyForce it returns the steer
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

    // Method to update location
    update () {
        this.health -= 0.005;
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

    // Constrain the vehicles inside the stage
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

module.exports = Organism;
