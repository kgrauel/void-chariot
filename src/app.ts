import Level from './level';
import Timer from './timer';
import View from './view';

class App {
    view: View;
    timer: Timer;
    level: Level;

    rendererName: string;
    levelName: string;
    
    debugMessage: string;

    pressedKeys: Set<string>;
    pressedMouseButtons: Set<number>;
    mousePosition: number[];
    dragLast: number[] | null;
    dragDeltaThisFrame: number[] | null;

    constructor() {
        this.debugMessage = "";
        this.pressedKeys = new Set();
        this.pressedMouseButtons = new Set();
        this.mousePosition = [0, 0];
        this.dragLast = null;
        this.dragDeltaThisFrame = null;

        try {
            this.levelName = "01";
            this.rendererName = "ao";

            this.timer = new Timer();
            this.level = new Level(this.levelName);
            this.view = new View(this.levelName, this.rendererName);

            this.level.insertObjectsIntoScene(this.view.getTraditionalScene());

            this.registerEventHandlers();
        } catch (e: any) {
            this.debugMessage = e.message;
            throw "Could not initialize application.";
        }
    }
    
    changeLevel(levelName: string, rendererName: string) {
        this.levelName = levelName;
        this.rendererName = rendererName;

        this.timer.reset();
        this.level.dispose();
        this.level = new Level(this.levelName);
        
        this.view.changeLevel(this.levelName, this.rendererName);

        this.level.insertObjectsIntoScene(this.view.getTraditionalScene());
    }

    start() {
        this.onRequestAnimationFrame();
    }
    
    registerEventHandlers() {
        window.addEventListener("keydown", (event) => {
            this.pressedKeys.add(event.key);

            if (event.key === "e") {
                const x = this.level.cameraPosition.x;
                const y = this.level.cameraPosition.y;
                const z = this.level.cameraPosition.z;

                console.log(`level.addTargetPickup(new THREE.Vector3(${x}, ${y}, ${z}));`);
            }

            if (event.key === "r") {
                this.changeLevel(this.levelName, this.rendererName);
            }

            if (event.key === "1") {
                this.changeLevel("01", "ao");
            }

            if (event.key === "2") {
                this.changeLevel("02", "ao");
            }
        });

        window.addEventListener("keyup", (event) => {
            this.pressedKeys.delete(event.key);
        });

        window.addEventListener("mousedown", (event) => {
            this.pressedMouseButtons.add(event.button);
            this.mousePosition = [event.x, event.y];
            this.dragLast = [event.x, event.y];
        });

        window.addEventListener("mousemove", (event) => {
            this.mousePosition = [event.x, event.y];
        })

        window.addEventListener("mouseup", (event) => {
            this.pressedMouseButtons.delete(event.button);
            this.mousePosition = [event.x, event.y];
            this.dragLast = null;
        });
    }

    onRequestAnimationFrame() {
        this.timer.newFrame();
        
        try {
            this.dragDeltaThisFrame = (this.pressedMouseButtons.size === 0 || this.dragLast === null ? null : [
                this.mousePosition[0] - this.dragLast[0],
                this.mousePosition[1] - this.dragLast[1]
            ]);
            this.dragLast = this.mousePosition;

            const dim = this.view.getDimensions();
            document.getElementById("fps")!.innerText = String(Math.round(this.timer.getFPS()));
            document.getElementById("fct")!.innerText = String(this.timer.frameCount);
            document.getElementById("res")!.innerText = `${dim[0]}×${dim[1]} ${this.dragDeltaThisFrame} ${Array.from(this.pressedMouseButtons)}`;
            document.getElementById("msg")!.innerText = `${this.debugMessage}`;

            this.level.doPhysics(this.timer.getDelta());
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
