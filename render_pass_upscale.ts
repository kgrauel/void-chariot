import * as THREE from 'three';

export default class RenderPassUpscale {
    target: THREE.WebGLRenderTarget;
    scene: THREE.Scene;
    camera: THREE.OrthographicCamera;
    material: THREE.ShaderMaterial;
    geometry: THREE.PlaneGeometry;
    mesh: THREE.Mesh;
    
    calculateDimensions() {
        let bestFraction = 0;
        let bestScore = 0.0;
        for (let f = 1; f <= 10; f++) {
            let pixels = (window.innerWidth / f) * (window.innerHeight / f);
            let score = 40000 / pixels;
            if (score > 1) {
                score = 1 / score;
            }
            if (score > bestScore) {
                bestScore = score;
                bestFraction = f;
            }
        }
        return [
            Math.round(window.innerWidth / bestFraction),
            Math.round(window.innerHeight / bestFraction)
        ];
    }

    getShader() {
        return new THREE.ShaderMaterial({
            uniforms: {
                tDiffuse: {
                    value: this.target.texture
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
                uniform sampler2D tDiffuse;

                void main() {
                    vec3 base = texture2D(tDiffuse, vUv).rgb;
                    gl_FragColor = vec4(base, 1.0);
                }
            `,
            depthWrite: false
        });
    }

    constructor() {
        const dim = this.calculateDimensions();

        this.target = new THREE.WebGLRenderTarget(
            dim[0],
            dim[1],
            {
                minFilter: THREE.LinearFilter,
                magFilter: THREE.NearestFilter,
                format: THREE.RGBFormat
            }
        );

        this.camera = new THREE.OrthographicCamera(
            -1, 1,
            1, -1,
            -10000,
            10000
        );

        this.camera.position.z = 1;

        this.material = this.getShader();

        this.geometry = new THREE.PlaneGeometry(2, 2);
        this.mesh = new THREE.Mesh(this.geometry, this.material);
        this.mesh.position.z = -100;

        this.scene = new THREE.Scene();
        this.scene.add(this.mesh);
    }

    onResize() {
        const dim = this.calculateDimensions();
        this.target.setSize(
            dim[0],
            dim[1]
        );
    }
}

