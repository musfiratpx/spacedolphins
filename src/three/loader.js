// One shared glTF loader. Many NASA 3D Resources models are Draco-compressed,
// so the loader needs the Draco decoder (copied from three/examples into
// assets/draco so it works offline and ships with the build).
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';

let loader = null;

export function getGLTFLoader() {
  if (loader) return loader;
  const draco = new DRACOLoader();
  draco.setDecoderPath('assets/draco/');
  loader = new GLTFLoader();
  loader.setDRACOLoader(draco);
  return loader;
}
