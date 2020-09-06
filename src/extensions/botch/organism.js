let _TextEncoder;
if (typeof TextEncoder === 'undefined') {
    _TextEncoder = require('text-encoding').TextEncoder;
} else {
    /* global TextEncoder */
    _TextEncoder = TextEncoder;
}

const Vector2 = require('./vector2');
const MathUtil = require('../../util/math-util');
const svgGen = require('./svg-generator');
const BotchUtil = require('./botch_util');

/**
 * @since botch-0.1
 */
class Organism {
    /**
     * Class Organism
     * @param {RenderedTarget} target_ target (sprite)
     * @param {number} mass_ mass of the vehicle
     * @param {number} maxForce_ max force of the vehicle
     * @param {boolean} org if true is an organism otherwise is an enemy
     * @param {Array} svgPoints_  svg points of the organism
     * @param {number} mutation how the organism can mutate [0 - 100]
     * @param {number} foodAttraction food attraction
     * @param {number} foodSight food sight
     * @param {number} enemyAttraction enemy attraction
     * @param {number} enemySight enemy sight
     * @param {number} orgSize organism size (mass)
     */
    constructor (target_, mass_ = 1, maxForce_ = 0.5, org, svgPoints_, mutation,
        foodAttraction, foodSight, enemyAttraction, enemySight, orgSize) {

        // utils
        this.target = target_;
        this.renderer = this.target.renderer;
        this.runtime = this.target.runtime;
        this.storage = this.runtime.storage;
        this.svgGen = new svgGen(100, 100);
        this.botchUtil = new BotchUtil(this.runtime);
        // vehicle proprieties
        this.acceleration = new Vector2(0, 0);
        this.velocity = new Vector2(this.botchUtil.rdn(-2, 2), this.botchUtil.rdn(-2, 2));
        this.position = new Vector2(target_.x, target_.y);
        this.maxSpeed = 5;
        this.maxForce = maxForce_; // agility ?
        this.mass = mass_;
        // organism utils and proprieties
        this.svgPoints = svgPoints_;
        this.health = 1;
        this.living = 0;
        this.isDeadTick = 0;
        this.effectStep = 7;
        this.currEffectStep = this.effectStep;
        this.effectSign = 1;
        this.perception = 200;
        this.versionName = '';
        this.max_att = 5;
        this.max_perception = 150;
        this.max_size = 110;
        this.min_size = 50;
        this.currentName = '';
        this.childNumber = 0;
        // "dna" parameter
        this.foodAttraction = 0;
        this.foodSight = 0;
        this.enemySight = 0;
        this.enemyAttraction = 0;
        this.size = 0;

        if (foodAttraction && foodSight && enemyAttraction && enemySight && orgSize) {
            const attScaled = MathUtil.scale(mutation, 0, 100, 0, this.max_att);
            const perScaled = MathUtil.scale(mutation, 0, 100, 0, this.max_perception);
            const sizeScaled = MathUtil.scale(mutation, 0, 100, 0, this.max_size);
            this.foodAttraction = foodAttraction;
            this.foodAttraction += this.botchUtil.rdn(-attScaled, attScaled);
            this.foodAttraction = MathUtil.clamp(this.foodAttraction, -this.max_att, this.max_att);
            this.foodSight = foodSight;
            this.foodSight += this.botchUtil.rdn(-perScaled, perScaled);
            this.foodSight = MathUtil.clamp(this.foodSight, 0, this.max_perception);
            this.enemyAttraction = enemyAttraction;
            this.enemyAttraction += this.botchUtil.rdn(-attScaled, attScaled);
            this.enemyAttraction = MathUtil.clamp(this.enemyAttraction, -this.max_att, this.max_att);
            this.enemySight = enemySight;
            this.enemySight += this.botchUtil.rdn(-perScaled, perScaled);
            this.enemySight = MathUtil.clamp(this.enemySight, 0, this.max_perception);
            this.size = orgSize;
            this.size += this.botchUtil.rdn(-sizeScaled / 3, sizeScaled / 3);
            this.size = MathUtil.clamp(this.size, this.min_size, this.max_size);
        } else {
            this.foodAttraction = this.botchUtil.rdn(-this.max_att, this.max_att); // food attraction
            this.foodSight = Math.random() * this.max_perception; // food perception
            this.enemyAttraction = this.botchUtil.rdn(-this.max_att, this.max_att);// enemy attraction
            this.enemySight = Math.random() * this.max_perception; // enemy perception
            this.size = this.botchUtil.rdn(this.min_size, this.max_size); // sprite size (mass)
        }

        // if is not defined, do not generate
        if (svgPoints_) {
            if (org) {
                this.svg = this.svgGen.generateOrgSVG3(
                    100, this.foodAttraction, this.enemyAttraction, this.max_att,
                    this.foodSight, this.enemySight, this.max_perception, svgPoints_, mutation);
                this.botchUtil.uploadCostumeEdit(this.svg, this.target.id);
            }
            this.target.setSize(this.size);
            /* for (let i = this.target.getCostumes().length - 1; i >= 0; i--) {
                if (i !== this.target.currentCostume) {
                    this.target.deleteCostume(i); // hack troppo brutta ed instabile
                }
            } */
        } else {
            this.svg = this.svgGen.generateOrgSVG3(100, this.foodAttraction, this.enemyAttraction, this.max_att,
                this.foodSight, this.enemySight, this.max_perception);
        }
        
        // values found empirically
        // this.area = this.svgGen.calcOrgMass();
        this.health = MathUtil.scale(this.target.size, this.min_size, this.max_size, 0.8, 3);
        this.mass = MathUtil.scale(this.target.size, this.min_size, this.max_size, 0.5, 7);

        // Variable assignment to the sprite
        // each clone has the its own dna saved and the dna of the non-clone target
        this.target.lookupOrCreateVariable('botch_dna_foodS', 'food sight');
        this.target.lookupOrCreateVariable('botch_dna_foodA', 'food attraction');
        this.target.lookupOrCreateVariable('botch_dna_enemyS', 'enemy sight');
        this.target.lookupOrCreateVariable('botch_dna_enemyA', 'enemy attraction');
        this.target.lookupOrCreateVariable('botch_dna_size', 'size');

        this.target.lookupOrCreateVariable('botch_parent', 'parent');
    }
    
    /**
     * Compute the step needed to move
     * @param {Map} enemiesMap enemiesMap
     * @param {Map} organismMap organismMap
     * @since botch-0.2
     */
    stepOrganism (enemiesMap, organismMap) {
        this.refreshArgs(this.mass, this.maxForce);
        this.boundaries(
            this.runtime.constructor.STAGE_WIDTH - 30,
            this.runtime.constructor.STAGE_HEIGHT - 30);
        this.separation(organismMap, 10);
        this.behaveGeneralOrganism(enemiesMap);
        this.update();
        this.breathe();
    }

    /**
     * Compute the step needed to move
     * @param {Map} organismMap the organism map
     * @param {Map} enemiesMap enemiesMap
     * @since botch-0.2
     */
    stepEnemy (organismMap, enemiesMap) {
        this.boundaries(
            this.runtime.constructor.STAGE_WIDTH - 50,
            this.runtime.constructor.STAGE_HEIGHT - 50);
        this.separation(enemiesMap, 10);
        this.refreshArgs(this.mass, this.maxForce);
        this.behaveEnemy(organismMap);
        this.update();
    }

    /**
     * assign the new generated costume to the target
     */
    assignOrgCostume () {
        this.botchUtil.uploadCostumeEdit(this.svg, this.target.id);
        this.target.setSize(this.size);
    }

    /**
     * assign a new generated enemy costume to the target
     */
    assignEnemyCostume () {
        this.svg = this.svgGen.generateEnemySvg2();
        this.botchUtil.uploadCostumeEdit(this.svg, this.target.id);
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
     * Get all the food target
     * @returns {Array} food targets
     * @since botch-0.2
     */
    getFoodTarget () {
        if (this.runtime.targets.length > 0) {
            return this.runtime.targets.filter(t => {
                if (!t.isStage) {
                    const state = t.getCustomState('Botch.state');
                    if (state && state.type === 'food') {
                        return true;
                    }
                }
                return false;
            });
        }
    }

    /**
     * Get all the poison target
     * @returns {Array} poison targets
     * @since botch-0.2
     */
    getPoisonTarget () {
        if (this.runtime.targets.length > 0) {
            return this.runtime.targets.filter(t => {
                if (!t.isStage) {
                    const state = t.getCustomState('Botch.state');
                    if (state && state.type === 'poison') {
                        return true;
                    }
                }
                return false;
            });
        }
    }

    /**
     * General behaviour for organism
     * @param {Map<string, Organism>} enemiesMap enemies map
     * @since botch-0.2
     */
    behaveGeneralOrganism (enemiesMap) {
        let steerG = new Vector2(0, 0);
        let steerB = new Vector2(0, 0);
        let steerE = new Vector2(0, 0);
        steerG = this.eatGeneral(this.getFoodTarget(), 0.2, this.foodSight);
        steerB = this.eatGeneral(this.getPoisonTarget(), -0.5, this.enemySight);

        if (enemiesMap && enemiesMap.size > 0) {
            steerE = this.eatGeneral(enemiesMap, 0, this.enemySight);
        }

        steerG.mult(this.foodAttraction);
        steerB.mult(this.enemyAttraction);
        steerE.mult(this.enemyAttraction);
        this.applyForce(steerG);
        this.applyForce(steerB);
        this.applyForce(steerE);
    }

    /**
     * Behave with enemies
     * ApplyForce is called here and not in seek
     * @param {Map} organism the organism map
     * @since botch-0.1
     */
    behaveEnemy (organism) {
        if (organism.size > 0) {
            const steerO = this.attack(organism);
            steerO.mult(1.1); // TO DO, TO DEFINE
            this.applyForce(steerO);
        }
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
        const esc = 10;

        for (const o of organism.values()) {
            const d = new Vector2(o.target.x, o.target.y).dist(new Vector2(this.target.x, this.target.y));
            if (d < esc) {
                o.health -= 0.1;
            } else if (d < record && d < perception) {
                record = d;
                closest = o;
            }
        }

        if (closest && closest.health > 0) {
            return this.seek(closest.target.x, closest.target.y);
        }

        return new Vector2(0, 0);
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
    eatGeneral (agent, nutrition, perception) {
        let record = Infinity;
        let closest = null;
        const stageW = this.target.runtime.constructor.STAGE_WIDTH;
        const stageH = this.target.runtime.constructor.STAGE_HEIGHT;
        const esc = 30;

        if (agent.length > 0 && agent[0].hasOwnProperty('sprite')) { // with food and poison
            // get all the clones
            // const all = agent.sprite.clones;
            agent.forEach(element => {
                const d = new Vector2(element.x, element.y).dist(new Vector2(this.target.x, this.target.y));
    
                // If is close to food (eat) change the position if is original
                // otherwise delete the clone
                // Easier
                if (d < esc) { // (this.isTouchingObject(f)) { // there is no isTouchingSprite() with a specific ID
                    this.health += nutrition;
                    if (element.isOriginal) {
                        element.setXY((Math.random() - 0.5) * stageW, (Math.random() - 0.5) * stageH);
                    } else {
                        this.runtime.disposeTarget(element);
                        this.runtime.stopForTarget(element);
                    }
                    
                } else if (d < record && d < perception) {
                    record = d;
                    closest = element;
                }
            });
        } else if (agent.size > 0) { // with enemies
            for (let f of agent.values()) {
                f = f.target;
                if (!f.isOriginal) {
                    const d = new Vector2(f.x, f.y).dist(new Vector2(this.target.x, this.target.y));
                    if (d < record && d < perception) {
                        record = d;
                        closest = f;
                    }
                }
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
     * when called it return always a new child
     * @param {number} mutation how the organism will mutate [0 - 100]
     * @param {target} target new clone target
     * @param {boolean} org if true is an organism otherwise is an enemy
     * @returns {Organism} new copy Organism
     * @since botch-0.2
     */
    clone (mutation, target, org) {
        const newOrg = new Organism(target, this.mass, 0.5, org, this.svgGen.getOrgPoints(), mutation,
            this.foodAttraction, this.foodSight, this.enemyAttraction, this.enemySight, this.size);
        return newOrg;
    }

    /**
     * Check if the organism is dead
     * @returns {boolean} dead or not
     * @since botch-0.1
     */
    dead () {
        if (this.health < 0) {
            this.isDeadTick++;
            return true;
        }
    }

    /**
     * Returns only once, when an organism is dead
     * @returns {boolean} true if is dead
     * @since botch-0.2
     */
    deadSignal () {
        return this.isDeadTick === 1;
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
        this.health -= 0.01;
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
            // steer.limit(this.maxForce);
            this.applyForce(steer);
        }
    }

    /**
     * Separate the vehicles to each other
     * http://www.red3d.com/cwr/steer/gdc99/
     * https://processing.org/examples/flocking.html
     * @param {Map} organism organism or enemies map
     * @param {number} radius radius of the separation
     * @since botch-0.2
     */
    separation (organism, radius) {
        let counter = 0;
        const steer = new Vector2(0, 0);
        for (const o of organism.values()) {
            if (o.target.id !== this.target.id) {
                const d = new Vector2(o.target.x, o.target.y).dist(new Vector2(this.target.x, this.target.y));
                if (d < radius) {
                    const diff = Vector2.sub(
                        new Vector2(this.target.x, this.target.y), new Vector2(o.target.x, o.target.y)
                    );
                    diff.normalize();
                    diff.div(d);
                    steer.add(diff);
                    counter++;
                }
            }
        }
        // Average -- divide by how many
        if (counter > 0) {
            steer.div(counter);
        }

        // As long as the vector is greater than 0
        if (steer.mag() > 0) {
            // Implement Reynolds: Steering = Desired - Velocity
            steer.normalize();
            steer.mult(this.maxSpeed);
            steer.sub(this.velocity);
            steer.limit(this.maxForce);
            this.applyForce(steer.mult(1.5));
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

    /**
     * Set the variable parent to the target
     * if parent is not defined the parent will be parent_0
     * @param {string} parent parent id (who have made it)
     * @since botch-0.2
     */
    setParentVariable (parent) {
        if (parent) {
            const botchParent = 'botch_parent';
            this.target.variables[botchParent].value = parent;
            // this.target.lookupOrCreateVariable(this.target.id, `parent_${parent}`);
        } else { // if there is no parent defined (eg the first generation)
            // this.target.lookupOrCreateVariable(this.target.id, `parent_0`);
            const botchParent = 'botch_parent';
            this.target.variables[botchParent].value = 'parent_0';
        }
    }

    /**
     * Set the dna scratch variable
     * @since botch-0.2
     */
    setOrgDna () {
        const foodS = 'botch_dna_foodS';
        const foodA = 'botch_dna_foodA';
        const enemyS = 'botch_dna_enemyS';
        const enemyA = 'botch_dna_enemyA';
        const sizeO = 'botch_dna_size';
        this.target.variables[foodS].value = this.foodSight;
        this.target.variables[foodA].value = this.foodAttraction;
        this.target.variables[enemyS].value = this.enemySight;
        this.target.variables[enemyA].value = this.enemyAttraction;
        this.target.variables[sizeO].value = this.size;
    }

}

module.exports = Organism;
