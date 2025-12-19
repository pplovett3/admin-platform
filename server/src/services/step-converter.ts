/**
 * STEP 文件转换服务
 * 将 STEP/STP 格式的 CAD 文件转换为 GLB 格式
 * 使用 occt-import-js (OpenCASCADE WebAssembly)
 */

import fs from 'fs';
import path from 'path';

// 动态导入 occt-import-js（ES Module）
let occtImportJs: any = null;

async function getOcct() {
  if (!occtImportJs) {
    try {
      occtImportJs = await import('occt-import-js');
    } catch (e) {
      console.error('Failed to import occt-import-js:', e);
      throw new Error('STEP converter not available');
    }
  }
  return occtImportJs;
}

interface ConvertResult {
  success: boolean;
  glbPath?: string;
  glbBuffer?: Buffer;
  error?: string;
  meshInfo?: {
    vertexCount: number;
    faceCount: number;
  };
}

/**
 * 将 STEP 文件转换为 GLB
 * @param stepFilePath STEP 文件路径
 * @param outputPath 输出 GLB 文件路径（可选，如果不提供则返回 Buffer）
 */
export async function convertStepToGlb(
  stepFilePath: string,
  outputPath?: string
): Promise<ConvertResult> {
  try {
    const occt = await getOcct();
    
    // 初始化 OpenCASCADE
    const occtModule = await occt.default();
    
    // 读取 STEP 文件
    const stepFileContent = fs.readFileSync(stepFilePath);
    
    // 解析 STEP 文件
    const result = occtModule.ReadStepFile(stepFileContent, null);
    
    if (!result.success || !result.meshes || result.meshes.length === 0) {
      return {
        success: false,
        error: result.error || 'Failed to parse STEP file or no geometry found',
      };
    }

    // 统计信息
    let totalVertices = 0;
    let totalFaces = 0;
    
    // 构建 glTF 结构
    const gltf: any = {
      asset: {
        version: '2.0',
        generator: 'CollabXR STEP Converter',
      },
      scene: 0,
      scenes: [{ nodes: [0] }],
      nodes: [{ mesh: 0, name: 'STEPModel' }],
      meshes: [{ primitives: [] }],
      accessors: [],
      bufferViews: [],
      buffers: [],
      materials: [
        {
          name: 'DefaultMaterial',
          pbrMetallicRoughness: {
            baseColorFactor: [0.8, 0.8, 0.8, 1.0],
            metallicFactor: 0.1,
            roughnessFactor: 0.5,
          },
        },
      ],
    };

    // 收集所有几何数据
    const allBufferData: number[] = [];
    let bufferOffset = 0;

    // STEP 文件通常使用毫米(mm)，Three.js 使用米(m)，需要缩小 1000 倍
    const SCALE_FACTOR = 0.001; // mm → m

    for (const mesh of result.meshes) {
      if (!mesh.attributes?.position?.array) continue;

      const positions = mesh.attributes.position.array;
      const normals = mesh.attributes.normal?.array;
      const indices = mesh.index?.array;

      const vertexCount = positions.length / 3;
      totalVertices += vertexCount;
      
      // 添加位置数据（缩小 1000 倍：mm → m）
      const positionByteOffset = bufferOffset;
      for (const v of positions) {
        const buf = Buffer.alloc(4);
        buf.writeFloatLE(v * SCALE_FACTOR, 0); // 应用缩放因子
        allBufferData.push(...buf);
      }
      bufferOffset += positions.length * 4;

      // 位置 bufferView
      const positionBufferViewIndex = gltf.bufferViews.length;
      gltf.bufferViews.push({
        buffer: 0,
        byteOffset: positionByteOffset,
        byteLength: positions.length * 4,
        target: 34962, // ARRAY_BUFFER
      });

      // 位置 accessor（min/max 也需要缩放）
      const positionAccessorIndex = gltf.accessors.length;
      const posMin = [Infinity, Infinity, Infinity];
      const posMax = [-Infinity, -Infinity, -Infinity];
      for (let i = 0; i < positions.length; i += 3) {
        const x = positions[i] * SCALE_FACTOR;
        const y = positions[i + 1] * SCALE_FACTOR;
        const z = positions[i + 2] * SCALE_FACTOR;
        posMin[0] = Math.min(posMin[0], x);
        posMin[1] = Math.min(posMin[1], y);
        posMin[2] = Math.min(posMin[2], z);
        posMax[0] = Math.max(posMax[0], x);
        posMax[1] = Math.max(posMax[1], y);
        posMax[2] = Math.max(posMax[2], z);
      }
      gltf.accessors.push({
        bufferView: positionBufferViewIndex,
        componentType: 5126, // FLOAT
        count: vertexCount,
        type: 'VEC3',
        min: posMin,
        max: posMax,
      });

      const primitive: any = {
        attributes: { POSITION: positionAccessorIndex },
        material: 0,
      };

      // 添加法线数据
      if (normals && normals.length > 0) {
        const normalByteOffset = bufferOffset;
        for (const n of normals) {
          const buf = Buffer.alloc(4);
          buf.writeFloatLE(n, 0);
          allBufferData.push(...buf);
        }
        bufferOffset += normals.length * 4;

        const normalBufferViewIndex = gltf.bufferViews.length;
        gltf.bufferViews.push({
          buffer: 0,
          byteOffset: normalByteOffset,
          byteLength: normals.length * 4,
          target: 34962,
        });

        const normalAccessorIndex = gltf.accessors.length;
        gltf.accessors.push({
          bufferView: normalBufferViewIndex,
          componentType: 5126,
          count: normals.length / 3,
          type: 'VEC3',
        });

        primitive.attributes.NORMAL = normalAccessorIndex;
      }

      // 添加索引数据
      if (indices && indices.length > 0) {
        totalFaces += indices.length / 3;
        
        // 对齐到 4 字节边界
        while (bufferOffset % 4 !== 0) {
          allBufferData.push(0);
          bufferOffset++;
        }

        const indexByteOffset = bufferOffset;
        const useShortIndices = vertexCount <= 65535;
        
        if (useShortIndices) {
          for (const idx of indices) {
            const buf = Buffer.alloc(2);
            buf.writeUInt16LE(idx, 0);
            allBufferData.push(...buf);
          }
          bufferOffset += indices.length * 2;
        } else {
          for (const idx of indices) {
            const buf = Buffer.alloc(4);
            buf.writeUInt32LE(idx, 0);
            allBufferData.push(...buf);
          }
          bufferOffset += indices.length * 4;
        }

        const indexBufferViewIndex = gltf.bufferViews.length;
        gltf.bufferViews.push({
          buffer: 0,
          byteOffset: indexByteOffset,
          byteLength: indices.length * (useShortIndices ? 2 : 4),
          target: 34963, // ELEMENT_ARRAY_BUFFER
        });

        const indexAccessorIndex = gltf.accessors.length;
        gltf.accessors.push({
          bufferView: indexBufferViewIndex,
          componentType: useShortIndices ? 5123 : 5125, // UNSIGNED_SHORT or UNSIGNED_INT
          count: indices.length,
          type: 'SCALAR',
        });

        primitive.indices = indexAccessorIndex;
      }

      gltf.meshes[0].primitives.push(primitive);
    }

    // 创建 GLB
    const binaryData = Buffer.from(allBufferData);
    gltf.buffers = [{ byteLength: binaryData.length }];

    const gltfJson = JSON.stringify(gltf);
    const gltfJsonBuffer = Buffer.from(gltfJson);
    
    // 对齐 JSON 到 4 字节
    const gltfJsonPadding = (4 - (gltfJsonBuffer.length % 4)) % 4;
    const paddedGltfJson = Buffer.concat([
      gltfJsonBuffer,
      Buffer.alloc(gltfJsonPadding, 0x20), // 空格填充
    ]);

    // 对齐二进制数据到 4 字节
    const binaryPadding = (4 - (binaryData.length % 4)) % 4;
    const paddedBinary = Buffer.concat([
      binaryData,
      Buffer.alloc(binaryPadding, 0),
    ]);

    // GLB 头部
    const totalLength = 12 + 8 + paddedGltfJson.length + 8 + paddedBinary.length;
    const header = Buffer.alloc(12);
    header.writeUInt32LE(0x46546C67, 0); // 'glTF' magic
    header.writeUInt32LE(2, 4); // version
    header.writeUInt32LE(totalLength, 8);

    // JSON chunk header
    const jsonChunkHeader = Buffer.alloc(8);
    jsonChunkHeader.writeUInt32LE(paddedGltfJson.length, 0);
    jsonChunkHeader.writeUInt32LE(0x4E4F534A, 4); // 'JSON'

    // BIN chunk header
    const binChunkHeader = Buffer.alloc(8);
    binChunkHeader.writeUInt32LE(paddedBinary.length, 0);
    binChunkHeader.writeUInt32LE(0x004E4942, 4); // 'BIN\0'

    const glbBuffer = Buffer.concat([
      header,
      jsonChunkHeader,
      paddedGltfJson,
      binChunkHeader,
      paddedBinary,
    ]);

    // 保存或返回
    if (outputPath) {
      fs.writeFileSync(outputPath, glbBuffer);
      return {
        success: true,
        glbPath: outputPath,
        meshInfo: {
          vertexCount: totalVertices,
          faceCount: totalFaces,
        },
      };
    }

    return {
      success: true,
      glbBuffer,
      meshInfo: {
        vertexCount: totalVertices,
        faceCount: totalFaces,
      },
    };
  } catch (error: any) {
    console.error('STEP conversion error:', error);
    return {
      success: false,
      error: error?.message || 'Unknown conversion error',
    };
  }
}

/**
 * 检查文件是否为 STEP 格式
 */
export function isStepFile(filename: string): boolean {
  const ext = path.extname(filename).toLowerCase();
  return ext === '.step' || ext === '.stp';
}

