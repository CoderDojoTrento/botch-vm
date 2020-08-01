class Vector2 {
    constructor (x, y) {
        this.x = x || 0;
        this.y = y || 0;
    }

    /**
     * Adds x, y components to a vector, adds one vector to another, or adds two independent vectors together
     * @member sum
     * @param {Number} x
     * @param {Number} y
     * @chainable
     */

    add (x, y) {
        if (x instanceof Vector2) {
            this.x += x.x;
            this.y += x.y;
            return this;
        } else if (x instanceof Array) {
            this.x += x[0] || 0;
            this.y += x[1] || 0;
            return this;
        }
        this.x += x;
        this.y += y;
        return this;
        
    }

    /**
     * Sum two vector and create a new one
     * @param {Vector2} v1
     * @param {Vector2} v2
     */

    static add (v1, v2) {
        const nv = new Vector2(v1.x, v1.y);
        nv.sum(v2);
        return nv;
    }

    /**
     * Sub two vector and create a new one
     * @param {Vector2} v1
     * @param {Vector2} v2
     */

    static sub (v1, v2) {
        const nv = new Vector2(v1.x, v1.y);
        nv.sub(v2);
        return nv;
    }

    /**
     * Subtracts x, y components to a vector, subs one vector to another, or subs two independent vectors together
     * @param {Number} x
     * @param {Number} y
     * @chainable
     */

    sub (x, y) {
        if (x instanceof Vector2) {
            this.x -= x.x;
            this.y -= x.y;
            return this;
        } else if (x instanceof Array) {
            this.x -= x[0] || 0;
            this.y -= x[1] || 0;
            return this;
        }
        this.x -= x;
        this.y -= y;
        return this;
    }

    /**
     * Squared magnitude of a vector
     * @returns {Number} squared magnitude of the vector
     */

    magSq () {
        const x = this.x;
        const y = this.y;
        return (x * x) + (y * y);
    }

    /**
     * Magnitude of a vector
     * @returns {Number} magnitude of the vector
     */
    
    mag () {
        return Math.sqrt(this.magSq());
    }

    /**
     * Multiply a vector by a scalar
     * @param {number} n
     * @chainable
     */

    mult (n) {
        if (!(typeof n === 'number' && isFinite(n))) {
            return this;
        }
        this.x *= n;
        this.y *= n;
        return this;
    }

    /**
     * Divide a vector by a scalar
     * @param {number} n
     * @chainable
     */
    
    div (n) {
        if (!((typeof n === 'number' && isFinite(n)) || n === 0)) {
            return this;
        }
        this.x /= n;
        this.y /= n;
        return this;
    }

    /**
     * Normalize a vector
     * @returns {Vector2} normalized
     */
    
    normalize () {
        const len = this.mag();
        if (len !== 0) this.mult(1 / len);
        return this;
    }

    /**
     * Limit the magnitude of a vector to the max parameter
     * @param {Number} max
     */

    limit (max) {
        const mSq = this.magSq();
        if (mSq > max * max) {
            this.div(Math.sqrt(mSq)) // normalize it
                .mult(max);
        }
        return this;
    }
    
    /**
     * Set the magnitude of this vector to the value used for the len parameter.
     * @param {Number} n
     * @chainable
     */

    setMag (n) {
        return this.normalize().mult(n);
    }

    copy () {
        return new Vector2(this.x, this.y);
    }

    /**
     * Return the euclidean distance
     * @param {Vector2} v vector 1
     * @returns {number} distance
     */
    dist (v) {
        // const tmp = this;
        return v.copy().sub(this)
            .mag();
    }
      
}

module.exports = Vector2;
