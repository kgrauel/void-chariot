import * as THREE from "three";

export default function createDitherShader() {
    return new THREE.ShaderMaterial({
        uniforms: {
            steps: {
                value: 32.0
            },
            gamma: {
                value: 2.0
            }
        },

        vertexShader: `
            varying vec2 vUv;

            void main() {
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
            }
        `,

        fragmentShader: `
            varying vec2 vUv;
            uniform sampler2D previousPass;
            uniform float steps;
            uniform float gamma;

            vec3 rgb2hsv(vec3 c)
            {
                vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
                vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
                vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
            
                float d = q.x - min(q.w, q.y);
                float e = 1.0e-10;
                return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
            }
            
            vec3 hsv2rgb(vec3 c)
            {
                vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
                vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
                return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
            }

            const int indexMatrix4x4[16] = int[](
                0,  8,  2,  10,
                12, 4,  14, 6,
                3,  11, 1,  9,
                15, 7,  13, 5
            );

            const int indexMatrix8x8[64] = int[](
                0,  32, 8,  40, 2,  34, 10, 42,
                48, 16, 56, 24, 50, 18, 58, 26,
                12, 44, 4,  36, 14, 46, 6,  38,
                60, 28, 52, 20, 62, 30, 54, 22,
                3,  35, 11, 43, 1,  33, 9,  41,
                51, 19, 59, 27, 49, 17, 57, 25,
                15, 47, 7,  39, 13, 45, 5,  37,
                63, 31, 55, 23, 61, 29, 53, 21);
            
            void main() {
                vec3 base = texture2D(previousPass, vUv).rgb;
                base.b += 0.000001; // Prevent division by zero
                base = pow(base, vec3(1.0 / gamma));

                float norm = length(base);
                base /= norm;

                float brightness = norm * steps / sqrt(3.0);
                float level = clamp(floor(brightness), 0.0, steps - 1.0);
                vec3 bottom = base * (level * sqrt(3.0) / steps);
                vec3 top = base * ((level + 1.0) * sqrt(3.0) / steps);
                float factor = fract(clamp(brightness, 0.0, steps));

                int x = int(mod(gl_FragCoord.x, 8.0));
                int y = int(mod(gl_FragCoord.y, 8.0));
                float cut = float(indexMatrix8x8[(x + y * 8)]) / 64.0;
                vec3 color = (factor < cut) ? bottom : top;

                color = pow(color, vec3(gamma));
                gl_FragColor = vec4(color, 1.0);
            }
        `,

        depthWrite: false
    });
}