import * as THREE from "three";
import { APP } from "./app";
import BUILT from "./built";
import { level_01 } from "./built/01.level";
import { NativeLevel } from "./shader_runtime";

const NORMAL_DIRECTIONS = [
    new THREE.Vector3(0.5773, -0.5773, -0.5773),
    new THREE.Vector3(-0.5773, -0.5773, 0.5773),
    new THREE.Vector3(-0.5773, 0.5773, -0.5773),
    new THREE.Vector3(0.5773, 0.5773, 0.5773)
]

export default class Level {
    cameraPosition: THREE.Vector3;
    cameraVelocity: THREE.Vector3;

    cameraYaw: number;
    cameraPitch: number;

    cameraMoveSpeed: number;
    cameraRotateSpeed: number;
    cameraAirFriction: number;
    cameraDragCoefficient: number;
    cameraRadius: number;

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
        this.cameraVelocity = new THREE.Vector3();
        this.cameraYaw = 0;
        this.cameraPitch = 0;
        this.cameraMoveSpeed = 5.0;
        this.cameraRotateSpeed = 0.003;
        this.cameraAirFriction = 1.0;
        this.cameraDragCoefficient = 0.05;
        this.cameraRadius = 0.3;
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

    getRequestedMoveDirection(): THREE.Vector3 {
        let request = new THREE.Vector3();

        let f = this.getCameraForward();
        f.setY(0);
        f.normalize();

        let r = this.getCameraRight();
        r.setY(0);
        r.normalize();

        if (APP.pressedKeys.has("w")) {
            request.addScaledVector(f, 1);
        }

        if (APP.pressedKeys.has("s")) {
            request.addScaledVector(f, -1);
        }

        if (APP.pressedKeys.has("a")) {
            request.addScaledVector(r, -1);
        }

        if (APP.pressedKeys.has("d")) {
            request.addScaledVector(r, 1);
        }

        if (APP.pressedKeys.has(" ")) {
            request.addScaledVector(new THREE.Vector3(0, 1, 0), 1);
        }

        if (request.lengthSq() <= 0.01) {
            return request;
        } else {
            return request.normalize();
        }
    }

/*
vec3 approximateNormal(vec3 pos) {
        vec2 e = vec2(0.5773, -0.5773);
        return normalize(
            e.xyy * sdf(pos + e.xyy * 0.005) +
            e.yyx * sdf(pos + e.yyx * 0.005) + 
            e.yxy * sdf(pos + e.yxy * 0.005) + 
            e.xxx * sdf(pos + e.xxx * 0.005)
        );
    }
*/
    
    approximateNormal(p: THREE.Vector3): THREE.Vector3 {
        let result = new THREE.Vector3(0, 0, 0);
        
        for (const dir of NORMAL_DIRECTIONS) {
            const pos = this.cameraPosition.clone().addScaledVector(dir, 0.005).toArray();
            const sdf = this.nativeLevel.sdf(pos);
            result.addScaledVector(dir, sdf);
        }

        return result.normalize();
    }

    doPhysics(delta: number) {
        delta = Math.min(0.1, delta);

        if (APP.pressedMouseButtons.has(0) && APP.dragDeltaThisFrame !== null) {
            let [yaw, pitch] = APP.dragDeltaThisFrame;
            this.cameraYaw += -yaw * this.cameraRotateSpeed;
            this.cameraPitch += -pitch * this.cameraRotateSpeed;

            while (this.cameraYaw < 0) this.cameraYaw += Math.PI * 2;
            while (this.cameraYaw > Math.PI * 2) this.cameraYaw -= Math.PI * 2;
            
            this.cameraPitch = Math.min(1.5, Math.max(-1.5, this.cameraPitch));
        }
        
        this.nativeLevel.iTime = APP.timer.getTotalElapsed();
        let sdf = this.nativeLevel.sdf(this.cameraPosition.toArray()) as number;
        document.getElementById("sdf")!.innerText = `${sdf}`;

        let normal = this.approximateNormal(this.cameraPosition);
        console.log(normal);

        let speed = this.cameraVelocity.length();
        let dragAcceleration = this.cameraVelocity.clone().normalize()
            .multiplyScalar(-this.cameraDragCoefficient * speed * speed - this.cameraAirFriction);
        let playerAcceleration = this.getRequestedMoveDirection()
            .multiplyScalar(this.cameraMoveSpeed);
        let normalAcceleration = normal.clone().multiplyScalar(
            sdf < this.cameraRadius ? 5.0 : 0.0);
        let gravityAcceleration = new THREE.Vector3(0, -2.5, 0);
        let totalAcceleration = dragAcceleration.clone()
            .add(playerAcceleration).add(normalAcceleration).add(gravityAcceleration);

        this.cameraVelocity.addScaledVector(totalAcceleration, delta);
        // if (playerAcceleration.length() < 0.05 && this.cameraVelocity.length() < 0.02) {
        //     this.cameraVelocity.set(0, 0, 0);
        // }
        this.cameraPosition.addScaledVector(this.cameraVelocity, delta);
    }

}