const Vector2 = require('./vector2');

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

    generateTrapezoid (margin) {
        const q1 = new Vector2(
            Math.floor(Math.random() * ((this.width / 2) - margin)),
            Math.floor((Math.random() + 1) * ((this.height / 2) - margin))
        );

        const q2 = new Vector2(
            Math.floor((Math.random() + 1) * ((this.width / 2) - margin)),
            q1.y
        );

        const q3 = new Vector2(
            Math.floor((Math.random() + 1) * ((this.width / 2) - margin)),
            Math.floor(Math.random() * ((this.height / 2) - margin))
        );

        const q4 = new Vector2(
            Math.floor(Math.random() * ((this.width / 2) - margin)),
            q3.y
        );

        this.points = [q1, q2, q3, q4];
    }

    /**
     * Compute the center of gravity of the trapezoid and center it in the frame
     * https://online.scuola.zanichelli.it/cannarozzozavanella-files/Costruzioni/Approfondimenti/Zanichelli_Costruzioni_UnitaE1_Par5.pdf
     */
    computeCenterGravityTrapezoid () {
        const h = Math.abs(this.points[1].y - this.points[2].y);
        const b = Math.abs(this.points[2].x - this.points[3].x);
        const B = Math.abs(this.points[1].x - this.points[0].x);

        // center respect to the trapezoid
        const Xg = B / 2;
        const Yg = (h / 3) * ((B + (2 * b)) / (B + b));

        // center respect to the coordinate
        const Xgr = this.points[0].x + Xg;
        const Ygr = this.points[0].y - Yg;
        
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

    pointToCircle () {
        return `<circle cx=" ${this.points[0].x}" cy="${this.points[0].y}" ` +
        `r="4" stroke="black" stroke-width="2" fill="red" />`;
    }

    pointToEyes (foodR, poisonR) {
        return `<circle cx=" ${this.points[2].x}" cy="${this.points[2].y}" ` +
        `r="${foodR}" stroke="black" stroke-width="1" fill="green" />` + // food
        `<circle cx=" ${this.points[1].x}" cy="${this.points[1].y}" ` +
        `r="${poisonR}" stroke="black" stroke-width="1" fill="red" />`; // poison
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
        `${this.pointToEyes(foodR, poisonR)}` +
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

    // triangle
    generateSvgObj1 () {
        this.generateTriangle();
        return `<svg height="${this.height}" width="${this.width}" viewBox="0 0 ${this.width} ${this.height}" version="1.1" xml:space="preserve" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">` +
            `<polygon points="${this.pointsToString()}" style="fill:${this.color};stroke:black;stroke-width:4" />` +
            `${this.pointToCircle()}` +
            `</svg>`;
    }
}

module.exports = SVGgen;
