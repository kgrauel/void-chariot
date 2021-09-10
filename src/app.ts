import * as THREE from 'three';
import RenderPassDither from './render_pass_dither';
import RenderPassUpscale from './render_pass_upscale';
import Timer from './timer';
import View from './view';

export default class App {
    view: View;
    timer: Timer;
    
    constructor() {
        this.timer = new Timer();
        this.view = new View();
        
        this.onRequestAnimationFrame();
    }
    
    onRequestAnimationFrame() {
        this.timer.newFrame();
        document.getElementById("fps")!.innerText = String(Math.round(this.timer.getFPS()));
        document.getElementById("fct")!.innerText = String(this.timer.frameCount);

        this.view.camera.position.set(
            Math.cos(this.timer.getTotalElapsed()) * 10,
            0,
            Math.sin(this.timer.getTotalElapsed()) * 10,
        );
        this.view.camera.lookAt(0, 0, 0);
        
        this.view.renderFrame();
        
        requestAnimationFrame(() => this.onRequestAnimationFrame());
    }
}