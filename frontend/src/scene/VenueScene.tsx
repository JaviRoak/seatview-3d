import { OrbitControls } from '@react-three/drei'

export default function VenueScene() {
  return (
    <>
      <color attach="background" args={['#0f1115']} />
      <ambientLight intensity={0.4} />
      <directionalLight position={[30, 60, 20]} intensity={1.2} castShadow />

      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[200, 200]} />
        <meshStandardMaterial color="#1b1e25" />
      </mesh>

      <OrbitControls
        target={[0, 0, 0]}
        maxPolarAngle={Math.PI / 2.1}
        minDistance={10}
        maxDistance={150}
      />
    </>
  )
}
