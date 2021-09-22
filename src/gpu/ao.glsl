renderer {
    uniform vec2 iResolution; // viewport resolution (in pixels)
    uniform vec3 camPos;
    //uniform vec3 lookAt;

    uniform vec3 cameraForward;
    uniform vec3 cameraRight;
    uniform vec3 cameraUp;

    uniform float focalLength;
    uniform float farPlaneDistance;
    uniform float maxIterations;
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
        vec3 forward = cameraForward; //normalize(lookAt - camPos);
        vec3 right = cameraRight; //normalize(cross(forward, vec3(0.0, 1.0, 0.0)));
        vec3 up = cameraUp; //cross(right, forward);

        // Calculate view ray (unit vector from camera through correct
        // pixel of frustum).
        vec3 ray = normalize(
            frustum.x * right + frustum.y * up + focalLength * forward
        );

        // Set up raymarching loop.
        float t = 0.0;
        float steps = -0.001; // this bias prevents rounding error
        vec3 p = camPos;

        float distance = sdf(p);
        float initialInside = -min(0, distance);
        vec4 interiorColor = vec4(0, 0, 0, 0.0);
        float hasBeenPositive = 0.0;
        float interiorStep = 0.06;

        // Raymarch.
        while (t <= farPlaneDistance && steps <= maxIterations) {
            
            if (distance > 0.001) {     
                if (hasBeenPositive == 0) {
                   interiorColor.a -= distance;
                }
                hasBeenPositive = 1;
            } else {
                if (hasBeenPositive > 0 || interiorColor.a >= 3.0) {
                    break;
                }
                distance = interiorStep;
                interiorColor += vec4(getPigment(p) * distance, distance);
            }

            p += distance * ray;
            t += distance;
            steps += 1.0;

            distance = sdf(p);
        }

        // Lighting.
        vec3 color = vec3(0.0, 0.0, 0.0);
        vec3 pigment = getPigment(p);

        if (distance < 1.0 && distance > -1.0) {
            vec3 normal = approximateNormal(p);
            //float diffuse = clamp(dot(normal, directionTowardSun), 0.0, 1.0);
            vec3 pigment = getPigment(p);
            //color = diffuse * sunColor * pigment;
            //vec3 f = normal;
            //vec3 s = normalize(cross(f, vec3(0.48, 0.6, 0.64)));
            //vec3 u = cross(s, f);
            //mat3 m = mat3(u, s, f);
            for (float i = 0; i < 12; i++) {
                //vec3 aoRay = m * aoDirections[i];
                vec3 aoRay = aoDirections[i];
                color += (0.12 + 0.88 * ao(p + normal * 0.005, aoRay)) / 12.0 * pigment; // * (0.55 + 0.45 * dot(aoRay, directionTowardSun));
            }

            color += pigment * vec3(0.4, 0.41, 0.42) * max(0.0, dot(directionTowardSun, normal));
            color += pigment * vec3(0.05, 0.05, 0.5) * max(0.0, normal.y);
            color *= 1.0 + max(0, 0.5 * pow(cos(dot(ray, normal)), 140.0));
            //color = mix(color, vec3(0.4, 0.36, 0.42), max(0, 0.005 * t));
        } else {
            color = sky(ray);
        }


        interiorColor.a = pow(clamp(interiorColor.a / 3, 0, 1), 0.5);
        color = mix(color, interiorColor.rgb / 3 * (0.8 - 0.2 * interiorColor.a), interiorColor.a);
        color *= 0.5 / (0.5 + initialInside);

        color = pow(color, vec3(0.45));
        gl_FragColor = vec4(color, 1.0);
    }
}