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

    cameraOrientation: THREE.Quaternion;

    cameraMoveSpeed: number;
    cameraRotateSpeed: number;
    cameraAirFriction: number;
    cameraDragCoefficient: number;
    cameraRadius: number;
    cameraDisablePitchCorrectionTime: number;


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
        // for (let i = 0; i < 1000000; i++) {
        //     total += this.nativeLevel.sdf([Math.random(), Math.random(), Math.random()]);
        // }
        // let elapsed = Date.now() - start;
        // console.log(`total ${total}, elapsed ${elapsed}`)

        this.cameraPosition = new THREE.Vector3(0, 1, 0);
        this.cameraVelocity = new THREE.Vector3();
        this.cameraOrientation = new THREE.Quaternion();
        this.cameraMoveSpeed = 6.0;
        this.cameraRotateSpeed = 0.003;
        this.cameraAirFriction = 0.7;
        this.cameraDragCoefficient = 0.10;
        this.cameraRadius = 0.4;
        this.cameraDisablePitchCorrectionTime = 0.0;

    }

    getCameraForward(): THREE.Vector3 {
        let forward = new THREE.Vector3(0, 0, -1);
        forward.applyQuaternion(this.cameraOrientation);
        return forward;
    }

    getCameraRight(): THREE.Vector3 {
        let right = new THREE.Vector3(1, 0, 0);
        right.applyQuaternion(this.cameraOrientation);
        return right;
    }

    getCameraUp(): THREE.Vector3 {
        let up = new THREE.Vector3(0, 1, 0);
        up.applyQuaternion(this.cameraOrientation);
        return up;
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
            request.addScaledVector(this.getCameraForward(), 1);
        }

        if (APP.pressedKeys.has("s")) {
            request.addScaledVector(this.getCameraForward(), -1);
        }

        if (APP.pressedKeys.has("a")) {
            request.addScaledVector(this.getCameraRight(), -1);
        }

        if (APP.pressedKeys.has("d")) {
            request.addScaledVector(this.getCameraRight(), 1);
        }

        if (APP.pressedKeys.has(" ")) {
            request.addScaledVector(this.getCameraUp(), 1);
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

        let steps = Math.floor(delta / 0.01) + 1;
        let timePerStep = delta / steps;
        let sdf = this.nativeLevel.sdf(this.cameraPosition.toArray()) as number;
        let normal = this.approximateNormal(this.cameraPosition);

        if (APP.pressedMouseButtons.has(0) && APP.dragDeltaThisFrame !== null) {
            let [yaw, pitch] = APP.dragDeltaThisFrame;
            let ay = -yaw * this.cameraRotateSpeed;
            let ap = -pitch * this.cameraRotateSpeed;

            let qy = new THREE.Quaternion();
            let up = this.getCameraUp();

            let yawAxis = (sdf < 3.0 ? normal : (sdf > 5.0 ? up : (
                normal.clone().multiplyScalar((5.0 - sdf) / 2).addScaledVector(up, (sdf - 3.0) / 2)
            )));
            qy.setFromAxisAngle(yawAxis, ay);

            let qp = new THREE.Quaternion();
            qp.setFromAxisAngle(this.getCameraRight(), ap);

            this.cameraOrientation.premultiply(qy);
            this.cameraOrientation.premultiply(qp);

            this.cameraDisablePitchCorrectionTime = 1.0;
        } else {
            this.cameraDisablePitchCorrectionTime = Math.max(
                0, this.cameraDisablePitchCorrectionTime - delta);
        }
    



        let desiredUp = normal.clone().multiplyScalar(-1);
        let currentUp = this.getCameraUp();

        let axis = desiredUp.clone().cross(currentUp);
        let quat = new THREE.Quaternion();

        let pitchCorrectionFactor = Math.max(0, 1.0 - this.cameraDisablePitchCorrectionTime);
        quat.setFromAxisAngle(axis,
            pitchCorrectionFactor * Math.max(0, 4 - sdf) * timePerStep);

        this.cameraOrientation.premultiply(quat);
        this.cameraOrientation.normalize();

        desiredUp.projectOnPlane(normal.clone().cross(this.getCameraRight())).normalize();
        currentUp.projectOnPlane(normal.clone().cross(this.getCameraRight())).normalize();

        axis = desiredUp.clone().cross(currentUp);
        quat = new THREE.Quaternion();
        quat.setFromAxisAngle(axis, Math.max(0, 4 - sdf) * timePerStep);

        this.cameraOrientation.premultiply(quat);
        this.cameraOrientation.normalize();



        for (let step = 0; step < steps; step++) {
            this.nativeLevel.iTime = APP.timer.getTotalElapsed() + step * timePerStep;
            sdf = this.nativeLevel.sdf(this.cameraPosition.toArray()) as number;
            
            let normal = this.approximateNormal(this.cameraPosition);
            //console.log(normal);
            
            let speed = this.cameraVelocity.length();
            let dragAcceleration = this.cameraVelocity.clone().normalize()
                .multiplyScalar(-this.cameraDragCoefficient * speed * speed - this.cameraAirFriction);
            let playerAcceleration = this.getRequestedMoveDirection()
                .multiplyScalar(this.cameraMoveSpeed);
            let normalAcceleration = normal.clone().multiplyScalar(
                sdf < this.cameraRadius ? 20.0 : 0.0);
            if (sdf > 0 && sdf < this.cameraRadius) {
                dragAcceleration.multiplyScalar(5.0);
            }
            //let gravityAcceleration = new THREE.Vector3(0, -5.0, 0);
            let gravityAcceleration = normal.clone().normalize()
                .multiplyScalar(-25.0 / (5.0 + Math.abs(sdf)));
            let totalAcceleration = dragAcceleration.clone()
                .add(playerAcceleration).add(normalAcceleration).add(gravityAcceleration);
            
            this.cameraVelocity.addScaledVector(totalAcceleration, timePerStep);
            // if (playerAcceleration.length() < 0.05 && this.cameraVelocity.length() < 0.02) {
            //     this.cameraVelocity.set(0, 0, 0);
            // }
            this.cameraPosition.addScaledVector(this.cameraVelocity, timePerStep);
        }

        document.getElementById("sdf")!.innerText = `${sdf}`;
    }

}