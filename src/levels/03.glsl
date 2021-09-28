
level {
    uniform float iTime = 0;
    const float PI = 3.14159;
    const float TAU = PI * 2;
    const float PHI = (sqrt(5)*0.5 + 0.5);

    float sgn1(float x) {
        return (x<0)?-1:1;
    }

    vec2 sgn2(vec2 v) {
        return vec2((v.x<0)?-1:1, (v.y<0)?-1:1);
    }

    float square1(float x) {
        return x*x;
    }

    vec2 square2(vec2 x) {
        return x*x;
    }

    vec3 square3(vec3 x) {
        return x*x;
    }

    float lengthSqr(vec3 x) {
        return dot(x, x);
    }

    float vmax2(vec2 v) {
        return max(v.x, v.y);
    }

    float vmax3(vec3 v) {
        return max(max(v.x, v.y), v.z);
    }

    float vmax4(vec4 v) {
        return max(max(v.x, v.y), max(v.z, v.w));
    }

    float vmin2(vec2 v) {
        return min(v.x, v.y);
    }

    float vmin3(vec3 v) {
        return min(min(v.x, v.y), v.z);
    }

    float vmin4(vec4 v) {
        return min(min(v.x, v.y), min(v.z, v.w));
    }



    float ball(vec3 p, float r) {
        return length(p) - r;
    }

    // Plane with normal n (n is normalized) at some distance from the origin
    float plane(vec3 p, vec3 n, float distanceFromOrigin) {
        return dot(p, n) + distanceFromOrigin;
    }

    // Cheap Box: distance to corners is overestimated
    float box_cheap(vec3 p, vec3 b) { //cheap box
        return vmax3(abs(p) - b);
    }

    // Box: correct distance to corners
    float box(vec3 p, vec3 b) {
        vec3 d = abs(p) - b;
        return length(max(d, vec3(0))) + vmax3(min(d, vec3(0)));
    }

    // Same as above, but in two dimensions (an endless box)
    float box2_cheap(vec2 p, vec2 b) {
        return vmax2(abs(p)-b);
    }

    float box2(vec2 p, vec2 b) {
        vec2 d = abs(p) - b;
        return length(max(d, vec2(0))) + vmax2(min(d, vec2(0)));
    }


    // Endless "corner"
    float corner(vec2 p) {
        return length(max(p, vec2(0))) + vmax2(min(p, vec2(0)));
    }

    // Blobby ball object. You've probably seen it somewhere. This is not a correct distance bound, beware.
    float blob(vec3 p) {
        p = abs(p);
        if (p.x < max(p.y, p.z)) { p = p.yzx; }
        if (p.x < max(p.y, p.z)) { p = p.yzx; }
        float b = max(max(max(
            dot(p, normalize(vec3(1, 1, 1))),
            dot(p.xz, normalize(vec2(PHI+1, 1)))),
            dot(p.yx, normalize(vec2(1, PHI)))),
            dot(p.xz, normalize(vec2(1, PHI))));
        float l = length(p);
        return l - 1.5 - 0.2 * (1.5 / 2)* cos(min(sqrt(1.01 - b / l)*(PI / 0.25), PI));
    }

    // Cylinder standing upright on the xz plane
    float cylinder(vec3 p, float r, float height) {
        float d = length(p.xz) - r;
        d = max(d, abs(p.y) - height);
        return d;
    }

    // Capsule: A Cylinder with round caps on both sides
    float capsule(vec3 p, float r, float c) {
        return mix(length(p.xz) - r, length(vec3(p.x, abs(p.y) - c, p.z)) - r, step(c, abs(p.y)));
    }

    // Distance to line segment between <a> and <b>, used for fCapsule() version 2below
    float segment(vec3 p, vec3 a, vec3 b) {
        vec3 ab = b - a;
        float t = clamp(dot(p - a, ab) / dot(ab, ab), 0, 1);
        return length((ab*t + a) - p);
    }

    // Capsule version 2: between two end points <a> and <b> with radius r 
    float capsule_endpoints(vec3 p, vec3 a, vec3 b, float r) {
        return segment(p, a, b) - r;
    }

    // Torus in the XZ-plane
    float doughnut(vec3 p, float smallRadius, float largeRadius) {
        return length(vec2(length(p.xz) - largeRadius, p.y)) - smallRadius;
    }

    // A circle line. Can also be used to make a torus by subtracting the smaller radius of the torus.
    float circle(vec3 p, float r) {
        float l = length(p.xz) - r;
        return length(vec2(p.y, l));
    }

    // A circular disc with no thickness (i.e. a cylinder with no height).
    // Subtract some value to make a flat disc with rounded edge.
    float disk(vec3 p, float r) {
        float l = length(p.xz) - r;
        return l < 0 ? abs(p.y) : length(vec2(p.y, l));
    }

    // Hexagonal prism, circumcircle variant
    float hexagon_circumcircle(vec3 p, vec2 h) {
        vec3 q = abs(p);
        return max(q.y - h.y, max(q.x*sqrt(3)*0.5 + q.z*0.5, q.z) - h.x);
        //this is mathematically equivalent to this line, but less efficient:
        //return max(q.y - h.y, max(dot(vec2(cos(PI/3), sin(PI/3)), q.zx), q.z) - h.x);
    }

    // Hexagonal prism, incircle variant
    float hexagon_incircle(vec3 p, vec2 h) {
        return hexagon_circumcircle(p, vec2(h.x*sqrt(3)*0.5, h.y));
    }

    // Cone with correct distances to tip and base circle. Y is up, 0 is in the middle of the base.
    float cone(vec3 p, float radius, float height) {
        vec2 q = vec2(length(p.xz), p.y);
        vec2 tip = q - vec2(0, height);
        vec2 mantleDir = normalize(vec2(height, radius));
        float mantle = dot(tip, mantleDir);
        float d = max(mantle, -q.y);
        float projected = dot(tip, vec2(mantleDir.y, -mantleDir.x));
        
        // distance to tip
        if ((q.y > height) && (projected < 0)) {
            d = max(d, length(tip));
        }
        
        // distance to base ring
        if ((q.x > radius) && (projected > length(vec2(height, radius)))) {
            d = max(d, length(q - vec2(radius, 0)));
        }
        return d;
    }




    // Rotate around a coordinate axis (i.e. in a plane perpendicular to that axis) by angle <a>.
    // Read like this: R(p.xz, a) rotates "x towards z".
    // This is fast if <a> is a compile-time constant and slower (but still practical) if not.
    vec2 pR(vec2 p, float a) {
        return cos(a)*p + sin(a)*vec2(p.y, -p.x);
    }

    // Shortcut for 45-degrees rotation
    vec2 pR45(vec2 p) {
        return (p + vec2(p.y, -p.x))*sqrt(0.5);
    }

    // Repeat space along one axis. Use like this to repeat along the x axis:
    // <float cell = pMod1(p.x,5);> - using the return value is optional.
    vec2 pMod1(float p, float size) {
        float halfsize = size*0.5;
        float c = floor((p + halfsize)/size);
        p = mod(p + halfsize, size) - halfsize;
        return vec2(p, c);
    }



    float union_sharp(float d1, float d2) {
        return min(d1, d2); 
    }

    float difference_sharp(float d1, float d2) { 
        return max(d1, -d2); 
    }

    float intersection_sharp(float d1, float d2) { 
        return max(d1, d2); 
    }


    // The "Chamfer" flavour makes a 45-degree chamfered edge (the diagonal of a square of size <r>):
    float union_chamfer(float a, float b, float r) {
        return min(min(a, b), (a - r + b)*sqrt(0.5));
    }

    // Intersection has to deal with what is normally the inside of the resulting object
    // when using union, which we normally don't care about too much. Thus, intersection
    // implementations sometimes differ from union implementations.
    float intersection_chamfer(float a, float b, float r) {
        return max(max(a, b), (a + r + b)*sqrt(0.5));
    }

    // Difference can be built from Intersection or Union:
    float difference_chamfer (float a, float b, float r) {
        return intersection_chamfer(a, -b, r);
    }

    // The "Round" variant uses a quarter-circle to join the two objects smoothly:
    float union_round(float a, float b, float r) {
        vec2 u = max(vec2(r - a,r - b), vec2(0));
        return max(r, min (a, b)) - length(u);
    }

    float intersection_round(float a, float b, float r) {
        vec2 u = max(vec2(r + a,r + b), vec2(0));
        return min(-r, max (a, b)) + length(u);
    }

    float difference_round (float a, float b, float r) {
        return intersection_round(a, -b, r);
    }


    // The "Columns" flavour makes n-1 circular columns at a 45 degree angle:
    float union_columns(float a, float b, float r, float n) {
        if ((a < r) && (b < r)) {
            vec2 p = vec2(a, b);
            float columnradius = r*sqrt(2)/((n-1)*2+sqrt(2));
            pR45(p);
            p.x -= sqrt(2)/2*r;
            p.x += columnradius*sqrt(2);
            if (mod(n,2) == 1) {
                p.y += columnradius;
            }
            // At this point, we have turned 45 degrees and moved at a point on the
            // diagonal that we want to place the columns on.
            // Now, repeat the domain along this direction and place a circle.
            p.y = pMod1(p.y, columnradius*2).x;
            float result = length(p) - columnradius;
            result = min(result, p.x);
            result = min(result, a);
            return min(result, b);
        } else {
            return min(a, b);
        }
    }

    float difference_columns(float a, float b, float r, float n) {
        a = -a;
        float m = min(a, b);
        //avoid the expensive computation where not needed (produces discontinuity though)
        if ((a < r) && (b < r)) {
            vec2 p = vec2(a, b);
            float columnradius = r*sqrt(2)/n/2.0;
            columnradius = r*sqrt(2)/((n-1)*2+sqrt(2));

            pR45(p);
            p.y += columnradius;
            p.x -= sqrt(2)/2*r;
            p.x += -columnradius*sqrt(2)/2;

            if (mod(n,2) == 1) {
                p.y += columnradius;
            }
            p.y = pMod1(p.y,columnradius*2).x;

            float result = -length(p) + columnradius;
            result = max(result, p.x);
            result = min(result, a);
            return -min(result, b);
        } else {
            return -m;
        }
    }

    float intersection_columns(float a, float b, float r, float n) {
        return difference_columns(a,-b,r, n);
    }

    // The "Stairs" flavour produces n-1 steps of a staircase:
    // much less stupid version by paniq
    float union_stairs(float a, float b, float r, float n) {
        float s = r/n;
        float u = b-r;
        return min(min(a,b), 0.5 * (u + a + abs ((mod (u - a + s, 2 * s)) - s)));
    }

    // We can just call Union since stairs are symmetric.
    float intersection_stairs(float a, float b, float r, float n) {
        return -union_stairs(-a, -b, r, n);
    }

    float difference_stairs(float a, float b, float r, float n) {
        return -union_stairs(-a, b, r, n);
    }


    // Similar to fOpUnionRound, but more lipschitz-y at acute angles
    // (and less so at 90 degrees). Useful when fudging around too much
    // by MediaMolecule, from Alex Evans' siggraph slides
    float union_soft(float a, float b, float r) {
        float e = max(r - abs(a - b), 0);
        return min(a, b) - e*e*0.25/r;
    }


    // produces a cylindical pipe that runs along the intersection.
    // No objects remain, only the pipe. This is not a boolean operator.
    float pipe(float a, float b, float r) {
        return length(vec2(a, b)) - r;
    }

    // first object gets a v-shaped engraving where it intersect the second
    float carve(float a, float b, float r) {
        return max(a, (a + r - abs(b))*sqrt(0.5));
    }

    // first object gets a capenter-style groove cut out
    float groove(float a, float b, float ra, float rb) {
        return max(a, min(a + ra, rb - abs(b)));
    }

    // first object gets a capenter-style tongue attached
    float tongue(float a, float b, float ra, float rb) {
        return min(a, max(a - ra, abs(b) - rb));
    }




    
    float sdf(vec3 p)
    {
        float v = cylinder(p - vec3(0, -10, 0), 10, 10);
        v = difference_sharp(v, ball(p - vec3(0, 0, 0), 5.0));
        v = union_sharp(v, ball(p - vec3(0, 0, -5), 1.0));

        v = union_sharp(v, ball(p - vec3(0, 17, 0), 5.0)); 
        v = difference_sharp(v, cylinder(p - vec3(0, -15, 0), 1, 12.0));
        return v;
    }

    vec3 getPigment(vec3 p) {
        vec3 c = vec3(0.4);
         
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
