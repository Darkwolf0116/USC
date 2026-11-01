export interface WebGpuSupport {
  supported: boolean;
  /** Spanish, user-facing explanation when WebGPU is not available. */
  reason?: string;
}

interface GpuNavigator extends Navigator {
  gpu?: { requestAdapter: () => Promise<unknown | null> };
}

/** Checks that the browser exposes WebGPU and that a GPU adapter can actually be obtained. */
export async function detectWebGpu(): Promise<WebGpuSupport> {
  if (typeof navigator === "undefined" || !("gpu" in navigator)) {
    return {
      supported: false,
      reason: "Este navegador no es compatible con WebGPU.",
    };
  }
  try {
    const adapter = await (navigator as GpuNavigator).gpu?.requestAdapter();
    if (!adapter) {
      return {
        supported: false,
        reason: "No se encontró una tarjeta gráfica compatible con WebGPU en este dispositivo.",
      };
    }
    return { supported: true };
  } catch {
    return {
      supported: false,
      reason: "No fue posible iniciar WebGPU en este dispositivo.",
    };
  }
}
