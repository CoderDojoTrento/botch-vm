const Vector2 = require('./vector2');
const MathUtil = require('./math-util');

class SVGgen {
    /**
     * Construct the SVG
     * @param {int} width width of the svg
     * @param {int} height height of the svg
     * @param {string} color color base of the svg
     */
    constructor (width = 30, height = 30, color = SVGgen.getRandomColor()) {
        this.width = width;
        this.height = height;
        this.color = color;
        this.points = [];
        this.strokeWidth = 4;
    }

    rdn (min, max) {
        return (Math.random() * (max - min)) + min;
    }

    /**
     * Generate a random Hex color
     * @returns {string} new color
     */
    static getRandomColor () {
        const letters = '0123456789ABCDEF';
        let color = '#';
        for (let i = 0; i < 6; i++) {
            color += letters[Math.floor(Math.random() * 16)];
        }
        return color;
    }

    checkBorders (margin) {
        this.points.forEach(p => {
            p.x = p.x > this.width ? this.width - margin : p.x;
            p.x = p.x < 0 ? margin : p.x;
            p.y = p.y > this.height ? this.height - margin : p.y;
            p.y = p.y < 0 ? margin : p.y;
        });
    }

    /**
     * Generate 3 points in the svg space
     *
     *  3
     *  | -
     *  |    1
     *  | -
     *  2
     */
    generateTriangle () {
        const p1 = new Vector2(
            Math.floor((Math.random() + 1) * (this.width / 2)),
            Math.floor(Math.random() * this.height)); // head right-middle

        const p2 = new Vector2(
            Math.floor(Math.random() * p1.x),
            Math.floor(Math.random() * this.height)); // bottom-left

        const p3 = new Vector2(
            Math.floor(Math.random() * p1.x),
            Math.floor(Math.random() * p2.y)); // up-right

        this.points = [p1, p2, p3];

        this.checkBorders(this.strokeWidth);
    }

    /**
     * Generate a more stable triangle
     * @param {number} margin margin
     *  3
     *  | -
     *  |    1
     *  | -
     *  2
     */
    generateTriangle2 (margin) {
        const p1 = new Vector2(
            Math.floor(
                this.rdn(this.width / 2, this.width - margin)),
            Math.floor(
                this.rdn(this.height * (1 / 3), this.height * (2 / 3))
            )); // head right-middle

        const p2 = new Vector2(
            Math.floor(
                this.rdn(margin, this.width / 2)),
            Math.floor(
                this.rdn(this.height / 2, this.height - margin)
            )); // bottom-left

        const p3 = new Vector2(
            Math.floor(this.rdn(margin, this.width / 2)),
            Math.floor(this.rdn(margin, this.height / 2)
            )); // up-right

        this.points = [p1, p2, p3];

        // this.checkBorders(this.strokeWidth);
    }

    /**
     *  4 -
     *  |   -3
     *  |    |
     *  |   -2
     *  1 -
     * @param {number} margin margin
     */
    generateTrapezoid (margin) {
        const v = this.width;
        const h = this.height;
        const v2 = this.width / 2;
        const h2 = this.height / 2;

        const q1 = new Vector2(
            Math.floor(this.rdn(margin, v2)),
            Math.floor(this.rdn(h2, h - margin)) // bottom left
        );

        const q2 = new Vector2(
            Math.floor(this.rdn(v2, v - margin)),
            Math.floor(this.rdn(h2, h - margin)) // bottom right
        );

        const q3 = new Vector2(
            q2.x,
            Math.floor(this.rdn(margin, h2)) // up right
        );

        const q4 = new Vector2(
            q1.x,
            Math.floor(this.rdn(margin, h2)) // up left
        );

        this.points = [q1, q2, q3, q4];
    }

    /**
     * Compute the center of gravity of the trapezoid and center it in the frame
     * https://online.scuola.zanichelli.it/cannarozzozavanella-files/Costruzioni/Approfondimenti/Zanichelli_Costruzioni_UnitaE1_Par5.pdf
     */
    computeCenterGravityTrapezoid () {
        const h = Math.abs(this.points[1].x - this.points[0].x);
        const a1 = Math.abs(this.points[1].y - this.points[2].y);
        const b1 = Math.abs(this.points[0].y - this.points[3].y);

        const B = a1 > b1 ? a1 : b1;
        const b = a1 <= b1 ? a1 : b1;

        // center respect to the trapezoid
        const Xg = B / 2;
        const Yg = (h / 3) * ((B + (2 * b)) / (B + b));

        // center respect to the coordinate
        let Xgr; let Ygr;
        if (a1 > b1) {
            Xgr = this.points[1].x - Yg;
            Ygr = this.points[1].y - Xg;
        } else {
            Xgr = this.points[0].x + Yg;
            Ygr = this.points[0].y - Xg;
        }
        
        const x0 = this.width / 2;
        const y0 = this.height / 2;
        
        // distance to the centre
        const dx = x0 - Xgr;
        const dy = y0 - Ygr;
                
        // refresh the point coordinate
        this.points.forEach(p => {
            p.x = Math.floor(p.x + dx);
            p.y = Math.floor(p.y + dy);
        });

        // this.checkBorders(this.strokeWidth);
    }

    /**
     * Compute the center of the trapezoid respect to the bounding box
     */
    computeCenterBoundingBoxTrapezoid () {

    }

    /**
     * https://it.wikipedia.org/wiki/Baricentro_(geometria)
     */
    computeBarycenterTriangle () {
        let Xbr = 0;
        let Ybt = 0;
        
        // convert in cartesian coordinate
        const p1y = this.height - this.points[0].y;
        const p2y = this.height - this.points[1].y;
        const p3y = this.height - this.points[2].y;

        this.points.forEach(p => {
            Xbr += p.x;
        });

        Xbr /= 3;
        Ybt = (p1y + p2y + p3y) / 3;
        const Ybr = this.height - Ybt; // in graphic coordinate

        const x0 = this.width / 2;
        const y0 = this.height / 2;
        
        // distance to the centre
        const dx = x0 - Xbr;
        const dy = y0 - Ybr;

        // refresh the point coordinate
        this.points.forEach(p => {
            p.x = Math.floor(p.x + dx);
            p.y = Math.floor(p.y + dy);
        });

    }

    pointToCircle () {
        return `<circle cx=" ${this.points[0].x}" cy="${this.points[0].y}" ` +
        `r="4" stroke="black" stroke-width="2" fill="red" />`;
    }

    pointToEyesTr (foodR, poisonR) {
        return `<circle cx=" ${this.points[2].x}" cy="${this.points[2].y}" ` +
        `r="${foodR}" stroke="black" stroke-width="1" fill="green" />` + // food
        `<circle cx=" ${this.points[1].x}" cy="${this.points[1].y}" ` +
        `r="${poisonR}" stroke="black" stroke-width="1" fill="red" />`; // poison
    }

    // eyes of triangle
    pointToEyesCr (foodR, poisonR, sign) {
        const i = sign > 0 ? 0 : 1;
        
        return `<circle cx=" ${this.points[i].x}" cy="${this.points[i].y}" ` +
        `r="${foodR}" stroke="black" stroke-width="1" fill="green" />` +
        `<circle cx=" ${this.points[1 - i].x}" cy="${this.points[1 - i].y}" ` +
        `r="${poisonR}" stroke="black" stroke-width="1" fill="red" />`;
        
    }

    pointsToString () {
        let str = '';
        this.points.forEach(c => {
            str += `${c.x},${c.y} `;
        });
        return str;
    }
    
    // trapezoid with eyes
    generateObj3 (foodR, poisonR) {
        this.generateTrapezoid(25);
        this.computeCenterGravityTrapezoid();

        return `<svg height="${this.height}" width="${this.width}" viewBox="0 0 ${this.width} ${this.height}" version="1.1" xml:space="preserve" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">` +
        `<polygon points="${this.pointsToString()}" style="fill:${this.color};stroke:black;stroke-width:3" />` +
        `${this.pointToEyesTr(foodR, poisonR)}` +
        `</svg>`;
    }

    // trapezoid
    generateObj2 () {
        this.generateTrapezoid();
        this.computeCenterTrapezoid();

        return `<svg height="${this.height}" width="${this.width}" viewBox="0 0 ${this.width} ${this.height}" version="1.1" xml:space="preserve" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">` +
        `<polygon points="${this.pointsToString()}" style="fill:${this.color};stroke:black;stroke-width:4" />` +
        `</svg>`;
    }

    // triangle with eyes or trapezoid
    // if it is attracted or repulsed by both food and poison => trapezoid
    // else triangle
    generateMultiple (foodR, poisonR, mag) {
        const f = MathUtil.scale(foodR, -mag, mag, 0, 15);
        const p = MathUtil.scale(poisonR, -mag, mag, 0, 15);

        // trapezoid
        if (Math.sign(foodR) === Math.sign(poisonR)) {
            this.generateTrapezoid(25);
            this.computeCenterGravityTrapezoid();

            return `<svg height="${this.height}" width="${this.width}" viewBox="0 0 ${this.width} ${this.height}" version="1.1" xml:space="preserve" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">` +
                `<polygon points="${this.pointsToString()}" style="fill:${this.color};stroke:black;stroke-width:3" />` +
                `${this.pointToEyesTr(f, p)}` +
                `</svg>`;
        }
        // triangle
        this.generateTriangle2(25);
        this.computeBarycenterTriangle();
        return `<svg height="${this.height}" width="${this.width}" viewBox="0 0 ${this.width} ${this.height}" version="1.1" xml:space="preserve" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">` +
            `<polygon points="${this.pointsToString()}" style="fill:${this.color};stroke:black;stroke-width:4" />` +
            `${this.pointToEyesCr(f, p, Math.sign(foodR))}` +
            `</svg>`;
        
    }

    // triangle
    generateSvgObj1 () {
        this.generateTriangle();
        this.computeBarycenterTriangle();
        return `<svg height="${this.height}" width="${this.width}" viewBox="0 0 ${this.width} ${this.height}" version="1.1" xml:space="preserve" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">` +
            `<polygon points="${this.pointsToString()}" style="fill:${this.color};stroke:black;stroke-width:4" />` +
            `${this.pointToCircle()}` +
            `</svg>`;
    }
}

module.exports = SVGgen;
