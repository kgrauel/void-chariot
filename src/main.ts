import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { GlitchPass } from 'three/examples/jsm/postprocessing/GlitchPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

class View {
    containerElement: HTMLElement;

    camera: THREE.PerspectiveCamera;
    scene: THREE.Scene;
    ambientLight: THREE.AmbientLight;
    directionalLightMain: THREE.DirectionalLight;
    directionalLightSecondary: THREE.DirectionalLight;
    
    renderer: THREE.WebGLRenderer;
    renderTarget: THREE.WebGLRenderTarget;
    upscaleScene: THREE.Scene;
    upscaleCamera: THREE.OrthographicCamera;
    upscaleMaterial: THREE.ShaderMaterial;
    upscaleGeometry: THREE.PlaneGeometry;
    upscaleMesh: THREE.Mesh;

    ditherMaterial: THREE.ShaderMaterial;

    constructor() {
        const el = document.getElementById("container");
        if (el === null) {
            throw new Error("Could not find container element in HTML.");
        }
        this.containerElement = el;

        this.camera = new THREE.PerspectiveCamera(
            40,
            window.innerWidth / window.innerHeight,
            0.1,
            200
        );
        this.camera.position.set(1, 1, 5);
        this.camera.lookAt(0, 0, 0);

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x202020);
        this.scene.fog = new THREE.Fog(0x202020, 150, 200);

        this.ambientLight = new THREE.AmbientLight(0x020308);
        this.scene.add(this.ambientLight);
        
        this.directionalLightMain = new THREE.DirectionalLight(0xfffff8, 0.8);
        this.directionalLightMain.position.set(0.3, 1, 0.3);
        this.scene.add(this.directionalLightMain);
        
        this.directionalLightSecondary = new THREE.DirectionalLight(0xf0f8ff, 0.4);
        this.directionalLightSecondary.position.set(-0.4, 0.2, -0.6);
        this.scene.add(this.directionalLightSecondary);
        

        const geometry = new THREE.TorusGeometry( 1, 0.3, 16, 100 );
        const material = new THREE.MeshStandardMaterial( { color: 0xffffff } );
        const torus = new THREE.Mesh(geometry, material);
        torus.rotation.set(0.5, 2.5, 0.9);
        this.scene.add(torus);
        


        this.renderTarget = new THREE.WebGLRenderTarget(
            window.innerWidth / 4,
            window.innerHeight / 4,
            {
                minFilter: THREE.LinearFilter,
                magFilter: THREE.NearestFilter,
                format: THREE.RGBFormat
            }
        );

        this.upscaleCamera = new THREE.OrthographicCamera(
            window.innerWidth / -2,
            window.innerWidth / 2,
            window.innerHeight / 2,
            window.innerHeight / -2,
            -10000,
            10000
        );
        this.upscaleCamera.position.z = 1;

        this.upscaleMaterial = new THREE.ShaderMaterial({
            uniforms: {
                tDiffuse: {
                    value: this.renderTarget.texture
                }
            },
            vertexShader: `
                varying vec2 vUv;

                void main() {
                    vUv = uv;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
                }
            `,
            fragmentShader: `
                varying vec2 vUv;
                uniform sampler2D tDiffuse;

                void main() {
                    vec3 base = texture2D(tDiffuse, vUv).rgb;
                    gl_FragColor = vec4(base, 1.0);
                }
            `,
            depthWrite: false
        });

        this.upscaleGeometry = new THREE.PlaneGeometry(
            window.innerWidth,
            window.innerHeight
        );

        this.upscaleMesh = new THREE.Mesh(this.upscaleGeometry, this.upscaleMaterial);
        this.upscaleMesh.position.z = -100;

        this.upscaleScene = new THREE.Scene();
        this.upscaleScene.add(this.upscaleMesh);



        this.renderer = new THREE.WebGLRenderer();
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.outputEncoding = THREE.sRGBEncoding;
        this.renderer.autoClear = true;

        


        this.containerElement.appendChild(this.renderer.domElement);

        window.addEventListener("resize", (e) => this.onWindowResize(e));
    }

    onWindowResize(event: UIEvent) {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();

        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.setSize(window.innerWidth, window.innerHeight);

        this.renderTarget.setSize(
            window.innerWidth / 4,
            window.innerHeight / 4
        );

        this.upscaleCamera.left = window.innerWidth / -2;
        this.upscaleCamera.right = window.innerWidth / 2;
        this.upscaleCamera.top = window.innerHeight / 2;
        this.upscaleCamera.bottom = window.innerHeight / -2;
        this.upscaleCamera.updateProjectionMatrix();

        this.upscaleScene.clear();
        this.upscaleGeometry.dispose();
        this.upscaleGeometry = new THREE.PlaneGeometry(
            window.innerWidth,
            window.innerHeight
        );
        this.upscaleMesh = new THREE.Mesh(this.upscaleGeometry, this.upscaleMaterial);
        this.upscaleMesh.position.z = -100;
        this.upscaleScene.add(this.upscaleMesh);

    }

    renderFrame() {
        this.renderer.setRenderTarget(this.renderTarget);
        this.renderer.render(this.scene, this.camera);

        // Render full screen quad with generated texture
        this.renderer.setRenderTarget(null);
        this.renderer.render(this.upscaleScene, this.upscaleCamera);
    }
}

class Timer {
    startTime!: number;
    thisFrameStart!: number;
    thisFrameDelta!: number;
    frameTimeMovingAverage!: number;
    frameCount!: number;

    constructor() {
        this.reset();
    }

    reset() {
        this.startTime = performance.now() / 1000;
        this.thisFrameStart = this.startTime;
        this.frameTimeMovingAverage = 0.0166;
        this.thisFrameDelta = 0.0166;
        this.frameCount = 0;
    }

    newFrame() {
        const now = performance.now() / 1000;
        this.thisFrameDelta = now - this.thisFrameStart;
        this.thisFrameStart = now;
        this.frameTimeMovingAverage = (
            0.97 * this.frameTimeMovingAverage +
            0.03 * this.thisFrameDelta
        );
        this.frameCount += 1;

    }

    getDelta(): number {
        return this.thisFrameDelta;
    }

    getTotalElapsed(): number {
        return this.thisFrameStart - this.startTime;
    }

    getFPS(): number {
        return 1.0 / this.frameTimeMovingAverage;
    }
}

class App {
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

const APP = new App();
