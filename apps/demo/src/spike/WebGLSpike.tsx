import {
  Suspense,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  Canvas,
  type ThreeEvent,
  useFrame,
  useThree,
} from '@react-three/fiber';

import {
  ContactShadows,
  Html,
  useGLTF,
} from '@react-three/drei';

import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

import './webgl-spike.css';

const MODEL_URL =
  `${import.meta.env.BASE_URL}webgl/change-proof-static-spike.glb`;

const CAMERA_IDLE = 'K01 • master idle';
const CAMERA_SHIPPING = 'K02 • Shipping selected';
const CAMERA_CUTAWAY = 'K03 • Shipping cutaway';
const CAMERA_HEAD = 'K04 • micro HEAD';

type AuthoredCameraPose = {
  position: [number, number, number];
  forward: [number, number, number];
  up: [number, number, number];
  fov: number;
};

const AUTHORED_CAMERA_POSES: Record<
  string,
  AuthoredCameraPose
> = {
  [CAMERA_IDLE]: {
    position: [10.0, 13.0, 31.0],
    forward: [-0.303341, -0.215372, -0.928224],
    up: [-0.066901, 0.976532, -0.204718],
    fov: 28.841546,
  },

  [CAMERA_SHIPPING]: {
    position: [14.8, 12.6, 30.5],
    forward: [-0.434803, -0.198305, -0.87842],
    up: [-0.087971, 0.98014, -0.177725],
    fov: 28.072487,
  },

  [CAMERA_CUTAWAY]: {
    position: [11.0, 12.5, 28.799999],
    forward: [-0.360632, -0.226215, -0.90486],
    up: [-0.083752, 0.974077, -0.21014],
    fov: 29.652962,
  },

  [CAMERA_HEAD]: {
    position: [5.3, 11.0, 24.1],
    forward: [-0.266149, -0.25711, -0.92901],
    up: [-0.07081, 0.966382, -0.247167],
    fov: 34.482917,
  },
};

function belongsTo(
  object: THREE.Object3D,
  parent: THREE.Object3D | null,
) {
  if (!parent) return false;

  let current: THREE.Object3D | null = object;

  while (current) {
    if (current === parent) return true;
    current = current.parent;
  }

  return false;
}

function StudioEnvironment() {
  const { gl, scene } = useThree();

  useEffect(() => {
    const generator =
      new THREE.PMREMGenerator(gl);

    const room =
      new RoomEnvironment();

    const target =
      generator.fromScene(room, 0.04);

    scene.environment = target.texture;
    scene.environmentIntensity = 0.9;

    return () => {
      if (scene.environment === target.texture) {
        scene.environment = null;
      }

      target.dispose();
      generator.dispose();
    };
  }, [gl, scene]);

  return null;
}

function Machine({
  cameraName,
  onShippingClick,
}: {
  cameraName: string;
  onShippingClick: () => void;
}) {
  const gltf = useGLTF(MODEL_URL);
  const scene = gltf.scene;

  const { camera } = useThree();

  const targetPosition = useRef(new THREE.Vector3());
  const targetQuaternion = useRef(new THREE.Quaternion());
  const targetFov = useRef(50);

  const initialized = useRef(false);

  const [shippingHover, setShippingHover] = useState(false);

  const shipping = useMemo(
    () => scene.getObjectByName('SHIPPING') ?? null,
    [scene],
  );

  const shippingCenter = useMemo(() => {
    if (!shipping) return null;

    scene.updateWorldMatrix(true, true);

    const box = new THREE.Box3().setFromObject(shipping);

    if (box.isEmpty()) return null;

    return box.getCenter(new THREE.Vector3());
  }, [scene, shipping]);

  useLayoutEffect(() => {
    const cyclorama =
      scene.getObjectByName('Seamless cyclorama');

    if (cyclorama) {
      cyclorama.visible = false;
    }

    const tuned =
      new Set<THREE.Material>();

    function tuneMaterial(
      material: THREE.Material,
    ) {
      if (tuned.has(material)) return;
      tuned.add(material);

      if (
        !(
          material instanceof
          THREE.MeshStandardMaterial
        )
      ) {
        return;
      }

      const name =
        material.name.toLowerCase();

      material.envMapIntensity = 1.15;

      if (
        name.includes('warm ceramic') ||
        name.includes('stateful ceramic')
      ) {
        material.metalness = 0.0;
        material.roughness = 0.34;
        material.envMapIntensity = 1.0;
      }

      if (
        name.includes('porcelain enamel')
      ) {
        material.metalness = 0.03;
        material.roughness = 0.22;
        material.envMapIntensity = 1.2;
      }

      if (
        name.includes('graphite anodized')
      ) {
        material.metalness = 0.72;
        material.roughness = 0.28;
        material.envMapIntensity = 1.35;
      }

      if (
        name.includes('brushed titanium')
      ) {
        material.metalness = 0.9;
        material.roughness = 0.3;
        material.envMapIntensity = 1.45;
      }

      if (
        name.includes('cobalt active enamel')
      ) {
        material.metalness = 0.08;
        material.roughness = 0.2;
        material.envMapIntensity = 1.2;
      }

      if (
        name.includes('recessed slate')
      ) {
        material.metalness = 0.18;
        material.roughness = 0.48;
        material.envMapIntensity = 1.0;
      }

      if (
        name.includes('charcoal lettering')
      ) {
        material.metalness = 0.0;
        material.roughness = 0.52;
      }

      if (
        name.includes('product display')
      ) {
        material.metalness = 0.0;
        material.roughness = 0.16;
        material.envMapIntensity = 1.2;
      }

      if (
        name.includes('selected head continuity')
      ) {
        material.metalness = 0.04;
        material.roughness = 0.22;
        material.envMapIntensity = 1.15;
      }

      material.needsUpdate = true;
    }

    scene.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) {
        return;
      }

      object.castShadow = true;
      object.receiveShadow = true;

      const materials =
        Array.isArray(object.material)
          ? object.material
          : [object.material];

      for (const material of materials) {
        tuneMaterial(material);
      }
    });

    console.log(
      '[CP_LOOKDEV_MATERIALS]',
      Array.from(tuned).map(
        (material) => material.name,
      ),
    );
  }, [scene]);

  useEffect(() => {
    const pose =
      AUTHORED_CAMERA_POSES[cameraName];

    if (!pose) {
      console.warn(
        '[Change Proof] authored camera pose missing:',
        cameraName,
      );

      return;
    }

    const position =
      new THREE.Vector3(...pose.position);

    const forward =
      new THREE.Vector3(...pose.forward)
        .normalize();

    const up =
      new THREE.Vector3(...pose.up)
        .normalize();

    const target =
      position.clone().add(forward);

    const rotationMatrix =
      new THREE.Matrix4().lookAt(
        position,
        target,
        up,
      );

    const quaternion =
      new THREE.Quaternion()
        .setFromRotationMatrix(
          rotationMatrix,
        );

    targetPosition.current.copy(position);
    targetQuaternion.current.copy(quaternion);
    targetFov.current = pose.fov;

    console.log(
      '[CP_CAMERA_RIG]',
      {
        cameraName,
        position: pose.position,
        forward: pose.forward,
        up: pose.up,
        fov: pose.fov,
        viewportAspect:
          camera instanceof THREE.PerspectiveCamera
            ? camera.aspect
            : null,
      },
    );

    if (!initialized.current) {
      camera.position.copy(position);
      camera.quaternion.copy(quaternion);

      if (
        camera instanceof
        THREE.PerspectiveCamera
      ) {
        camera.fov = pose.fov;
        camera.updateProjectionMatrix();
      }

      initialized.current = true;
    }
  }, [cameraName, camera]);

  useEffect(() => {
    document.body.style.cursor =
      shippingHover ? 'pointer' : '';

    return () => {
      document.body.style.cursor = '';
    };
  }, [shippingHover]);

  useFrame((_, delta) => {
    if (!initialized.current) return;

    const alpha = 1 - Math.exp(-delta * 5);

    camera.position.lerp(
      targetPosition.current,
      alpha,
    );

    camera.quaternion.slerp(
      targetQuaternion.current,
      alpha,
    );

    if (camera instanceof THREE.PerspectiveCamera) {
      camera.fov = THREE.MathUtils.damp(
        camera.fov,
        targetFov.current,
        5,
        delta,
      );

      camera.updateProjectionMatrix();
    }
  });

  return (
    <>
      <primitive
        object={scene}
        onPointerMove={(event: ThreeEvent<PointerEvent>) => {
          setShippingHover(
            belongsTo(event.object, shipping),
          );
        }}
        onPointerOut={() => {
          setShippingHover(false);
        }}
        onClick={(event: ThreeEvent<MouseEvent>) => {
          if (!belongsTo(event.object, shipping)) {
            return;
          }

          event.stopPropagation();
          onShippingClick();
        }}
      />

      {shippingHover && shippingCenter && (
        <Html
          position={shippingCenter}
          center
          distanceFactor={8}
          style={{ pointerEvents: 'none' }}
        >
          <div className="cp-spike-label">
            <strong>SHIPPING</strong>
            <span>CLICK TO INSPECT</span>
          </div>
        </Html>
      )}
    </>
  );
}

function Scene({
  cameraName,
  onShippingClick,
}: {
  cameraName: string;
  onShippingClick: () => void;
}) {
  return (
    <>
      <color
        attach="background"
        args={['#e9e5dc']}
      />

      <StudioEnvironment />

      <ambientLight
        intensity={0.16}
      />

      <hemisphereLight
        color="#f5f1e8"
        groundColor="#353b3e"
        intensity={0.28}
      />

      <directionalLight
        castShadow
        position={[10, 18, 14]}
        intensity={3.0}
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-16}
        shadow-camera-right={16}
        shadow-camera-top={22}
        shadow-camera-bottom={-4}
        shadow-camera-near={1}
        shadow-camera-far={60}
        shadow-bias={-0.00015}
        shadow-normalBias={0.02}
      />

      <directionalLight
        position={[-10, 8, 4]}
        intensity={0.42}
      />

      <directionalLight
        position={[-6, 15, -12]}
        intensity={0.72}
      />

      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.04, 0]}
        receiveShadow
      >
        <planeGeometry args={[80, 80]} />

        <meshStandardMaterial
          color="#e9e5dc"
          roughness={0.92}
          metalness={0}
        />
      </mesh>

      <ContactShadows
        position={[0, 0.02, 0]}
        opacity={0.42}
        scale={28}
        blur={2.6}
        far={12}
        resolution={1024}
        frames={1}
      />

      <Machine
        cameraName={cameraName}
        onShippingClick={onShippingClick}
      />
    </>
  );
}

export function WebGLSpike() {
  const [cameraName, setCameraName] =
    useState(CAMERA_IDLE);

  const [shippingSelected, setShippingSelected] =
    useState(false);

  function selectShipping() {
    setShippingSelected(true);
    setCameraName(CAMERA_SHIPPING);
  }

  function reset() {
    setShippingSelected(false);
    setCameraName(CAMERA_IDLE);
  }

  return (
    <main className="cp-webgl-spike">
      <div className="cp-webgl-stage">
        <Canvas
          shadows
          dpr={[1, 2]}
          camera={{
            near: 0.1,
            far: 300,
            fov: 50,
          }}
          gl={{
            antialias: true,
            powerPreference: 'high-performance',
          }}
          onCreated={({ gl }) => {
            gl.toneMapping =
              THREE.ACESFilmicToneMapping;

            gl.toneMappingExposure = 0.95;

            gl.outputColorSpace =
              THREE.SRGBColorSpace;

            gl.shadowMap.enabled = true;
            gl.shadowMap.type =
              THREE.PCFSoftShadowMap;
          }}
        >
          <Suspense fallback={null}>
            <Scene
              cameraName={cameraName}
              onShippingClick={selectShipping}
            />
          </Suspense>
        </Canvas>
      </div>

      <header className="cp-spike-header">
        <div>
          <strong>CHANGE PROOF</strong>
          <span>
            REALTIME WEBGL / SPIKE 04 · LOOKDEV A
          </span>
        </div>

        <a href="./">
          EXIT
        </a>
      </header>

      <section className="cp-spike-copy">
        <span>
          {shippingSelected
            ? '01 / SHIPPING'
            : '00 / PROOF MACHINE'}
        </span>

        <h1>
          {shippingSelected
            ? 'Inspect the change.'
            : 'A real-time proof machine.'}
        </h1>

        <p>
          {shippingSelected
            ? 'Shipping is a real semantic 3D object. The camera transition is happening live in the browser.'
            : 'Move across the machine. Find Shipping and click the physical module.'}
        </p>
      </section>

      <aside className="cp-spike-debug">
        <strong>
          CAMERA TEST
        </strong>

        <button
          onClick={() =>
            setCameraName(CAMERA_IDLE)
          }
        >
          K01 IDLE
        </button>

        <button
          onClick={() =>
            setCameraName(CAMERA_SHIPPING)
          }
        >
          K02 SHIPPING
        </button>

        <button
          onClick={() =>
            setCameraName(CAMERA_CUTAWAY)
          }
        >
          K03 CUTAWAY
        </button>

        <button
          onClick={() =>
            setCameraName(CAMERA_HEAD)
          }
        >
          K04 HEAD
        </button>

        <button onClick={reset}>
          RESET
        </button>
      </aside>

      <div className="cp-spike-note">
        SPIKE ONLY · NOT FINAL UI
      </div>
    </main>
  );
}

useGLTF.preload(MODEL_URL);
