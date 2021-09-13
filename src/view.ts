import * as THREE from 'three';
import RenderGraph from './render_graph';

export default class View {
    containerElement: HTMLElement;
    
    renderGraph: RenderGraph;
    

    constructor() {
        const el = document.getElementById("container");
        if (el === null) {
            throw new Error("Could not find container element in HTML.");
        }
        this.containerElement = el;


        this.renderGraph = new RenderGraph();
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