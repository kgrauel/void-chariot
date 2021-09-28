import * as THREE from "three";
import { APP } from "./app";
import BUILT from "./built";
import { GameObject, TargetPickup } from "./objects";


const NORMAL_DIRECTIONS = [
    new THREE.Vector3(0.5773, -0.5773, -0.5773),
    new THREE.Vector3(-0.5773, -0.5773, 0.5773),
    new THREE.Vector3(-0.5773, 0.5773, -0.5773),
    new THREE.Vector3(0.5773, 0.5773, 0.5773)
]

const STATE_COUNTDOWN = 0;
const STATE_RACING = 1;
const STATE_FINISHED = 2;



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
    level_TS: any;

    gameObjects: Map<string, GameObject>;
    targetPickups: string[];

    gameState: number;
    raceTimer: number;



    constructor(levelName: string) {
        this.levelName = levelName;

        let nativeLevel = BUILT.natives.get(this.levelName);
        if (nativeLevel === undefined) {
            throw `could not find native for level ${this.levelName}`;
        }
        this.nativeLevel = nativeLevel;

        let level_TS = BUILT.level_TS.get(this.levelName);
        if (level_TS === undefined) {
            throw `could not find level TS for level ${this.levelName}`;
        }
        this.level_TS = level_TS;

        this.cameraPosition = new THREE.Vector3(0, 1, 0);
        this.cameraVelocity = new THREE.Vector3();
        this.cameraOrientation = new THREE.Quaternion();
        this.cameraMoveSpeed = 7.0;
        this.cameraRotateSpeed = 0.004;
        this.cameraAirFriction = 0.4;
        this.cameraDragCoefficient = 0.03;
        this.cameraRadius = 0.4;
        this.cameraDisablePitchCorrectionTime = 0.0;

        this.gameObjects = new Map();
        this.targetPickups = [];

        this.level_TS.initializeLevel(this);
        this.gameState = STATE_COUNTDOWN;
        this.raceTimer = 4.0;
    }

    reset() {
        this.cameraPosition = new THREE.Vector3(0, 1, 0);
        this.cameraVelocity = new THREE.Vector3();
        this.cameraOrientation = new THREE.Quaternion();

        for (let [key, go] of this.gameObjects) {
            go.dispose();
        }

        this.gameObjects = new Map();
        this.targetPickups = [];

        this.level_TS.initializeLevel(this);
    }

    addTargetPickup(position: THREE.Vector3) {
        let tp = new TargetPickup(`tp_${this.targetPickups.length}`);
        tp.position = position;
        this.targetPickups.push(tp.id);
        this.gameObjects.set(tp.id, tp);
    }

    insertObjectsIntoScene(scene: THREE.Scene) {
        for (let [name, gameObject] of this.gameObjects) {
            gameObject.insertIntoScene(scene);
        }
    }

    updateObjects() {
        for (let [name, gameObject] of this.gameObjects) {
            gameObject.updateMesh();
        }        
    }

    disposeObjects() {
        for (let [name, gameObject] of this.gameObjects) {
            gameObject.dispose();
        }
        this.gameObjects.clear();
    }

    benchmarkSDF() {
        let start = Date.now();
        let total = 0;
        for (let i = 0; i < 1000000; i++) {
            total += this.nativeLevel.sdf([Math.random(), Math.random(), Math.random()]);
        }
        let elapsed = Date.now() - start;
        console.log(`total ${total}, elapsed ${elapsed}`)
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

        // if (APP.pressedKeys.has(" ")) {
        //     request.addScaledVector(this.getCameraUp(), 1);
        // }

        if (request.lengthSq() <= 0.01) {
            return request;
        } else {
            return request.normalize();
        }
    }
    
    approximateNormal(p: THREE.Vector3): THREE.Vector3 {
        let result = new THREE.Vector3(0, 0, 0);
        
        for (const dir of NORMAL_DIRECTIONS) {
            const pos = this.cameraPosition.clone().addScaledVector(dir, 0.005).toArray();
            const sdf = this.nativeLevel.sdf(pos);
            result.addScaledVector(dir, sdf);
        }

        return result.normalize();
    }

    rotateCamera(sdf: number, normal: THREE.Vector3, yaw: number, pitch: number) {
        let qy = new THREE.Quaternion();
        let up = this.getCameraUp();

        let yawAxis = (sdf < 3.0 ? normal : (sdf > 5.0 ? up : (
            normal.clone().multiplyScalar((5.0 - sdf) / 2).addScaledVector(up, (sdf - 3.0) / 2)
        )));
        qy.setFromAxisAngle(yawAxis, yaw);

        let qp = new THREE.Quaternion();
        qp.setFromAxisAngle(this.getCameraRight(), pitch);

        this.cameraOrientation.premultiply(qy);
        this.cameraOrientation.premultiply(qp);

        
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

            this.rotateCamera(sdf, normal, ay, ap);

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
            if (this.gameState === STATE_COUNTDOWN) {
                this.raceTimer -= timePerStep;
                this.nativeLevel.iTime = -this.raceTimer;
                if (this.raceTimer < 0) {
                    this.raceTimer *= -1;
                    this.gameState = STATE_RACING;
                }
            } else if (this.gameState === STATE_RACING) {
                this.raceTimer += timePerStep;
                this.nativeLevel.iTime = this.raceTimer;
                let finished = true;
                for (let target of this.targetPickups) {
                    if (!(this.gameObjects.get(target) as TargetPickup).triggered) {
                        finished = false;
                        break;
                    }
                }
                if (finished) {
                    this.gameState = STATE_FINISHED;
                }
            } else {
                this.nativeLevel.iTime = this.raceTimer;
                break;
            }

            
            sdf = this.nativeLevel.sdf(this.cameraPosition.toArray()) as number;
            
            let normal = this.approximateNormal(this.cameraPosition);
            //console.log(normal);
            
            let speed = this.cameraVelocity.length();
            let dragAcceleration = this.cameraVelocity.clone().normalize()
                .multiplyScalar(-this.cameraDragCoefficient * speed * speed - this.cameraAirFriction);
            let playerAcceleration = this.getRequestedMoveDirection()
                .multiplyScalar(this.cameraMoveSpeed)
                .multiplyScalar(this.gameState === STATE_RACING ? 1.0 : 0.0);
            let normalAccelMagnitude = sdf < this.cameraRadius ? 20.0 : 0.0;
            let velocityAlongNormal = this.cameraVelocity.clone().dot(normal);
            
            if (sdf > 0 && sdf < this.cameraRadius * 1.1) {
                //normalAccelMagnitude += 10 * velocityAlongNormal * velocityAlongNormal;
                let flattened = this.cameraVelocity.clone().projectOnPlane(normal);
                this.cameraVelocity.multiplyScalar(0.9);
                this.cameraVelocity.add(flattened.multiplyScalar(0.1));
            }
            let normalAcceleration = normal.clone().multiplyScalar(normalAccelMagnitude);
            if (sdf < this.cameraRadius * 0.9) {
                dragAcceleration.multiplyScalar(2.0);
            }
            //let gravityAcceleration = new THREE.Vector3(0, -5.0, 0);
            let gravityAcceleration = normal.clone().normalize()
                .multiplyScalar(-320.0 / (40.0 + Math.abs(sdf)));
            let totalAcceleration = dragAcceleration.clone()
                .add(playerAcceleration).add(normalAcceleration).add(gravityAcceleration);
            
            this.cameraVelocity.addScaledVector(totalAcceleration, timePerStep);
            // if (playerAcceleration.length() < 0.05 && this.cameraVelocity.length() < 0.02) {
            //     this.cameraVelocity.set(0, 0, 0);
            // }
            this.cameraPosition.addScaledVector(this.cameraVelocity, timePerStep);

            this.triggerNearbyTargets();
        }

        this.updateObjects();

        let timerMessage = "";
        if (this.gameState === STATE_COUNTDOWN) {
            if (this.raceTimer > 3.0) {
                timerMessage = "Get ready!";
            } else {
                timerMessage = `${Math.ceil(this.raceTimer)}`;
            }
        } else {
            timerMessage = `${this.raceTimer.toFixed(2)}`;
        }

        document.getElementById("sdf")!.innerText = `${sdf}`;
        document.getElementById("timer")!.innerText = timerMessage;
    }

    triggerNearbyTargets() {
        for (const targetName of this.targetPickups) {
            const target = this.gameObjects.get(targetName) as TargetPickup;
            if (target === undefined) {
                throw `Could not find target with name ${targetName}`;
            }
            let distance = target.position.distanceTo(this.cameraPosition);
            if (distance < 1.0 && !target.triggered) {
                target.triggered = true;
            }
        }
    }

}