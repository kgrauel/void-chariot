import * as THREE from "three";
import { APP } from "./app";
import PassShaderQuad from "./pass_shader_quad";
import createDitherShader from "./shader_dither";
import createSDFShader from "./shader_sdf";
import createUpscaleShader from "./shader_upscale";


export default class RenderGraph {
    lrSize: number[];
    hrSize: number[];
    pixelCountTarget: number;

    // WebGLRenderer and WebGLRenderTarget both offer a surface to render to.
    // In that respect, they both participate in the render graph as nodes.
    // The edges between the nodes are objects derived from PassAbstract.
    renderer: THREE.WebGLRenderer;

    sdfPass: PassShaderQuad;
    ditherPass: PassShaderQuad;
    upscalePass: PassShaderQuad;


    constructor(levelName: string, rendererName: string) {
        this.lrSize = [];
        this.hrSize = [];
        this.pixelCountTarget = 150000;

        // Construct the graph, terminal nodes first
        this.renderer = new THREE.WebGLRenderer();
        this.renderer.outputEncoding = THREE.sRGBEncoding;

        this.sdfPass = new PassShaderQuad(true, createSDFShader(levelName, rendererName));
        this.ditherPass = new PassShaderQuad(true, createDitherShader());
        this.upscalePass = new PassShaderQuad(false, createUpscaleShader());
    
        this.updateDimensions();

        let compileTime = this.compileShaders();
        console.log(`Compiled in ${compileTime} seconds.`);
    }

    getDOMElement(): any {
        return this.renderer.domElement;
    }

    // Uses the value of this.hrSize and this.pixelCountTarget to calculate
    // a reasonable resolution for the low-res render targets
    calculateBestLowResolutionDimensions() {
        let bestFraction = 0;
        let bestScore = 0.0;
        
        for (let f = 1; f <= 10; f++) {
            let pixels = (this.hrSize[0] / f) * (this.hrSize[1] / f);
            let score = this.pixelCountTarget / pixels;
            if (score > 1) {
                score = 1 / score;
            }
            if (score > bestScore) {
                bestScore = score;
                bestFraction = f;
            }
        }

        return [
            Math.round(this.hrSize[0] / bestFraction),
            Math.round(this.hrSize[1] / bestFraction)
        ];
    }

    updateDimensions() {
        this.hrSize = [window.innerWidth, window.innerHeight];
        this.lrSize = this.calculateBestLowResolutionDimensions();

        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.setSize(this.hrSize[0], this.hrSize[1]);
    }

    compileShaders() {
        let start = performance.now();
        this.sdfPass.compileShaders(this.renderer);
        this.sdfPass.compileShaders(this.renderer);
        let elapsed = performance.now() - start;
        return elapsed / 1000;
    }

    render() {
        let t = APP.timer.getTotalElapsed();
        this.sdfPass.setUniform("camPos", APP.level.cameraPosition);
        //this.sdfPass.setUniform("lookAt", APP.level.cameraPosition.clone().add(APP.level.getCameraForward()));
        this.sdfPass.setUniform("cameraForward", APP.level.getCameraForward());
        this.sdfPass.setUniform("cameraRight", APP.level.getCameraRight());
        this.sdfPass.setUniform("cameraUp", APP.level.getCameraUp());
        this.sdfPass.render(this.renderer, null, this.lrSize);
        //this.ditherPass.render(this.renderer, this.sdfPass.getOutputTexture(), this.lrSize);
        this.upscalePass.render(this.renderer, this.sdfPass.getOutputTexture(), null);
        
    }
}