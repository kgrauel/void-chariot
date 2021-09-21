import * as THREE from 'three';
import RenderGraph from './render_graph';

export default class View {
    containerElement: HTMLElement;
    
    renderGraph: RenderGraph;
    
    levelName: string;
    rendererName: string;


    constructor(levelName: string, rendererName: string) {
        const el = document.getElementById("container");
        if (el === null) {
            throw new Error("Could not find container element in HTML.");
        }
        this.containerElement = el;

        this.levelName = levelName;
        this.rendererName = rendererName;

        this.renderGraph = new RenderGraph(this.levelName, this.rendererName);
        this.containerElement.appendChild(this.renderGraph.getDOMElement());

        window.addEventListener("resize", (e) => this.onWindowResize(e));
    }

    onWindowResize(event: UIEvent) {
        this.renderGraph.updateDimensions();
    }

    renderFrame() {
        this.renderGraph.render();
    }

    getDimensions(): number[] {
        return this.renderGraph.lrSize;
    }
    
}