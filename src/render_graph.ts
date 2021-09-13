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


    constructor() {
        this.lrSize = [];
        this.hrSize = [];
        this.pixelCountTarget = 100000;

        // Construct the graph, terminal nodes first
        this.renderer = new THREE.WebGLRenderer();
        this.renderer.outputEncoding = THREE.sRGBEncoding;

        this.sdfPass = new PassShaderQuad(true, createSDFShader());
        this.ditherPass = new PassShaderQuad(true, createDitherShader());
        this.upscalePass = new PassShaderQuad(false, createUpscaleShader());
    
        this.updateDimensions();
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

    render() {
        let t = APP.timer.getTotalElapsed();
        this.sdfPass.setUniform("camPos", [2.5 * Math.cos(t * 0.7), 0.5, 2.5 * Math.sin(t * 0.7)]);
        this.sdfPass.render(this.renderer, null, this.lrSize);
        //this.ditherPass.render(this.renderer, this.sdfPass.getOutputTexture(), this.lrSize);
        this.upscalePass.render(this.renderer, this.sdfPass.getOutputTexture(), null);
    }
}