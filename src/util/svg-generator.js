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

    /**
     * Generate 3 points in the svg space
     */
    generateObj1 () {
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
    }

    pointToCircle () {
        return `<circle cx=" ${this.points[0].x}" cy="${this.points[0].y}" ` +
        `r="4" stroke="black" stroke-width="2" fill="red" />`;
    }

    pointToTriangle () {
        let str = '';
        this.points.forEach(c => {
            str += `${c.x},${c.y} `;
        });
        return str;
    }

    generateSvgObj1 () {
        this.generateObj1();
        return `<svg height="${this.height}" width="${this.width}" viewBox="0 0 ${this.width} ${this.height}" version="1.1" xml:space="preserve" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">` +
            `<polygon points="${this.pointToTriangle()}" style="fill:${this.color};stroke:black;stroke-width:4" />` +
            `${this.pointToCircle()}` +
            `</svg>`;
    }
}

module.exports = SVGgen;
