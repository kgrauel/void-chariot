import * as THREE from "three";

export default function createSDFShader() {
    return new THREE.ShaderMaterial({
        uniforms: {
            iResolution: { value: [100, 100] },
            iTime: { value: 0.0 },
            iFrame: { value: 0 },
            camPos: { value: [1, 0.4, 2] },
            lookAt: { value: [0, 0, 0] },
            focalLength: { value: 2.0 },
            farPlaneDistance: { value: 30.0 },
            maxIterations: { value: 250.0 },
            directionTowardSun: { value: [1, 1, 1] },
            sunColor: { value: [0.7, 0.7, 0.7] },
            aoIterations: { value: 10 },
            aoDistance: { value: 0.01 },
            aoPower: { value: 1.25 },
            
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
            uniform vec3 directionTowardSun;
            uniform vec3 sunColor;
            uniform float aoIterations;
            uniform float aoDistance;
            uniform float aoPower;

            const vec3 aoDirections[12] = vec3[12] (
                vec3(0.357407, 0.357407, 0.862856),
                vec3(0.357407, 0.862856, 0.357407),
                vec3(0.862856, 0.357407, 0.357407),
                vec3(-0.357407, 0.357407, 0.862856),
                vec3(-0.357407, 0.862856, 0.357407),
                vec3(-0.862856, 0.357407, 0.357407),
                vec3(0.357407, -0.357407, 0.862856),
                vec3(0.357407, -0.862856, 0.357407),
                vec3(0.862856, -0.357407, 0.357407),
                vec3(-0.357407, -0.357407, 0.862856),
                vec3(-0.357407, -0.862856, 0.357407),
                vec3(-0.862856, -0.357407, 0.357407)
            );

            #define ZERO (min(iFrame,0))

            float opUnion( float d1, float d2 ) { return min(d1,d2); }

            float opSubtraction( float d1, float d2 ) { return max(-d1,d2); }

            float opIntersection( float d1, float d2 ) { return max(d1,d2); }

            vec3 warpTwist(vec3 p, float k)
            {
                float c = cos(k*p.y);
                float s = sin(k*p.y);
                mat2  m = mat2(c,-s,s,c);
                vec2  xz = m*p.xz;
                return vec3(xz.x, p.y, xz.y);
            }

            float sdSphere( vec3 p, float s )
            {
                return length(p)-s;
            }

            float sdBoxFrame( vec3 p, vec3 b, float e )
            {
                p = abs(p)-b;
                vec3 q = abs(p+e)-e;
                return min(min(
                    length(max(vec3(p.x,q.y,q.z),0.0))+min(max(p.x,max(q.y,q.z)),0.0),
                    length(max(vec3(q.x,p.y,q.z),0.0))+min(max(q.x,max(p.y,q.z)),0.0)),
                    length(max(vec3(q.x,q.y,p.z),0.0))+min(max(q.x,max(q.y,p.z)),0.0));
            }

            float sdCappedTorus(in vec3 p, in vec2 sc, in float ra, in float rb)
            {
                p.x = abs(p.x);
                float k = (sc.y*p.x>sc.x*p.y) ? dot(p.xy,sc) : length(p.xy);
                return sqrt( dot(p,p) + ra*ra - 2.0*ra*k ) - rb;
            }

            float sdf(vec3 p)
            {
                float an = 2.5 * (0.5 + 0.5 * sin(iTime * 1.1 + 3.0));
                float v = 10000.0;
                v = min(v, p.y + 0.3);
                v = opSubtraction(sdSphere(p - vec3(0.0, 0.8, 0.0), 1.5), v);
                v = opSubtraction(sdSphere(abs(p) - vec3(1.0, 0.2, 1.0), 0.5), v);
                //vec3 pIn = warpTwist(p, 1.0 + 1.0 * cos(iTime));
                v = min(v, sdCappedTorus(p, vec2(sin(an), cos(an)), 0.5, 0.2));
                v = min(v, sdBoxFrame(p - vec3(0.0, 0.45, 0.0), vec3(0.2, 0.3, 0.3), 0.03));
                
                return v;
            }

            vec3 getPigment(vec3 p) {
                return vec3(0.9);
            }

            vec3 sky(vec3 dir) {
                return mix(
                    vec3(0.3, 0.24, 0.46),
                    vec3(0.8, 0.97, 1.0),
                    dir.y * 0.5 + 0.5
                );
            }

            vec3 approximateNormal(vec3 pos) {
                vec2 e = vec2(0.5773, -0.5773);
                return normalize(
                    e.xyy * sdf(pos + e.xyy * 0.005) +
                    e.yyx * sdf(pos + e.yyx * 0.005) + 
                    e.yxy * sdf(pos + e.yxy * 0.005) + 
                    e.xxx * sdf(pos + e.xxx * 0.005)
                );
            }

            float ao(vec3 start, vec3 normal) {
                float dist = aoDistance;
                float occ = 1.0;
                for (float i = -0.001; i < aoIterations; i++) {
                    occ = min(occ, sdf(start + dist * normal) / dist);
                    dist *= aoPower;
                }
                occ = max(occ, 0.0);
                return occ;
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
                float distance = 50.0;

                // Raymarch.
                while (t <= farPlaneDistance && steps <= maxIterations) {
                    distance = sdf(p);
                    if (distance < 0.001) {
                        break;
                    }

                    p += distance * ray;
                    steps += 1.0;
                }

                // Lighting.
                vec3 color = vec3(0.0, 0.0, 0.0);
                if (distance < 0.002) {
                    vec3 normal = approximateNormal(p);
                    //float diffuse = clamp(dot(normal, directionTowardSun), 0.0, 1.0);
                    //vec3 pigment = getPigment(p);
                    //color = diffuse * sunColor * pigment;
                    vec3 f = normal;
                    vec3 s = normalize(cross(f, vec3(0.48, 0.6, 0.64)));
                    vec3 u = cross(s, f);
                    mat3 m = mat3(u, s, f);
                    for (int i = 0; i < 12; i++) {
                        vec3 aoRay = m * aoDirections[i];
                        color += ao(p + normal * 0.005, aoRay) / 12.0 * (0.5 + 0.5 * dot(aoRay, directionTowardSun));
                    }
                } else {
                    color = sky(ray);
                }
                


                color = pow(color, vec3(0.45));
                gl_FragColor = vec4(color, 1.0);
            }
        `,
        
        depthWrite: false
    });
}