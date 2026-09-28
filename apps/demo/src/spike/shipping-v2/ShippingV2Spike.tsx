import {
  useEffect,
  useLayoutEffect,
  useMemo,
} from 'react';

import {
  Canvas,
  useThree,
} from '@react-three/fiber';

import {
  ContactShadows,
  Html,
  useGLTF,
} from '@react-three/drei';

import * as THREE from 'three';

import {
  RoomEnvironment,
} from 'three/examples/jsm/environments/RoomEnvironment.js';

import './shipping-v2.css';

const MODEL_URL =
  './webgl/shipping-v2/shipping-v2-frame313-baked.glb';

function normalizeName(value: string) {
  return value
    .normalize('NFKC')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function findNamedObject(
  root: THREE.Object3D,
  wanted: string,
) {
  const target =
    normalizeName(wanted);

  let found:
    | THREE.Object3D
    | undefined;

  root.traverse((object) => {
    if (found) return;

    if (
      normalizeName(object.name) ===
      target
    ) {
      found = object;
    }
  });

  return found;
}

function StudioEnvironment() {
  const { gl, scene } = useThree();

  useEffect(() => {
    const generator =
      new THREE.PMREMGenerator(gl);

    const room =
      new RoomEnvironment();

    const target =
      generator.fromScene(
        room,
        0.04,
      );

    scene.environment =
      target.texture;

    scene.environmentIntensity =
      1.15;

    return () => {
      if (
        scene.environment ===
        target.texture
      ) {
        scene.environment = null;
      }

      target.dispose();
      generator.dispose();
    };
  }, [gl, scene]);

  return null;
}

type Bounds = {
  box: THREE.Box3;
  center: THREE.Vector3;
  size: THREE.Vector3;
  radius: number;
};

function CameraRig({
  bounds,
}: {
  bounds: Bounds;
}) {
  const {
    camera,
    size: viewport,
  } = useThree();

  useEffect(() => {
    if (
      !(
        camera instanceof
        THREE.PerspectiveCamera
      )
    ) {
      return;
    }

    const fov = 28.072487;

    const vertical =
      THREE.MathUtils.degToRad(
        fov,
      );

    const horizontal =
      2 *
      Math.atan(
        Math.tan(vertical / 2) *
          (
            viewport.width /
            Math.max(
              viewport.height,
              1,
            )
          ),
      );

    const fitHeight =
      bounds.size.y /
      (
        2 *
        Math.tan(vertical / 2)
      );

    const fitWidth =
      bounds.size.x /
      (
        2 *
        Math.tan(horizontal / 2)
      );

    const distance =
      Math.max(
        fitHeight,
        fitWidth,
      ) * 1.12;

    /*
     * Authored 3/4 product view.
     *
     * glTF:
     * X = horizontal
     * Y = up
     * Z = depth
     */
    /*
     * K02 authored Blender orientation.
     *
     * Blender/glTF audit gave camera forward:
     * [-0.434803, -0.198305, -0.878420]
     *
     * Here we need TARGET -> CAMERA,
     * therefore the vector is inverted.
     */
    const direction =
      new THREE.Vector3(
        0.434803,
        0.198305,
        0.87842,
      ).normalize();

    const position =
      bounds.center
        .clone()
        .add(
          direction.multiplyScalar(
            distance,
          ),
        );

    const target =
      bounds.center
        .clone();

    /*
     * Slightly bias the eye toward
     * the upper/front mechanical layer.
     */
    target.y +=
      bounds.size.y * 0.035;

    camera.position.copy(
      position,
    );

    camera.up.set(
      0,
      1,
      0,
    );

    camera.lookAt(
      target,
    );

    camera.fov = fov;

    camera.near =
      Math.max(
        distance / 100,
        0.01,
      );

    camera.far =
      distance * 20;

    camera.updateProjectionMatrix();

    console.log(
      '[CP_SHIPPING_V2_CAMERA]',
      {
        center:
          bounds.center.toArray(),
        size:
          bounds.size.toArray(),
        radius:
          bounds.radius,
        position:
          position.toArray(),
        distance,
        fov,
      },
    );
  }, [
    bounds,
    camera,
    viewport.width,
    viewport.height,
  ]);

  return null;
}

function tuneMaterial(
  material: THREE.Material,
) {
  if (
    !(
      material instanceof
      THREE.MeshStandardMaterial
    )
  ) {
    return;
  }

  const name =
    normalizeName(material.name);

  material.envMapIntensity =
    1.2;

  if (
    name.includes(
      'warm ceramic',
    ) ||
    name.includes(
      'stateful ceramic',
    )
  ) {
    material.metalness = 0;
    material.roughness = 0.26;
    material.envMapIntensity =
      1.08;
  }

  if (
    name.includes(
      'porcelain enamel',
    )
  ) {
    material.metalness = 0.02;
    material.roughness = 0.17;
    material.envMapIntensity =
      1.28;
  }

  if (
    name.includes(
      'graphite anodized',
    )
  ) {
    material.metalness = 0.72;
    material.roughness = 0.25;
    material.envMapIntensity =
      1.48;
  }

  if (
    name.includes(
      'brushed titanium',
    )
  ) {
    material.metalness = 0.92;
    material.roughness = 0.22;
    material.envMapIntensity =
      1.65;
  }

  if (
    name.includes(
      'recessed slate',
    )
  ) {
    material.metalness = 0.16;
    material.roughness = 0.43;
    material.envMapIntensity =
      1.08;
  }

  if (
    name.includes(
      'selected head continuity',
    )
  ) {
    material.metalness = 0.04;
    material.roughness = 0.21;
    material.envMapIntensity =
      1.25;
  }

  if (
    name.includes(
      'shipping inscription',
    )
  ) {
    material.metalness = 0;
    material.roughness = 0.32;
    material.envMapIntensity =
      1.05;
  }

  material.needsUpdate = true;
}

function ShippingModel({
  bounds,
}: {
  bounds: Bounds;
}) {
  const gltf =
    useGLTF(MODEL_URL);

  const scene =
    useMemo(
      () =>
        gltf.scene.clone(true),
      [gltf.scene],
    );

  const fasciaAnchor =
    useMemo(() => {
      scene.updateMatrixWorld(
        true,
      );

      const node =
        findNamedObject(
          scene,
          'Shipping fascia hinge',
        );

      if (!node) {
        console.warn(
          '[Change Proof] Shipping fascia anchor not found',
        );

        return null;
      }

      return node.getWorldPosition(
        new THREE.Vector3(),
      );
    }, [scene]);

  useLayoutEffect(() => {
    const tuned =
      new Set<THREE.Material>();

    scene.traverse(
      (object) => {
        if (
          !(
            object instanceof
            THREE.Mesh
          )
        ) {
          return;
        }

        object.castShadow =
          true;

        object.receiveShadow =
          true;

        const materials =
          Array.isArray(
            object.material,
          )
            ? object.material
            : [object.material];

        for (
          const material
          of materials
        ) {
          if (
            tuned.has(
              material,
            )
          ) {
            continue;
          }

          tuned.add(
            material,
          );

          tuneMaterial(
            material,
          );
        }
      },
    );

    console.log(
      '[CP_SHIPPING_V2_MATERIALS]',
      Array
        .from(tuned)
        .map(
          (material) =>
            material.name,
        ),
    );
  }, [scene]);

  return (
    <>
      <primitive
        object={scene}
      />

      {fasciaAnchor && (
        <Html
          position={
            fasciaAnchor
          }
          center
          occlude={false}
        >
          <div className="cp-surface-label">
            <span className="cp-surface-label__index">
              04
            </span>

            <span className="cp-surface-label__name">
              Shipping
            </span>
          </div>
        </Html>
      )}

      <ContactShadows
        position={[
          bounds.center.x,
          bounds.box.min.y +
            0.012,
          bounds.center.z,
        ]}
        scale={
          Math.max(
            bounds.size.x,
            bounds.size.z,
          ) * 1.75
        }
        opacity={0.5}
        blur={2.4}
        far={
          Math.max(
            bounds.size.y,
            4,
          )
        }
        resolution={1024}
        frames={1}
      />
    </>
  );
}

function ShippingScene() {
  const gltf =
    useGLTF(MODEL_URL);

  const bounds =
    useMemo<Bounds>(() => {
      gltf.scene.updateMatrixWorld(
        true,
      );

      const box =
        new THREE.Box3()
          .setFromObject(
            gltf.scene,
          );

      const center =
        box.getCenter(
          new THREE.Vector3(),
        );

      const size =
        box.getSize(
          new THREE.Vector3(),
        );

      const sphere =
        box.getBoundingSphere(
          new THREE.Sphere(),
        );

      return {
        box,
        center,
        size,
        radius:
          sphere.radius,
      };
    }, [gltf.scene]);

  const floorSize =
    Math.max(
      bounds.size.x,
      bounds.size.z,
      10,
    ) * 4;

  return (
    <>
      <color
        attach="background"
        args={[
          '#dedbd3',
        ]}
      />

      <fog
        attach="fog"
        args={[
          '#dedbd3',
          20,
          55,
        ]}
      />

      <StudioEnvironment />

      <CameraRig
        bounds={bounds}
      />

      <ambientLight
        intensity={0.08}
      />

      <hemisphereLight
        color="#fffaf0"
        groundColor="#25292c"
        intensity={0.22}
      />

      <directionalLight
        castShadow
        position={[
          8,
          13,
          -7,
        ]}
        intensity={2.45}
        shadow-mapSize-width={
          2048
        }
        shadow-mapSize-height={
          2048
        }
        shadow-camera-left={
          -10
        }
        shadow-camera-right={
          10
        }
        shadow-camera-top={
          10
        }
        shadow-camera-bottom={
          -10
        }
        shadow-camera-near={
          0.1
        }
        shadow-camera-far={
          50
        }
        shadow-bias={
          -0.00012
        }
        shadow-normalBias={
          0.018
        }
      />

      <directionalLight
        position={[
          -7,
          7,
          -4,
        ]}
        intensity={0.45}
      />

      <directionalLight
        position={[
          5,
          10,
          8,
        ]}
        intensity={0.75}
      />

      <mesh
        rotation={[
          -Math.PI / 2,
          0,
          0,
        ]}
        position={[
          bounds.center.x,
          bounds.box.min.y -
            0.018,
          bounds.center.z,
        ]}
        receiveShadow
      >
        <planeGeometry
          args={[
            floorSize,
            floorSize,
          ]}
        />

        <meshStandardMaterial
          color="#dedbd3"
          roughness={0.96}
          metalness={0}
        />
      </mesh>

      <ShippingModel
        bounds={bounds}
      />
    </>
  );
}

export function ShippingV2Spike() {
  return (
    <main className="cp-shipping-v2">
      <div className="cp-shipping-v2__canvas">
        <Canvas
          shadows
          dpr={[1.5, 2]}
          gl={{
            antialias: true,
            alpha: false,
            powerPreference:
              'high-performance',
          }}
          camera={{
            fov: 28.072487,
            near: 0.01,
            far: 100,
          }}
          onCreated={({
            gl,
          }) => {
            gl.toneMapping =
            THREE.ACESFilmicToneMapping;

            gl.toneMappingExposure =
              0.84;

            gl.outputColorSpace =
              THREE.SRGBColorSpace;

            gl.shadowMap.enabled =
              true;

            gl.shadowMap.type =
              THREE.PCFSoftShadowMap;
          }}
        >
          <ShippingScene />
        </Canvas>
      </div>

      <header className="cp-shipping-v2__header">
        <div className="cp-shipping-v2__eyebrow">
          CHANGE PROOF
          <span />
          WEB ASSET V2
        </div>

        <div className="cp-shipping-v2__metrics">
          <span>
            30,030 TRI
          </span>

          <span>
            FONT GEO 0
          </span>
        </div>
      </header>

      <aside className="cp-shipping-v2__evidence">
        <div className="cp-shipping-v2__evidence-kicker">
          SELECTED CHANGE
        </div>

        <div className="cp-shipping-v2__path">
          src/shipping/eligibility.js
        </div>

        <h1>
          qualifiesForFreeShipping()
        </h1>

        <div className="cp-shipping-v2__revision">
          HEAD
          <span>
            3daeb8c
          </span>
        </div>

        <div className="cp-shipping-v2__rule" />

        <div className="cp-shipping-v2__datum">
          <div>
            <span>
              subtotalCents
            </span>

            <strong>
              = 5000
            </strong>
          </div>

          <div>
            <span>
              FREE_SHIPPING_THRESHOLD_CENTS
            </span>

            <strong>
              = 5000
            </strong>
          </div>
        </div>

        <div className="cp-shipping-v2__result">
          <span>
            RESULT
          </span>

          <strong>
            true
          </strong>
        </div>

        <div className="cp-shipping-v2__source">
          SOURCE
          <span>
            src/shipping/quote.js
          </span>
        </div>
      </aside>

      <div className="cp-shipping-v2__footer">
        <span>
          PRODUCTION GEOMETRY SLICE
        </span>

        <span>
          K01 / SHIPPING DETAIL
        </span>
      </div>
    </main>
  );
}

useGLTF.preload(
  MODEL_URL,
);
