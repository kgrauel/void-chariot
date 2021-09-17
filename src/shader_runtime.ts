import * as THREE from "three";

export type Vector = number | THREE.Vector2 | THREE.Vector3 | THREE.Vector4;
    
function flatten(components: Vector[], expected: number): Float64Array {
    let i = 0;
    let result = new Float64Array(expected);

    if (components.length === 1 && typeof components[0] === "number") {
        while (i < expected) {
            result[i] = components[0];
            i++;
        }
        return result;
    }

    for (const c of components) {
        if (typeof c === "number") {
            if (i + 1 >= expected) {
                throw "too many components in constructor";
            }
            result[i] = c;
            i++;
        }
        else if (c instanceof THREE.Vector2) {
            if (i + 2 >= expected) {
                throw "too many components in constructor";
            }
            result[i] = c.x;
            result[i + 1] = c.y;
            i += 2;
        }
        else if (c instanceof THREE.Vector3) {
            if (i + 3 >= expected) {
                throw "too many components in constructor";
            }
            result[i] = c.x;
            result[i + 1] = c.y;
            result[i + 2] = c.z;
            i += 3;
        }
        else if (c instanceof THREE.Vector4) {
            if (i + 4 >= expected) {
                throw "too many components in constructor";
            }
            result[i] = c.x;
            result[i + 1] = c.y;
            result[i + 2] = c.z;
            result[i + 3] = c.w;
            i += 4;
        }
        else {
            throw "constructor contains invalid type";
        }
    }

    if (i < expected) {
        throw "not enough components in constructor"
    }

    return result;
}

export function vector2(...components: Vector[]): THREE.Vector2 {
    const flattened = flatten(components, 2);
    return new THREE.Vector2(
        flattened[0], flattened[1]
    );
}

export function vector3(...components: Vector[]): THREE.Vector3 {
    const flattened = flatten(components, 3);
    return new THREE.Vector3(
        flattened[0], flattened[1], flattened[2]
    );
}

export function vector4(...components: Vector[]): THREE.Vector4 {
    const flattened = flatten(components, 2);
    return new THREE.Vector4(
        flattened[0], flattened[1], flattened[2], flattened[3]
    );
}

export function matrix3(...components: Vector[]): THREE.Matrix3 {
    throw "not implemented";
}

export function matrix4(...components: Vector[]): THREE.Matrix4 {
    throw "not implemented";
}

export function radians(...components: Vector[]): Vector {
    throw "not implemented";
}

export function degrees(...components: Vector[]): Vector {
    throw "not implemented";
}

export function sin(...components: Vector[]): Vector {
    throw "not implemented";
}

export function cos(...components: Vector[]): Vector {
    throw "not implemented";
}

export function tan(...components: Vector[]): Vector {
    throw "not implemented";
}



