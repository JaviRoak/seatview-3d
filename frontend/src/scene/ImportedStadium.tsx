import { Component, Suspense, useMemo, type ReactNode } from 'react';
import { Html, useGLTF } from '@react-three/drei';
import { Mesh } from 'three';

class ModelBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    return this.state.failed
      ? <Html center><div className="card card-tight" role="alert">No se pudo cargar el estadio. Recarga la página para volver a intentarlo.</div></Html>
      : this.props.children;
  }
}

function Model({ url }: { url: string }) {
  const { scene } = useGLTF(url, false, false);
  const model = useMemo(() => {
    const copy = scene.clone(true);
    copy.traverse((object) => {
      if (object instanceof Mesh) {
        // Only SeatsInstanced handles hover/click, just like procedural venues.
        object.raycast = () => {};
        object.castShadow = false;
        object.receiveShadow = false;
      }
    });
    return copy;
  }, [scene]);
  // GLTFLoader's cache owns the shared geometries/materials.
  return <primitive object={model} dispose={null} />;
}

export function ImportedStadium({ url }: { url: string }) {
  return <ModelBoundary key={url}>
    <Suspense fallback={<Html center><div className="card card-tight" role="status">Cargando estadio…</div></Html>}>
      <Model url={url} />
    </Suspense>
  </ModelBoundary>;
}
