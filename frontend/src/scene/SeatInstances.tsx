import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { Seat } from '../venue/generateVenue'

interface Props {
  seats: Seat[]
}

const SEAT_COLOR = new THREE.Color('#3a6ea5')

/**
 * Dibuja todos los asientos con un solo InstancedMesh (una draw call)
 * en lugar de un mesh por asiento.
 */
export default function SeatInstances({ seats }: Props) {
  const meshRef = useRef<THREE.InstancedMesh>(null)
  const dummy = useMemo(() => new THREE.Object3D(), [])

  useLayoutEffect(() => {
    const mesh = meshRef.current
    if (!mesh) return

    seats.forEach((seat, i) => {
      dummy.position.set(...seat.position)
      dummy.rotation.set(0, seat.rotationY, 0)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
      mesh.setColorAt(i, SEAT_COLOR)
    })

    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  }, [seats, dummy])

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, seats.length]} castShadow>
      <boxGeometry args={[0.7, 0.5, 0.7]} />
      <meshStandardMaterial />
    </instancedMesh>
  )
}
