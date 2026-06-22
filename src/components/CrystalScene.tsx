import { Canvas } from "@react-three/fiber";
import { Billboard, ContactShadows, Line, OrbitControls, Stars, Text } from "@react-three/drei";
import { Suspense, useMemo } from "react";
import { Color, Matrix4, Quaternion, Vector3 } from "three";
import { buildCrystalRenderModel } from "../crystal-geometry.js";

type RenderAtom = {
  id: string;
  element: string;
  label: string;
  position: number[];
  color: string;
  displayRadius: number;
};

type RenderBond = {
  id: string;
  start: number[];
  end: number[];
};

type RenderCellEdge = {
  start: number[];
  end: number[];
};

type CrystalMaterial = {
  formula: string;
  atoms: Array<{
    id: string;
    element: string;
    label: string;
    abc: number[];
    xyz: number[];
  }>;
  lattice: {
    matrix: number[][];
  };
  theme: string[];
};

function vectorFromTuple(tuple: number[]) {
  return new Vector3(tuple[0] ?? 0, tuple[1] ?? 0, tuple[2] ?? 0);
}

function toTuple3(tuple: number[]): [number, number, number] {
  return [tuple[0] ?? 0, tuple[1] ?? 0, tuple[2] ?? 0];
}

function BondCylinder({ bond, color }: { bond: RenderBond; color: string }) {
  const { matrix, length } = useMemo(() => {
    const start = vectorFromTuple(bond.start);
    const end = vectorFromTuple(bond.end);
    const midpoint = start.clone().add(end).multiplyScalar(0.5);
    const direction = end.clone().sub(start);
    const distance = direction.length();
    const quaternion = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), direction.normalize());
    const transform = new Matrix4().compose(midpoint, quaternion, new Vector3(1, distance, 1));
    return { matrix: transform, length: distance };
  }, [bond]);

  if (length <= 0) {
    return null;
  }

  return (
    <mesh matrix={matrix} matrixAutoUpdate={false} castShadow receiveShadow>
      <cylinderGeometry args={[0.024, 0.024, 1, 18]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.18} roughness={0.48} metalness={0.18} />
    </mesh>
  );
}

function AtomSphere({ atom, showLabel }: { atom: RenderAtom; showLabel: boolean }) {
  const color = new Color(atom.color);
  return (
    <group position={toTuple3(atom.position)}>
      <mesh castShadow receiveShadow>
        <sphereGeometry args={[atom.displayRadius, 48, 48]} />
        <meshPhysicalMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.18}
          roughness={0.24}
          metalness={0.06}
          clearcoat={0.65}
          clearcoatRoughness={0.28}
        />
      </mesh>
      <mesh scale={[1.28, 1.28, 1.28]}>
        <sphereGeometry args={[atom.displayRadius, 32, 32]} />
        <meshBasicMaterial color={color} transparent opacity={0.08} depthWrite={false} />
      </mesh>
      {showLabel && (
        <Billboard position={[0, atom.displayRadius + 0.18, 0]}>
          <Text
            fontSize={0.14}
            color="#f7fbff"
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.006}
            outlineColor="#030009"
          >
            {atom.label}
          </Text>
        </Billboard>
      )}
    </group>
  );
}

function CrystalModel({
  material,
  showLabels,
  showBonds,
}: {
  material: CrystalMaterial;
  showLabels: boolean;
  showBonds: boolean;
}) {
  const model = useMemo(() => buildCrystalRenderModel(material), [material]);
  const bondColor = material.theme[0] ?? "#00ffff";

  return (
    <group rotation={[0, 0, 0]}>
      {model.cellEdges.map((edge: RenderCellEdge, index: number) => (
        <Line
          key={`cell-${index}`}
          points={[toTuple3(edge.start), toTuple3(edge.end)]}
          color={index % 2 === 0 ? material.theme[0] : material.theme[1]}
          lineWidth={1.2}
          transparent
          opacity={0.62}
        />
      ))}

      {showBonds &&
        model.bonds.map((bond: RenderBond) => <BondCylinder key={bond.id} bond={bond} color={bondColor} />)}

      {model.atoms.map((atom: RenderAtom) => (
        <AtomSphere key={atom.id} atom={atom} showLabel={showLabels} />
      ))}
    </group>
  );
}

function Loader() {
  return (
    <Billboard>
      <Text fontSize={0.18} color="#00ffff" anchorX="center" anchorY="middle">
        loading crystal field
      </Text>
    </Billboard>
  );
}

export function CrystalScene({
  material,
  showLabels,
  showBonds,
}: {
  material: CrystalMaterial;
  showLabels: boolean;
  showBonds: boolean;
}) {
  return (
    <Canvas
      className="crystal-canvas"
      orthographic
      shadows
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true }}
      camera={{ position: [0, 0, 8], zoom: 78, near: 0.1, far: 100 }}
    >
      <ambientLight intensity={0.56} />
      <hemisphereLight args={["#e8fdff", "#180023", 0.92]} />
      <directionalLight position={[5.5, 7, 4.5]} intensity={2.6} castShadow shadow-mapSize={[2048, 2048]} />
      <pointLight position={[-4, 2.5, 3]} color={material.theme[1]} intensity={1.8} />
      <pointLight position={[3, -2.5, 2.5]} color={material.theme[0]} intensity={1.35} />
      <Stars radius={20} depth={24} count={700} factor={1.8} saturation={0.75} fade speed={0.22} />
      <Suspense fallback={<Loader />}>
        <CrystalModel material={material} showLabels={showLabels} showBonds={showBonds} />
        <ContactShadows position={[0, -3.05, 0]} opacity={0.28} scale={8} blur={3.2} far={6} />
      </Suspense>
      <OrbitControls makeDefault enableDamping dampingFactor={0.075} minZoom={42} maxZoom={150} />
    </Canvas>
  );
}
