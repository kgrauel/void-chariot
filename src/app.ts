import Timer from './timer';
import View from './view';

class App {
    view: View;
    timer: Timer;
    debugMessage: string;

    constructor() {
        this.debugMessage = "";

        try {
            this.timer = new Timer();
            this.view = new View();
        } catch (e: any) {
            this.debugMessage = e.message;
            throw "Could not initialize application.";
        }
    }
     
    start() {
        this.onRequestAnimationFrame();
    }
    
    onRequestAnimationFrame() {
        this.timer.newFrame();

        const dim = this.view.getDimensions();
        document.getElementById("fps")!.innerText = String(Math.round(this.timer.getFPS()));
        document.getElementById("fct")!.innerText = String(this.timer.frameCount);
        document.getElementById("res")!.innerText = `${dim[0]}×${dim[1]}`;
        document.getElementById("msg")!.innerText = `${this.debugMessage}`;
        
        try {
            this.view.renderFrame();
        } catch (e: any) {
            this.debugMessage = e.message;
            throw e;
        }      
        
        requestAnimationFrame(() => this.onRequestAnimationFrame());
    }
}



// This is the entry point.
export let APP = new App();
APP.start();
