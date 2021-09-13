import * as THREE from "three";


export default function createUpscaleShader() {
    return new THREE.ShaderMaterial({
        uniforms: {
            // previousPass, but we set that during rendering
        },
        vertexShader: `
            varying vec2 vUv;

            void main() {
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            varying vec2 vUv;
            uniform sampler2D previousPass;

            void main() {
                vec3 base = texture2D(previousPass, vUv).rgb;
                gl_FragColor = vec4(base, 1.0);
            }
        `,
        depthWrite: false
    });
}