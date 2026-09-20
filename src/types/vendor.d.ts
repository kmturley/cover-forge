// jsbarcode ships untyped ES-module encoders under src/; only the bits we use are declared here.
declare module 'jsbarcode/src/barcodes/*' {
  interface Encoding {
    data: string;
    text?: string;
  }
  interface Encoder {
    data: string;
    text: string;
    valid(): boolean;
    encode(): Encoding | Encoding[];
  }
  const Encoder: new (data: string, options: Record<string, unknown>) => Encoder;
  export default Encoder;
}
