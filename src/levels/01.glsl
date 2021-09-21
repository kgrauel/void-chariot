
level {
    uniform float iTime = 0;
    uniform float spheres = 128;

    float opUnion( float d1, float d2 ) { return min(d1,d2); }
    float opSubtraction( float d1, float d2 ) { return max(-d1,d2); }
    float opIntersection( float d1, float d2 ) { return max(d1,d2); }

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

    float sdCappedTorus(vec3 p, vec2 sc, float ra, float rb)
    {
        p.x = abs(p.x);
        float k = (sc.y*p.x>sc.x*p.y) ? dot(p.xy,sc) : length(p.xy);
        return sqrt(max(0.0, dot(p,p) + ra*ra - 2.0*ra*k)) - rb;
    }

    float sdWavyPlane(vec3 p) {
        return p.y + 0.3 + clamp(-0.25 + 0.1 * length(p.xz), 0.0, 0.4) * sin(length(p.xz));
    }

    float sdf(vec3 p)
    {
        float an = 2.5 * (0.5 + 0.5 * sin(iTime * 1.1 + 3.0));
        float v = 10000.0;
        v = min(v, sdWavyPlane(p));
        v = opSubtraction(sdSphere(p - vec3(0.0, 0.8, 0.0), 1.5), v);
        v = opSubtraction(sdSphere(abs(p) - vec3(1.0, 0.2, 1.0), 0.5), v);
        v = min(v, sdCappedTorus(p, vec2(sin(an), cos(an)), 0.5, 0.2));
        v = min(v, sdBoxFrame(p - vec3(0.0, 0.45, 0.0), vec3(0.2, 0.3, 0.3), 0.03));
        
        for (float th = 0; th < 6.28; th += 6.285 / 64) {
            v = min(v, sdSphere(p - vec3(10 * cos(th), 0.0, 10 * sin(th)), 2.0 + 1.7 * cos(-iTime / 6 + th * 3)));
        }

        v = opSubtraction(sdSphere(p - vec3(10 * cos(iTime * 0.2), 3.0, 10 * sin(iTime * 0.2)), 6.0), v);

        return v;
    }

    vec3 getPigment(vec3 p) {
        vec3 c = vec3(0.9, 0.85, 0.87);
        float far = length(p.xz);

        if (far < 20) {
            if (mod(p.x, 2) < 1) {
                c *= vec3(1.0, 0.87, 0.8);
            }
            if (mod(p.z, 2) < 1) {
                c *= vec3(0.84, 0.88, 1.02);
            }
        }
        else {
            c *= 0.5;
        }
        float an = 2.5 * (0.5 + 0.5 * sin(iTime * 1.1 + 3.0));

        float wp = sdWavyPlane(p);
        if (wp < 0.005 && far < 2.1) {
            c = vec3(0.6);
        }
        if (wp < -0.01) {
            c = vec3(0.5, 0.35, 0.25) * 2.0 / (2.0 + floor(-p.y));
        }
        
        float ct = sdCappedTorus(p, vec2(sin(an), cos(an)), 0.5, 0.2);
        if (ct < 0.01) {
            c = vec3(0.3, 0.4 + p.y * 0.3, 0.5 + p.y * 0.3);
        }
        if (ct < -0.02) {
            c = vec3(0.04);
        }
        
        return c;
    }

    vec3 sky(vec3 dir) {
        return vec3(0.2, 0.26, 0.15) * pow(max(0.0, dot(dir, vec3(0.8, 0.4, 0.9))), 2.0)
            + vec3(0.26, 0.18, 0.15) * pow(max(0.0, dot(dir, vec3(-0.9, -0.4, -0.6))), 2.0)
            + vec3(0.05, 0.02, 0.17) * pow(max(0.0, dot(dir, vec3(0.8, -0.7, 0.9))), 2.0)
            + vec3(0.2, 0.2, 0.2) * pow(max(0.0, dot(dir, vec3(-0.3, 0.9, 0.1))), 2.0)
            + vec3(0.01, 0.02, 0.03);
        
        // return mix(
        //     vec3(0.3, 0.24, 0.46),
        //     vec3(0.8, 0.97, 1.0),
        //    b dir.y * 0.5 + 0.5
        // );
    }

}
