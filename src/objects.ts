import * as THREE from "three";

let GAMEOBJECTNEXTID = 100;

export class GameObject {
    id: string;
    position: THREE.Vector3;
    positionUniform: string | null;
    orientation: THREE.Quaternion;
    mesh: THREE.Mesh | null;
    
    constructor(id: string | undefined) {
        this.id = id || ("obj" + (GAMEOBJECTNEXTID++));
        this.position = new THREE.Vector3(0, 0, 0);
        this.positionUniform = null;
        this.orientation = new THREE.Quaternion();
        this.mesh = this.createMesh(); // in base class, this returns null
        if (this.mesh !== null) {
            this.mesh.matrixAutoUpdate = false
        }
    }

    createMesh(): THREE.Mesh | null {
        return null;
    }

    insertIntoScene(scene: THREE.Scene) {
        if (this.mesh !== null) {
            scene.add(this.mesh);
        }
    }

    updateMesh() {
        if (this.mesh !== null) {
            this.mesh.position.copy(this.position);
            this.mesh.quaternion.copy(this.orientation);
            this.mesh.updateMatrix();
        }
    }

    dispose() {
        if (this.mesh !== null) {
            this.mesh.removeFromParent();
            this.mesh.geometry.dispose();
            if (this.mesh.material instanceof THREE.Material) {
                this.mesh.material.dispose();
            } else {
                for (let m of this.mesh.material) {
                    m.dispose();
                }
            }
            this.mesh = null;
        }
    }
}

const TARGET_TRIGGERED_MATERIAL = new THREE.MeshStandardMaterial({
    color: 0x90ff90
});

const TARGET_DEFAULT_MATERIAL = new THREE.MeshStandardMaterial({
    color: 0xc050ff
});

export class TargetPickup extends GameObject {
    triggered: boolean;

    constructor(id: string | undefined) {
        super(id);
        this.triggered = false;
    }

    createMesh(): THREE.Mesh | null {
        let geometry = new THREE.SphereGeometry(0.5, 32, 32);
        let material = TARGET_DEFAULT_MATERIAL;
        return new THREE.Mesh(geometry, material);
    }

    updateMesh() {
        super.updateMesh();

        if (this.mesh !== null) {
            let desiredMaterial = this.triggered ?
                TARGET_TRIGGERED_MATERIAL : TARGET_DEFAULT_MATERIAL;
            
            if (desiredMaterial !== this.mesh.material) {
                this.mesh.material = desiredMaterial;
            }
        }
    }
}

export class InertObject extends GameObject {
    object: THREE.Object3D;

    constructor(id: string | undefined, object: THREE.Object3D) {
        super(id);
        this.object = object;
    }

    insertIntoScene(scene: THREE.Scene) {
        scene.add(this.object);
    }
}