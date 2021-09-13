import * as THREE from 'three';
import RenderPassDither from "./render_pass_dither";
import RenderPassUpscale from "./render_pass_upscale";

export default class View {
    containerElement: HTMLElement;

    camera: THREE.PerspectiveCamera;
    scene: THREE.Scene;
    ambientLight: THREE.AmbientLight;
    directionalLightMain: THREE.DirectionalLight;
    directionalLightSecondary: THREE.DirectionalLight;
    
    renderer: THREE.WebGLRenderer;
    ditherPass: RenderPassDither;
    upscalePass: RenderPassUpscale;

    

    constructor() {
        const el = document.getElementById("container");
        if (el === null) {
            throw new Error("Could not find container element in HTML.");
        }
        this.containerElement = el;


        this.camera = new THREE.PerspectiveCamera(
            30,
            window.innerWidth / window.innerHeight,
            0.1,
            200
        );
        this.camera.position.set(1, 1, 5);
        this.camera.lookAt(0, 0, 0);

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x202020);

        this.scene.fog = new THREE.Fog(0x202020, 150, 200);

        this.ambientLight = new THREE.AmbientLight(0x020306);
        this.scene.add(this.ambientLight);
        
        this.directionalLightMain = new THREE.DirectionalLight(0xfff0f0, 0.9);
        this.directionalLightMain.position.set(0.2, 1, 0.2);
        this.scene.add(this.directionalLightMain);
        
        this.directionalLightSecondary = new THREE.DirectionalLight(0x8080ff, 0.4);
        this.directionalLightSecondary.position.set(-0.7, -0.3, -0.7);
        this.scene.add(this.directionalLightSecondary);
        

        const geometry = new THREE.TorusGeometry( 1, 0.3, 16, 100 );
        const material = new THREE.MeshStandardMaterial( { color: 0xf9e0ff } );
        const torus = new THREE.Mesh(geometry, material);
        torus.rotation.set(0.5, 2.5, 0.9);
        this.scene.add(torus);

        const box = new THREE.Mesh(
            new THREE.BoxGeometry(0.7, 0.7, 0.7),
            new THREE.MeshStandardMaterial({
                color: 0xffc0e0,
                roughness: 0.0,
                metalness: 0.0
            })
        );
        box.rotation.set(-0.3, 0, -0.6);
        this.scene.add(box);
        
        this.ditherPass = new RenderPassDither();
        this.upscalePass = new RenderPassUpscale();

        this.renderer = new THREE.WebGLRenderer();
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.outputEncoding = THREE.sRGBEncoding;

        this.containerElement.appendChild(this.renderer.domElement);

        window.addEventListener("resize", (e) => this.onWindowResize(e));
    }

    onWindowResize(event: UIEvent) {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();

        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.setSize(window.innerWidth, window.innerHeight);

        this.ditherPass.onResize();
        this.upscalePass.onResize();

    }

    renderFrame() {
        this.renderer.setRenderTarget(this.ditherPass.target);
        this.renderer.render(this.scene, this.camera);

        this.renderer.setRenderTarget(this.upscalePass.target);
        this.renderer.render(this.ditherPass.scene, this.ditherPass.camera);

        // Render full screen quad with generated texture
        this.renderer.setRenderTarget(null);
        this.renderer.render(this.upscalePass.scene, this.upscalePass.camera);
    }

    getDimensions() {
        return [
            this.upscalePass.target.width,
            this.upscalePass.target.height
        ];
    }
}