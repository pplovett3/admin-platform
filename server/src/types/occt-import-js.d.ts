declare module 'occt-import-js' {
  interface OcctMeshAttributes {
    position?: {
      array: number[];
    };
    normal?: {
      array: number[];
    };
  }

  interface OcctMeshIndex {
    array: number[];
  }

  interface OcctMesh {
    attributes?: OcctMeshAttributes;
    index?: OcctMeshIndex;
    name?: string;
    color?: number[];
  }

  interface OcctResult {
    success: boolean;
    error?: string;
    meshes?: OcctMesh[];
  }

  interface OcctModule {
    ReadStepFile(fileContent: Uint8Array | Buffer, config: any): OcctResult;
  }

  function initOpenCascade(): Promise<OcctModule>;
  export default initOpenCascade;
}

