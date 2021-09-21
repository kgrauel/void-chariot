import * as THREE from "three";
import BUILT from "./built";

export default function createSDFShader(
    level: string,
    renderer: string
) {
    let level_code = BUILT.levels.get(level);
    if (level_code === undefined) {
        throw new Error(`Could not find level ${level_code}.`);
    }

    let renderer_code = BUILT.renderers.get(renderer);
    if (renderer_code === undefined) {
        throw new Error(`Could not find renderer ${renderer_code}.`);
    }

    let fragment = `
varying vec2 vUv;
${level_code[0]}
${renderer_code[0]}
${level_code[1]}
${renderer_code[1]}
`;

    return new THREE.ShaderMaterial({
        uniforms: {
            iResolution: { value: [100, 100] },
            iTime: { value: 0.0 },
            iFrame: { value: 0 },
            camPos: { value: [1, 0.4, 2] },
            lookAt: { value: [0, 0, 0] },
            focalLength: { value: 1.0 },
            farPlaneDistance: { value: 100.0 },
            maxIterations: { value: 100.0 },
            directionTowardSun: { value: [1, 1, 1] },
            sunColor: { value: [0.7, 0.7, 0.7] },
            aoIterations: { value: 6 },
            aoDistance: { value: 0.03 },
            aoPower: { value: 1.5 }
        },

        vertexShader: `
            varying vec2 vUv;

            void main() {
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,

        fragmentShader: fragment,
        depthWrite: false
    });
}