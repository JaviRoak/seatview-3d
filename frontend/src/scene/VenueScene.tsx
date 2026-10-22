import { useMemo } from 'react'
import { OrbitControls } from '@react-three/drei'
import { defaultVenue, generateVenue } from '../venue/generateVenue'
import SeatInstances from './SeatInstances'
import Stage from './Stage'

export default function VenueScene() {
  const seats = useMemo(() => generateVenue(defaultVenue), [])

  return (
    <>
      <color attach="background" args={['#0f1115']} />
      <ambientLight intensity={0.4} />
      <directionalLight position={[30, 60, 20]} intensity={1.2} castShadow />

      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[200, 200]} />
        <meshStandardMaterial color="#1b1e25" />
      </mesh>

      <Stage />
      <SeatInstances seats={seats} />

      <OrbitControls
        target={[0, 0, 15]}
        maxPolarAngle={Math.PI / 2.1}
        minDistance={10}
        maxDistance={150}
      />
    </>
  )
}
