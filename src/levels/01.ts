import Level from "../level";
import * as THREE from "three";

export const TS = {
    initializeLevel: (level: Level) => {
        level.cameraPosition.set(0, 3, 25);

        // level.addTargetPickup(new THREE.Vector3(0, 2.4, 10));
        // level.addTargetPickup(new THREE.Vector3(0, 17, -9));
        // level.addTargetPickup(new THREE.Vector3(-4.137134936157376, 7.071059255655852, -5.047986078149812));
        // //level.addTargetPickup(new THREE.Vector3(4.962277163519788, 4.852752652657128, -11.600460329341686));
        // level.addTargetPickup(new THREE.Vector3(2.6596977112368867, 6.033209681691958, -12.670271698897741));
        // level.addTargetPickup(new THREE.Vector3(0, -1, -21));
        level.addTargetPickup(new THREE.Vector3(0.17099940589065293, -2.4000582730251705, 4.757077543746169));
        level.addTargetPickup(new THREE.Vector3(0.8353225963758857, -38.19874482054322, 49.35127953957216));
        level.addTargetPickup(new THREE.Vector3(-3.2902798900201344, 22.668199820275188, -17.43685075714242));
        
        level.addInert("ambient", new THREE.AmbientLight(0xc0e0ff, 0.2));
        level.addInert("sun", new THREE.DirectionalLight(0xf0f0f0, 0.6));
    }
};

