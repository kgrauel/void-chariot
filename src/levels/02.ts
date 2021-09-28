import Level from "../level";
import * as THREE from "three";

export const TS = {
    initializeLevel: (level: Level) => {
        level.cameraPosition.set(0, 0.18, 3.6);
        level.addTargetPickup(new THREE.Vector3(-3.6306291090167457, 0.3586341454287394, -4.007311642508411));
        level.addTargetPickup(new THREE.Vector3(11.848812542004401, 8.856676032977438, -1.9893370473799268));
        level.addTargetPickup(new THREE.Vector3(-3.8096487803300825, 34.14161514075631, 4.5470323698817126));
        level.addTargetPickup(new THREE.Vector3(-3.4700115654458745, 3.6076973580068237, -8.576432285094793));

        level.addInert("ambient", new THREE.AmbientLight(0xc0e0ff, 0.2));
        level.addInert("sun", new THREE.DirectionalLight(0xf0f0f0, 0.6));
    }
};

