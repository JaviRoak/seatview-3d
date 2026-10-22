import { Canvas } from '@react-three/fiber'
import VenueScene from './scene/VenueScene'

export default function App() {
  return (
    <>
      <Canvas camera={{ position: [0, 40, 70], fov: 50 }} shadows>
        <VenueScene />
      </Canvas>
      <div className="hud">
        <strong>SeatView 3D</strong>
        <div>Recinto de prueba: 5 secciones, 3,000 asientos</div>
        <div>Arrastra para orbitar, rueda para acercar</div>
      </div>
    </>
  )
}
