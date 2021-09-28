import * as THREE from "three";
import { APP } from "./app";
import PassShaderQuad from "./pass_shader_quad";
import PassTraditional from "./pass_traditional";
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
    traditionalPass: PassTraditional;

    constructor(levelName: string, rendererName: string) {
        this.lrSize = [];
        this.hrSize = [];
        this.pixelCountTarget = 150000;

        // Construct the graph, terminal nodes first
        this.renderer = new THREE.WebGLRenderer({
            powerPreference: "high-performance"
        });
        this.renderer.outputEncoding = THREE.sRGBEncoding;

        if (this.renderer.capabilities.isWebGL2 === false
            && this.renderer.extensions.has('WEBGL_depth_texture') === false)
        {
            console.log("cannot render to depth texture");
            throw "device capabilities too low";
        }

        this.sdfPass = new PassShaderQuad(true, createSDFShader(levelName, rendererName));
        this.ditherPass = new PassShaderQuad(true, createDitherShader());
        this.upscalePass = new PassShaderQuad(false, createUpscaleShader());
        this.traditionalPass = new PassTraditional(true);
        
        this.updateDimensions();

        let compileTime = this.compileShaders();
        console.log(`Compiled in ${compileTime} seconds.`);
    }

    changeLevel(levelName: string, rendererName: string) {
        this.sdfPass.updateMaterial(createSDFShader(levelName, rendererName));
        this.traditionalPass.scene.clear();
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

        this.traditionalPass.updateAspectRatio(this.lrSize);
    }

    compileShaders() {
        let start = performance.now();
        this.sdfPass.compileShaders(this.renderer);
        //this.upscalePass.compileShaders(this.renderer);  // BREAKS EVERYTHING DO NOT RUN
        this.traditionalPass.compileShaders(this.renderer);
        let elapsed = performance.now() - start;
        return elapsed / 1000;
    }

    render() {
        let t = APP.timer.getTotalElapsed();
        
        this.traditionalPass.camera.position.copy(APP.level.cameraPosition);
        this.traditionalPass.camera.setRotationFromQuaternion(APP.level.cameraOrientation);
        this.traditionalPass.render(this.renderer, null, this.lrSize);


        this.sdfPass.setUniform("camPos", APP.level.cameraPosition);
        this.sdfPass.setUniform("cameraForward", APP.level.getCameraForward());
        this.sdfPass.setUniform("cameraRight", APP.level.getCameraRight());
        this.sdfPass.setUniform("cameraUp", APP.level.getCameraUp());
        this.sdfPass.setUniform("colorIn", this.traditionalPass.outputTarget?.texture);
        this.sdfPass.setUniform("depthIn", this.traditionalPass.outputTarget?.depthTexture);
        this.sdfPass.render(this.renderer, null, this.lrSize);
        
        //this.ditherPass.render(this.renderer, this.sdfPass.getOutputTexture(), this.lrSize);
        if (APP.pressedKeys.has('q')) {
            this.upscalePass.render(this.renderer, this.traditionalPass.getOutputTexture(), null);
        } else {
            this.upscalePass.render(this.renderer, this.sdfPass.getOutputTexture(), null);
        }
        
    }
}