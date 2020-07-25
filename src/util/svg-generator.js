const vect = require('./vector2');

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
     * @returns {Array} array of points
     */
    generatePoints () {
        const p1 = new vect(
            Math.floor(Math.random() * this.width),
            Math.floor((Math.random() + 1) * this.height / 2)); // head

        const p2 = new vect(
            Math.floor(Math.random() * this.width / 2),
            Math.floor(Math.random() * p1.y)); // left point

        const p3 = new vect(
            Math.floor((Math.random() + 1) * this.width / 2),
            Math.floor(Math.random() * p1.y)); // right point

        return [p1, p2, p3];
    }

    pointToString () {
        const points = this.generatePoints();
        let str = '';
        points.forEach(c => {
            str += `${c.x},${c.y} `;
        });
        return str;
    }

    generateSVG () {
        return `<svg height="${this.height}" width="${this.width}" viewBox="0 0 ${this.width} ${this.height}" version="1.1" xml:space="preserve" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">` +
            `<polygon points="${this.pointToString()}" style="fill:${this.color};stroke:black;stroke-width:4" />` +
            `</svg>`;
    }
}

module.exports = SVGgen;
