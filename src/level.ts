import * as THREE from "three";
import { APP } from "./app";
import BUILT from "./built";
import { NativeLevel } from "./shader_runtime";

export default class Level {
    cameraPosition: THREE.Vector3;
    cameraYaw: number;
    cameraPitch: number;
    cameraMoveSpeed: number;
    cameraRotateSpeed: number;

    levelName: string;
    nativeLevel: any;

    constructor(levelName: string) {
        this.levelName = levelName;

        let nativeLevel = BUILT.natives.get(this.levelName);
        if (nativeLevel === undefined) {
            throw `could not find native for level ${this.levelName}`;
        }
        this.nativeLevel = nativeLevel;

        let start = Date.now();
        let total = 0;
        for (let i = 0; i < 1000000; i++) {
            total += this.nativeLevel.sdf([Math.random(), Math.random(), Math.random()]);
        }
        let elapsed = Date.now() - start;
        console.log(`total ${total}, elapsed ${elapsed}`)

        this.cameraPosition = new THREE.Vector3(0, 1, 2);
        this.cameraYaw = 0;
        this.cameraPitch = 0;
        this.cameraMoveSpeed = 2.0;
        this.cameraRotateSpeed = 0.003;
    }

    getCameraForward(): THREE.Vector3 {
        let forward = new THREE.Vector3(0, 0, -1);
        forward.applyEuler(new THREE.Euler(
            this.cameraPitch, this.cameraYaw, 0.0, "YXZ"
        ));
        return forward;
    }

    getCameraRight(): THREE.Vector3 {
        return this.getCameraForward().clone().cross(new THREE.Vector3(0, 1, 0));
    }

    doPhysics(delta: number) {
        this.nativeLevel.iTime = APP.timer.getTotalElapsed();
        document.getElementById("sdf")!.innerText = `${this.nativeLevel.sdf(this.cameraPosition.toArray())}`;

        if (APP.pressedKeys.has("w")) {
            this.cameraPosition.addScaledVector(this.getCameraForward(), delta * this.cameraMoveSpeed);
        }

        if (APP.pressedKeys.has("s")) {
            this.cameraPosition.addScaledVector(this.getCameraForward(), -delta * this.cameraMoveSpeed);
        }

        if (APP.pressedKeys.has("a")) {
            this.cameraPosition.addScaledVector(this.getCameraRight(), -delta * this.cameraMoveSpeed);
        }

        if (APP.pressedKeys.has("d")) {
            this.cameraPosition.addScaledVector(this.getCameraRight(), delta * this.cameraMoveSpeed);
        }

        if (APP.pressedKeys.has("e")) {
            this.cameraPosition.addScaledVector(new THREE.Vector3(0, 1, 0), delta * this.cameraMoveSpeed);
        }

        if (APP.pressedKeys.has("e")) {
            this.cameraPosition.addScaledVector(new THREE.Vector3(0, 1, 0), -delta * this.cameraMoveSpeed);
        }

        if (APP.pressedMouseButtons.has(0) && APP.dragDeltaThisFrame !== null) {
            let [yaw, pitch] = APP.dragDeltaThisFrame;
            this.cameraYaw += -yaw * this.cameraRotateSpeed;
            this.cameraPitch += -pitch * this.cameraRotateSpeed;

            while (this.cameraYaw < 0) this.cameraYaw += Math.PI * 2;
            while (this.cameraYaw > Math.PI * 2) this.cameraYaw -= Math.PI * 2;
            
            this.cameraPitch = Math.min(1.5, Math.max(-1.5, this.cameraPitch));
        }
    }

}