import * as THREE from "three";
import { APP } from "./app";
import PassAbstract from "./pass_abstract";

// For a pass that renders a single quad with a shader on it
export default class PassShaderQuad extends PassAbstract {
    camera: THREE.OrthographicCamera;
    material: THREE.ShaderMaterial | THREE.RawShaderMaterial;
    geometry: THREE.PlaneGeometry;
    mesh: THREE.Mesh;

    constructor(
        makeOwnRenderTarget: boolean,
        shaderMaterial: THREE.ShaderMaterial | THREE.RawShaderMaterial
    ) {
        super(makeOwnRenderTarget);

        this.camera = new THREE.OrthographicCamera(
            -1, 1,
            1, -1,
            -10000,
            10000
        );

        this.camera.position.z = 1;

        this.material = shaderMaterial;

        this.geometry = new THREE.PlaneGeometry(2, 2);
        this.mesh = new THREE.Mesh(this.geometry, this.material);
        this.mesh.position.z = -100;

        this.scene = new THREE.Scene();
        this.scene.add(this.mesh);
    }

    setUniform(variableName: string, value: any) {
        this.material.uniforms[variableName] = { value: value };
    }

    render(
        renderer: THREE.WebGLRenderer,
        previousPass: THREE.Texture | null,
        targetDimensions: number[] | null
    ): any {
        
        this.updateRenderTarget(targetDimensions);

        // If this.outputTarget is null, this renders to the screen.
        renderer.setRenderTarget(this.outputTarget);

        if (previousPass !== null) {
            this.material.uniforms.previousPass = {
                value: previousPass
            };
        }

        const size = new THREE.Vector2();
        renderer.getSize(size);

        this.material.uniforms.iTime = { value: APP.timer.getTotalElapsed() };
        this.material.uniforms.iResolution = {
            value: (
                targetDimensions !== null ?
                    targetDimensions : size
            )
        };

        renderer.render(this.scene, this.camera);
    }
}