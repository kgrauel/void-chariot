import * as THREE from "three";

export interface NativeLevel {
    [key: string]: number | number[] | {
        sdf(p: number[]): number;
        sky(p: number[]): number[];
        getPigment(p: number[]): number[];
    };
}

export function radians(x: number): number {
    return x * (Math.PI / 180); 
}

export function degrees(x: number): number {
    return x * (180 / Math.PI);
}

export function atan(x: number, y?: number): number {
    if (y === undefined) {
        return Math.atan(x);
    } else {
        return Math.atan2(y, x);
    }
}

export function exp2(x: number): number {
    return Math.pow(2, x);
}

export function inversesqrt(x: number): number {
    return 1 / Math.sqrt(x);
}

export function fract(x: number): number {
    return x - Math.floor(x);
}

export function mod(x: number, y: number): number {
    return x - y * Math.floor(x / y);
}

export function clamp(x: number, y: number, z: number): number {
    if (x < y) {
        return y;
    } else if (x > z) {
        return z;
    } else {
        return x;
    }
}

export function mix(x: number, y: number, z: number): number {
    return x * (1 - z) + y * z;
}

export function step(x: number, y: number): number {
    if (y < x) {
        return 0;
    } else {
        return 1;
    }
}

export function smoothstep(e0: number, e1: number, x: number): number {
    if (x < e0) {
        return 0;
    } else if (x > e1) {
        return 1;
    } else {
        let t = (x - e0) / (e1 - e0);
        return t * t * (3 - 2 * t);
    }
}

export function length(x: number[]): number {
    let result = 0;
    for (const value of x) {
        result += value * value;
    }
    return Math.sqrt(result);
}

export function dot(x: number[], y: number[]): number {
    let result = 0;
    for (let i = 0; i < x.length; i++) {
        result += x[i] * y[i];
    }
    return result;
}

export function cross(x: number[], y: number[]): number[] {
    return [
        x[1] * y[2] - y[1] * x[2],
        x[2] * y[0] - y[2] * x[0],
        x[0] * y[1] - y[0] * x[1]
    ];
}

export function normalize(x: number[]): number[] {
    let len = 0;
    for (const value of x) {
        len += value * value;
    }
    const m = 1 / Math.sqrt(len);

    const result = x.slice();
    for (let i = 0; i < result.length; i++) {
        result[i] *= m;
    }

    return result;
}

export function outerProduct(x: number[], y: number[]): number[] {
    throw "not implemented";
}

export function transpose(x: number[]): number[] {
    throw "not implemented";
}

export function determinant(x: number[]): number {
    throw "not implemented";
}

export function inverse(x: number[]): number[] {
    throw "not implemented";
}