declare module "heic-convert" {
  interface ConvertOptions {
    buffer: Uint8Array | ArrayBuffer;
    format: "JPEG" | "PNG";
    /** 0..1, JPEG only. */
    quality?: number;
  }
  export default function convert(options: ConvertOptions): Promise<ArrayBuffer>;
}
