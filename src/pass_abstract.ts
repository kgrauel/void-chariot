import * as THREE from "three";

export default abstract class PassAbstract {
    scene: THREE.Scene;

    makeOwnRenderTarget: boolean;
    outputTarget: THREE.WebGLRenderTarget | null;

    abstract render(
        renderer: THREE.WebGLRenderer,
        previousPass: THREE.Texture | null,
        targetDimensions: number[]): any;

    constructor(makeOwnRenderTarget: boolean) {
        this.scene = new THREE.Scene();
        this.outputTarget = null;
        this.makeOwnRenderTarget = makeOwnRenderTarget;
    }

    getOutputTexture(): THREE.Texture {
        if (this.outputTarget === null) {
            throw new Error("Cannot get output texture from pass; none exists");
        }

        return this.outputTarget.texture;
    }

    compileShaders(renderer: THREE.WebGLRenderer) {
        // do nothing
    }

    updateRenderTarget(targetDimensions: number[] | null): any {
        if (this.makeOwnRenderTarget) {
            if (targetDimensions === null || targetDimensions.length !== 2) {
                throw new Error("Pass is set to render to its own target, but dimensions were not given in the render() call");
            }
            if (this.outputTarget === null) {
                this.outputTarget = new THREE.WebGLRenderTarget(
                    targetDimensions[0],
                    targetDimensions[1],
                    {
                        minFilter: THREE.LinearFilter,
                        magFilter: THREE.NearestFilter,
                        format: THREE.RGBFormat
                    }
                );
                this.postCreateRenderTargetCustomize();
                
            } else if (
                this.outputTarget.width !== targetDimensions[0] || 
                this.outputTarget.height !== targetDimensions[1]
            ) {
                this.outputTarget.setSize(
                    targetDimensions[0],
                    targetDimensions[1]
                );
            }
        } else {
            if (targetDimensions !== null) {
                throw new Error("Pass is set to render to screen, but dimensions were given in the render() call");
            }
            if (this.outputTarget !== null) {
                throw new Error("Pass is set to render to screen, but outputTarget is not null");
            }
        }
    }

    postCreateRenderTargetCustomize() {
        // do nothing; this is intended for overriding
    }
}