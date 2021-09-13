import * as THREE from "three";

export default function createSDFShader() {
    return new THREE.ShaderMaterial({
        uniforms: {
            iResolution: { value: [100, 100] },
            iTime: { value: 0.0 },
            iFrame: { value: 0 },
            camPos: { value: [2, 0.2, 1] },
            lookAt: { value: [0, 0, 0] },
            focalLength: { value: 1.5 },
            farPlaneDistance: { value: 30.0 },
            maxIterations: { value: 50.0 },
            
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
            uniform vec2 iResolution; // viewport resolution (in pixels)
            uniform float iTime;      // shader playback time (in seconds)
            uniform vec3 camPos;
            uniform vec3 lookAt;
            uniform float focalLength;
            uniform float farPlaneDistance;
            uniform float maxIterations;
            uniform int iFrame;

            #define ZERO (min(iFrame,0))

            float sdCappedTorus(in vec3 p, in vec2 sc, in float ra, in float rb)
            {
                p.x = abs(p.x);
                float k = (sc.y*p.x>sc.x*p.y) ? dot(p.xy,sc) : length(p.xy);
                return sqrt( dot(p,p) + ra*ra - 2.0*ra*k ) - rb;
            }

            float sdf( in vec3 pos )
            {
                float an = 2.5*(0.5+0.5*sin(iTime*1.1+3.0));
                vec2 c = vec2(sin(an),cos(an));
                return sdCappedTorus(pos, c, 0.5, 0.2 );
            }

            void main() {
                // Near plane frustum coords with center at (0, 0) and vertical
                // extent [-1, 1]. Horizontal varies by aspect ratio.
                vec2 frustum = vUv * 2.0 - vec2(1.0);
                frustum.x *= iResolution.x / iResolution.y;

                // Calculate basis vectors for camera.
                vec3 forward = normalize(lookAt - camPos);
                vec3 right = normalize(cross(forward, vec3(0.0, 1.0, 0.0)));
                vec3 up = cross(right, forward);

                // Calculate view ray (unit vector from camera through correct
                // pixel of frustum).
                vec3 ray = normalize(
                    frustum.x * right + frustum.y * up + focalLength * forward
                );

                // Set up raymarching loop.
                float t = 0.0;
                float steps = -0.001; // this bias prevents rounding error
                vec3 p = camPos;

                // Raymarch.
                while (t <= farPlaneDistance && steps <= maxIterations) {
                    float distance = sdf(p);
                    if (distance < 0.001) {
                        break;
                    }

                    p += distance * ray;
                    steps += 1.0;
                }


                gl_FragColor = vec4(vec3(fract(steps / 16.0)), 1.0);
            }
        `,
        
        depthWrite: false
    });
}