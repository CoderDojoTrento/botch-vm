let _TextEncoder;
if (typeof TextEncoder === 'undefined') {
    _TextEncoder = require('text-encoding').TextEncoder;
} else {
    /* global TextEncoder */
    _TextEncoder = TextEncoder;
}

const Vector2 = require('./vector2');
const MathUtil = require('../../util/math-util');
const svgen = require('./svg-generator');
const Enemy = require('./enemy');
const BotchUtil = require('./botchUtil');

/**
 * @since botch-0.1
 */
class Organism {
    /**
     * Class Organism
     * @param {RenderedTarget} target_ target (sprite)
     * @param {number} mass_ mass of the vehicle
     * @param {number} maxForce_ max force of the vehicle
     * @param {string} svg_  new svg of the organism
     * @param {Array} dna dna
     */
    constructor (target_, mass_ = 1, maxForce_ = 0.5, svg_, dna) {
        this.acceleration = new Vector2(0, 0);
        this.velocity = new Vector2(1, 2);
        this.position = new Vector2(target_.x, target_.y);
        this.maxSpeed = 5;
        this.maxForce = maxForce_; // agility ?
        this.target = target_;
        this.mass = mass_;
        this.svg = svg_;
        this.health = 1;
        this.renderer = this.target.renderer;
        this.runtime = this.target.runtime;
        this.storage = this.runtime.storage;
        this.mr = 0.01;
        this.living = 0; // performance.now();
        this.effectStep = 7;
        this.currEffectStep = this.effectStep;
        this.effectSign = 1;

        this.botchUtil = new BotchUtil(this.runtime);

        this.dna = [];

        if (dna) {
            // Mutation
            this.dna[0] = dna[0];
            if (Math.random() < this.mr) {
                this.dna[0] += this.botchUtil.rdn(-0.3, 0.3);
            }
            this.dna[1] = dna[1];
            if (Math.random() < this.mr) {
                this.dna[1] += this.botchUtil.rdn(-0.3, 0.3);
            }
            this.dna[2] = dna[2];
            if (Math.random() < this.mr) {
                this.dna[2] += this.botchUtil.rdn(-15, 15);
            }
            this.dna[3] = dna[3];
            if (Math.random() < this.smr) {
                this.dna[3] += this.botchUtil.rdn(-15, 15);
            }
        } else {
            this.dna[0] = (Math.random() * 10) - 5; // food attraction
            this.dna[1] = (Math.random() * 10) - 5; // poison attraction
            this.dna[2] = Math.random() * 150; // food perception
            this.dna[3] = Math.random() * 150; // poison perception
        }

        this.svg = new svgen(130, 130).generateMultiple(this.dna[0], this.dna[1], 5);
        this.botchUtil.uploadCostumeEdit(this.svg, this.target.id);

        // Variable assignment to the sprite
        // each clone has the its own dna saved and the dna of the non-clone target
        this.target.lookupOrCreateList(this.target.id, `dna_${this.target.id}`);
        const list = this.target.lookupOrCreateList(
            this.target.id, `dna_${this.target.id}`);
        this.dna.forEach(element => {
            list.value.push(element);
        });
        list._monitorUpToDate = false;
    }

    /**
     * Since that the object will be instantiated only once, this function
     * will change the new arguments that will be passed.
     * UPDATE THE LOCATION IF THE SPRITE IS MANUALLY MOVED
     *
     * If we change manually the position, mass or maxForce of the sprite
     * @param {number} mass_ mass
     * @param {number} maxForce_ maxForce
     * @since botch-0.1
     */
    refreshArgs (mass_, maxForce_) {
        this.position.x = parseFloat(this.target.x);
        this.position.y = parseFloat(this.target.y);
        this.mass = parseFloat(mass_);
        this.maxForce = parseFloat(maxForce_);
    }

    /**
     * Behave with food and poison
     * ApplyForce is called here and not in seek
     * @param {Map} good food map or some sprites that rise the health
     * @param {Map} bad poison map or some sprites that low the health
     * @since botch-0.1
     */
    behaviors (good, bad) {
        const steerG = this.eat(good, 0.2, this.dna[2]);
        const steerB = this.eat(bad, -0.5, this.dna[3]);

        steerG.mult(this.dna[0]);
        steerB.mult(this.dna[1]);

        this.applyForce(steerG);
        this.applyForce(steerB);
    }

    /**
     * Behave with food and enemies
     * ApplyForce is called here and not in seek
     * @param {Map} good food map or some sprites that rise the health
     * @param {Map} bad some sprites that low the health
     * @since botch-0.2
     */
    behaviourEnemy (good, bad) {
        const steerG = this.eat(good, 0.2, this.dna[2]);
        const steerB = this.eatEnemy(bad, -0.5, this.dna[3]);

        steerG.mult(this.dna[0]);
        steerB.mult(this.dna[1]);

        this.applyForce(steerG);
        this.applyForce(steerB);
    }

    /**
     * Eat the list passed and set the health of the organism
     * according to the nutrition
     * If the list passed is an enemy it will be treated differently
     * @param {RenderedTarget} agent the foodTarget or poisonTarget
     * @param {number} nutrition value for health
     * @param {number} perception distance to see object
     * @returns {Vector2} steer force
     * @since botch-0.2
     */
    eat (agent, nutrition, perception) {
        let record = Infinity;
        let closest = null;
        const stageW = this.target.runtime.constructor.STAGE_WIDTH;
        const stageH = this.target.runtime.constructor.STAGE_HEIGHT;
        let esc = 30;

        // get all the clones
        const all = agent.sprite.clones;

        all.forEach(element => {
            let en = false;
            if (element instanceof Enemy) {
                element = element.target;
                en = true;
                esc = 10;
            }

            const d = new Vector2(element.x, element.y).dist(new Vector2(this.target.x, this.target.y));

            // If is close to food (eat) change the position if is original
            // otherwise delete the clone
            // Easier
            if (d < esc) { // (this.isTouchingObject(f)) { // there is no isTouchingSprite() with a specific ID
                if (en) {
                    this.health -= 0.1;
                } else {
                    this.health += nutrition;
                    if (element.isOriginal) {
                        element.setXY((Math.random() - 0.5) * stageW, (Math.random() - 0.5) * stageH);
                    } else {
                        this.target.runtime.disposeTarget(element);
                        this.target.runtime.stopForTarget(element);
                    }
                }
            } else if (d < record && d < perception) {
                record = d;
                closest = element;
            }
        });

        if (closest) {
            return this.seek(closest.x, closest.y);
        }

        return new Vector2(0, 0);
    }

    /**
     * Eat the list passed and set the health of the organism
     * according to the nutrition
     * If the list passed is an enemy it will be treated differently
     * @param {Map} list food or poison
     * @param {number} nutrition value for health
     * @param {number} perception distance to see object
     * @returns {Vector2} steer force
     * @since botch-0.2
     */
    eatEnemy (list, nutrition, perception) {
        let record = Infinity;
        let closest = null;
        const stageW = this.target.runtime.constructor.STAGE_WIDTH;
        const stageH = this.target.runtime.constructor.STAGE_HEIGHT;
        let esc = 30;
        
        for (let f of list.values()) {
            let en = false;
            if (f instanceof Enemy) {
                f = f.target;
                en = true;
                esc = 10;
            }

            const d = new Vector2(f.x, f.y).dist(new Vector2(this.target.x, this.target.y));

            // If is close to food (eat) change the position if is original
            // otherwise delete the clone
            // Easier
            if (d < esc) { // (this.isTouchingObject(f)) { // there is no isTouchingSprite() with a specific ID
                if (en) {
                    this.health -= 0.1;
                } else {
                    this.health += nutrition;
                    if (f.isOriginal) {
                        f.setXY((Math.random() - 0.5) * stageW, (Math.random() - 0.5) * stageH);
                    } else {
                        this.target.runtime.disposeTarget(f);
                        this.target.runtime.stopForTarget(f);
                        list.delete(f.id);
                    }
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
     * TO DO IS CREATING PROBLEMS WHEN USED
     * Check if the sprite touch the object
     * @param {RenderedTarget} obj object to check if touched
     * @returns {boolean} true if is touched
     * @since botch-0.1
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
     * Create a clone of itself "Parthenogenesis"
     * @returns {Organism} new copy Organism
     * @since botch-0.1
     */
    clone () {
        if (/* !this.target.isOriginal &&  */Math.random() < 0.002) {
            return new Organism(this.target, 1, 0.5, this.svg, this.dna);
        }
        return null;
    }

    /**
     * Check if the organism is dead
     * @returns {boolean} dead or not
     * @since botch-0.1
     */
    dead () {
        return (this.health < 0);
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
        this.living += 0.001;
        this.health -= 0.005;
        this.breathe();
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

    /**
     * Mimic the "breath effect" with fisheye
     * @since botch-0.2
     */
    breathe () {
        if (this.currEffectStep > 0) {
            const change = 5 * this.effectSign;
            this.botchUtil.changeGraphicsEffect(this.target, 'fisheye', change);
            this.currEffectStep--;
        } else {
            this.currEffectStep = this.effectStep;
            this.effectSign *= -1;
        }
    }

    /**
     * Death animation whit a dissolve effect
     * @param {util} util util
     * @returns {boolean} true if it has finished the animation
     * @since botch-0.2
     */
    deathAnimation (util) {
        const message = 'X';
        const Timer = require('../../util/timer');
        if (util.stackFrame.timer) {
            const timeElapsed = util.stackFrame.timer.timeElapsed();
            if (timeElapsed < util.stackFrame.duration * 500) {
                const frac = timeElapsed / (util.stackFrame.duration * 500);
                const dx = frac * (util.stackFrame.end - util.stackFrame.start);
                this.botchUtil.changeGraphicsEffect(this.target, 'ghost', util.stackFrame.start + dx);
                this.runtime.emit('SAY', this.target, 'say', message);
                util.yield();
            } else {
                this.runtime.emit('SAY', this.target, 'say', message);
                this.botchUtil.changeGraphicsEffect(this.target, 'ghost', util.stackFrame.end);
                return true;
            }
        } else {
            // First time: save data for future use.
            util.stackFrame.timer = new Timer();
            util.stackFrame.timer.start();
            util.stackFrame.duration = 1;
            util.stackFrame.start = 0;
            util.stackFrame.end = 100;
            this.runtime.emit('SAY', this.target, 'say', message);
            if (util.stackFrame.duration <= 0) {
                this.botchUtil.changeGraphicsEffect(this.target, 'ghost', util.stackFrame.end);
                return true;
            }
            util.yield();
        }
    }

}

module.exports = Organism;
