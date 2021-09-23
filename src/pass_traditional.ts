import * as THREE from "three";
import { APP } from "./app";
import PassAbstract from "./pass_abstract";

export default class PassTraditional extends PassAbstract {
    camera: THREE.PerspectiveCamera;

    constructor(
        makeOwnRenderTarget: boolean
    ) {
        super(makeOwnRenderTarget);

        this.camera = new THREE.PerspectiveCamera(
            90, 1, 0.1, 100
        );

        this.scene = new THREE.Scene();

        let geometry = new THREE.SphereGeometry(1.5, 32, 32);
        let material = new THREE.MeshStandardMaterial({ color: 0xc080c0 });
        let sphere = new THREE.Mesh(geometry, material);
        sphere.position.set(0, 0, -5);
        this.scene.add(sphere);

        this.scene.add(new THREE.AmbientLight(0xc0e0ff, 0.2));
        let sun = new THREE.DirectionalLight(0xf0f0f0, 0.6);
        
        this.scene.add(sun);


    }

    postCreateRenderTargetCustomize() {
        if (this.outputTarget === null) {
            return;
        }
        this.outputTarget.depthBuffer = true;
        this.outputTarget.depthTexture = new THREE.DepthTexture(
            this.outputTarget.width,
            this.outputTarget.height,
            THREE.UnsignedIntType
        );
    }

    compileShaders(renderer: THREE.WebGLRenderer) {
        renderer.compile(this.scene, this.camera);
    }

    updateAspectRatio(resolution: number[]) {
        this.camera.aspect = resolution[0] / resolution[1];
        this.camera.updateProjectionMatrix()
    }

    render(
        renderer: THREE.WebGLRenderer,
        previousPass: THREE.Texture | null,
        targetDimensions: number[] | null
    ): any {
        
        this.updateRenderTarget(targetDimensions);

        // If this.outputTarget is null, this renders to the screen.
        renderer.setRenderTarget(this.outputTarget);
        renderer.render(this.scene, this.camera);
    }
}