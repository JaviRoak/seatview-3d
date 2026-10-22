export default function Stage() {
  return (
    <group position={[0, 0, 0]}>
      <mesh position={[0, 0.75, 0]} castShadow receiveShadow>
        <boxGeometry args={[16, 1.5, 9]} />
        <meshStandardMaterial color="#2b2f3a" />
      </mesh>
      <mesh position={[0, 6, -4]}>
        <planeGeometry args={[16, 9]} />
        <meshStandardMaterial color="#111" emissive="#223355" emissiveIntensity={0.6} />
      </mesh>
    </group>
  )
}
