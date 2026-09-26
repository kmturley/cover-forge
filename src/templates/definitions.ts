import type { PanelId, PanelRect, PreviewMaterial, PreviewSpec, Region, SpineOrientation, TemplateConfig, TemplateKind, TemplateMark, TemplateVariant } from '../types/template';

export const PX_PER_MM = 300 / 25.4;

/** A panel before it has a position: just its size. */
interface Spec {
  id: PanelId;
  label: string;
  w: number;
  h: number;
  text?: SpineOrientation;
  follows?: PanelId;
}

/** Panels laid out edge to edge: a row (left→right, folds are vertical) or a column (top→bottom). */
interface Piece {
  dir: 'row' | 'col';
  specs: Spec[];
}

/** A piece whose panels sit at explicit offsets (a cross-shaped box net). Offsets are from the piece's top-left, in mm. */
interface FreePiece {
  dir: 'free';
  specs: (Spec & { x: number; y: number })[];
}

interface Build {
  kind: TemplateKind;
  name: string;
  variantId: string;
  region?: Region;
  bleedMm: number;
  pieces: (Piece | FreePiece)[];
  preview: PreviewSpec;
  /** Given the piece origins, guide marks in canvas mm. Called once panel positions are known. */
  marks?: (panels: PanelRect[]) => TemplateMark[];
}

/** Separate pieces (e.g. a CD booklet and its tray card) sit side by side with room for both bleeds plus a little slack. */
const pieceGap = (bleed: number) => bleed * 2 + 2;

function assemble(b: Build): TemplateConfig {
  const panels: PanelRect[] = [];
  let cursorX = b.bleedMm;
  let tallest = 0;
  for (const piece of b.pieces) {
    let x = cursorX;
    let y = b.bleedMm;
    let width = 0;
    let height = 0;
    for (const s of piece.specs) {
      if (piece.dir === 'free') {
        const f = s as FreePiece['specs'][number];
        panels.push({ id: f.id, label: f.label, xMm: cursorX + f.x, yMm: y + f.y, widthMm: f.w, heightMm: f.h, text: f.text, follows: f.follows });
        width = Math.max(width, f.x + f.w);
        height = Math.max(height, f.y + f.h);
        continue;
      }
      panels.push({ id: s.id, label: s.label, xMm: x, yMm: y, widthMm: s.w, heightMm: s.h, text: s.text, follows: s.follows });
      if (piece.dir === 'row') {
        x += s.w;
        width += s.w;
        height = Math.max(height, s.h);
      } else {
        y += s.h;
        height += s.h;
        width = Math.max(width, s.w);
      }
    }
    cursorX += width + pieceGap(b.bleedMm);
    tallest = Math.max(tallest, height);
  }
  return {
    id: `${b.kind}-${b.variantId}`,
    kind: b.kind,
    name: b.name,
    region: b.region,
    variantId: b.variantId,
    bleedMm: b.bleedMm,
    totalWidthMm: cursorX - pieceGap(b.bleedMm) + b.bleedMm,
    totalHeightMm: tallest + b.bleedMm * 2,
    panels,
    marks: b.marks?.(panels),
    dpiScale: PX_PER_MM,
    preview: b.preview,
  };
}

export interface TemplateDef {
  kind: TemplateKind;
  name: string;
  group: 'Cases' | 'Boxes' | 'Labels & cards';
  variants: TemplateVariant[];
  build(variantId: string): TemplateConfig;
}

/** Back | spine | front, the layout shared by keepcases and slipcases. `w`/`h` are the front panel's size. */
function wrap(kind: TemplateKind, name: string, variantId: string, region: Region | undefined, w: number, h: number, spine: number, preview: PreviewSpec, bleed = 3): TemplateConfig {
  return assemble({
    kind,
    name,
    variantId,
    region,
    bleedMm: bleed,
    pieces: [
      {
        dir: 'row',
        specs: [
          { id: 'back', label: 'Back', w, h },
          { id: 'spine', label: 'Spine', w: spine, h, text: 'vertical' },
          { id: 'front', label: 'Front', w, h },
        ],
      },
    ],
    preview,
  });
}

const wrapPreview = (w: number, h: number, depth: number, casing: PreviewMaterial, glossy: boolean, radius: number): PreviewSpec => ({
  kind: 'box',
  widthMm: w,
  heightMm: h,
  depthMm: depth,
  faces: { '-x': 'spine', '+z': 'front', '-z': 'back' },
  casing,
  glossy,
  radiusMm: radius,
});

const BLURAY: Record<string, { label: string; region: Region; spine: number }> = {
  'us-11': { label: 'Standard', region: 'US', spine: 11 },
  'us-12.5': { label: 'Elite', region: 'US', spine: 12.5 },
  'eu-14': { label: 'Standard', region: 'EU', spine: 14 },
};

const DVD: Record<string, { label: string; spine: number }> = {
  'std-14': { label: 'Standard', spine: 14 },
  'slim-9': { label: 'Slim', spine: 9 },
};

/** Boxes that hold an NFC item: a slim one for a CR80 card (54 × 85.6 × 0.8 mm plus room to slide) and a small keepsake box. */
const NFC_BOX: Record<string, { label: string; w: number; h: number; d: number }> = {
  card: { label: 'Slim card box', w: 58, h: 90, d: 6 },
  small: { label: 'Small box', w: 60, h: 60, d: 25 },
};
const NFC_WALLET = { w: 58, h: 90 };
const NFC_STICKER_MM: Record<string, number> = { '25': 25, '30': 30, '35': 35 };

const variantLabel = (label: string, mm: number) => `${label} (${mm} mm)`;

interface TuckBox {
  kind: TemplateKind;
  name: string;
  variantId: string;
  /** Front/back size and the depth of the sides, mm. The spine (a side) runs along the long edge when h > w. */
  w: number;
  h: number;
  d: number;
  casing: PreviewMaterial;
  radiusMm: number;
  marks?: (panels: PanelRect[]) => TemplateMark[];
}

/**
 * A straight-tuck-end box net. A strip [ back | left side | front | right side | glue tab ] folds into a tube and only
 * the glue tab needs sticking (double-sided tape works). The lid above the front and the bottom below it each carry
 * a tuck flap that slots inside the box, so the ends close with a fold and a tuck and no glue.
 */
function tuckBox(b: TuckBox): TemplateConfig {
  const { w, h, d } = b;
  const glue = 10;
  const tuck = Math.max(12, Math.round(d * 0.85 * 10) / 10); // long enough to hold, even on a slim box
  const stripY = tuck + d;
  // Dust flaps fold in from the side panels' ends to close the corner gaps. They stop a millimetre short of the lid
  // and bottom so those edges stay cut lines (panels that touch would read as folds), and are as long as the sides are deep.
  const gap = 0.8;
  const dust = d - 1;
  return assemble({
    kind: b.kind,
    name: b.name,
    variantId: b.variantId,
    bleedMm: 3,
    pieces: [
      {
        dir: 'free',
        specs: [
          { id: 'back', label: 'Back', w, h, x: 0, y: stripY },
          { id: 'spine', label: 'Side (spine)', w: d, h, x: w, y: stripY, text: 'vertical' },
          { id: 'front', label: 'Front', w, h, x: w + d, y: stripY },
          { id: 'spineRight', label: 'Side (right)', w: d, h, x: 2 * w + d, y: stripY },
          { id: 'glue', label: 'Glue tab', w: glue, h, x: 2 * w + 2 * d, y: stripY },
          { id: 'tuck', label: 'Top tuck flap', w, h: tuck, x: w + d, y: 0 },
          { id: 'top', label: 'Top (lid)', w, h: d, x: w + d, y: tuck },
          { id: 'bottom', label: 'Bottom', w, h: d, x: w + d, y: stripY + h },
          { id: 'bottomTuck', label: 'Bottom tuck flap', w, h: tuck, x: w + d, y: stripY + h + d },
          { id: 'dustTopLeft', label: 'Dust flap', w: d - gap, h: dust, x: w, y: stripY - dust, follows: 'spine' },
          { id: 'dustBottomLeft', label: 'Dust flap', w: d - gap, h: dust, x: w, y: stripY + h, follows: 'spine' },
          { id: 'dustTopRight', label: 'Dust flap', w: d - gap, h: dust, x: 2 * w + d + gap, y: stripY - dust, follows: 'spineRight' },
          { id: 'dustBottomRight', label: 'Dust flap', w: d - gap, h: dust, x: 2 * w + d + gap, y: stripY + h, follows: 'spineRight' },
        ],
      },
    ],
    marks: b.marks,
    preview: {
      kind: 'box',
      widthMm: w,
      heightMm: h,
      depthMm: d,
      faces: { '+z': 'front', '-z': 'back', '-x': 'spine', '+x': 'spineRight', '+y': 'top', '-y': 'bottom' },
      casing: b.casing,
      glossy: false,
      radiusMm: b.radiusMm,
    },
  });
}

/**
 * A slip-cover wallet with no spine: one strip [ front | back | glue tab ] folded once between front and back. The
 * tab is stuck inside the far edge, leaving a flat pocket open at the top for the card.
 */
function wallet(name: string, w: number, h: number, marks: (panels: PanelRect[]) => TemplateMark[]): TemplateConfig {
  return assemble({
    kind: 'nfc-box',
    name,
    variantId: 'wallet',
    bleedMm: 3,
    pieces: [
      {
        dir: 'row',
        specs: [
          { id: 'front', label: 'Front', w, h },
          { id: 'back', label: 'Back', w, h },
          { id: 'glue', label: 'Glue tab', w: 8, h },
        ],
      },
    ],
    marks,
    preview: {
      kind: 'box',
      widthMm: w,
      heightMm: h,
      depthMm: 2,
      faces: { '+z': 'front', '-z': 'back' },
      casing: { color: '#e9e4d8', roughness: 0.85 },
      glossy: false,
      radiusMm: 0.8,
    },
  });
}

/**
 * Vinyl record sleeve sizes. The sleeve is a square jacket: front | spine | back in a row.
 * Standard outer sleeve thickness is ~3 mm (spine). Sizes are the outer sleeve dimensions.
 */
const VINYL: Record<string, { label: string; sizeMm: number; spine: number }> = {
  '12inch': { label: '12" LP', sizeMm: 314, spine: 3 },
  '10inch': { label: '10"', sizeMm: 262, spine: 3 },
  '7inch': { label: '7" Single', sizeMm: 184, spine: 3 },
};

export const TEMPLATE_DEFS: TemplateDef[] = [
  {
    kind: 'dvd',
    name: 'DVD',
    group: 'Cases',
    variants: Object.entries(DVD).map(([id, v]) => ({ id, label: variantLabel(v.label, v.spine) })),
    build: (id) => {
      const v = DVD[id] ?? DVD['std-14'];
      const w = 129.5;
      const h = 183;
      return wrap('dvd', `DVD, ${variantLabel(v.label, v.spine)}`, DVD[id] ? id : 'std-14', undefined, w, h, v.spine,
        wrapPreview(w, h, v.spine, { color: '#16191f', roughness: 0.35 }, true, 2.5));
    },
  },
  {
    kind: 'bluray',
    name: 'Blu-ray',
    group: 'Cases',
    variants: Object.entries(BLURAY).map(([id, v]) => ({ id, label: variantLabel(v.label, v.spine), region: v.region })),
    build: (id) => {
      const v = BLURAY[id] ?? BLURAY['us-11'];
      const w = 128;
      const h = 148;
      return wrap('bluray', `Blu-ray, ${v.region} ${variantLabel(v.label, v.spine)}`, BLURAY[id] ? id : 'us-11', v.region, w, h, v.spine,
        wrapPreview(w, h, v.spine, { color: '#0a4da2', transmission: 0.8, roughness: 0.2 }, true, 2.5));
    },
  },
  {
    kind: 'vhs',
    name: 'VHS box',
    group: 'Boxes',
    variants: [{ id: 'std-25', label: 'Standard (105 × 190 × 25 mm)' }],
    // A retail VHS sleeve is card, not plastic, so it is a printable box. The tape stands upright: 105 wide, 190 tall,
    // with the spine (the 25 mm thickness) along the long side.
    build: () => tuckBox({ kind: 'vhs', name: 'VHS box', variantId: 'std-25', w: 105, h: 190, d: 25, casing: { color: '#e6dfcf', roughness: 0.8 }, radiusMm: 1 }),
  },
  {
    kind: 'cd',
    name: 'CD',
    group: 'Cases',
    variants: [{ id: 'jewel', label: 'Standard jewel case (10 mm)' }],
    build: () =>
      assemble({
        kind: 'cd',
        name: 'CD',
        variantId: 'jewel',
        bleedMm: 3,
        pieces: [
          // Front booklet, then the rear tray card: [spine | back | spine], both spine flaps carry the title.
          { dir: 'row', specs: [{ id: 'front', label: 'Front (booklet)', w: 120, h: 120 }] },
          {
            dir: 'row',
            specs: [
              { id: 'spine', label: 'Spine (left)', w: 6.5, h: 118, text: 'vertical' },
              { id: 'back', label: 'Back (tray card)', w: 137, h: 118 },
              { id: 'spineRight', label: 'Spine (right)', w: 6.5, h: 118, text: 'vertical' },
            ],
          },
        ],
        preview: {
          kind: 'box',
          widthMm: 125,
          heightMm: 120,
          depthMm: 10,
          faces: { '-x': 'spine', '+x': 'spineRight', '+z': 'front', '-z': 'back' },
          casing: { color: '#cfe3ee', transmission: 0.9, roughness: 0.12 },
          glossy: true,
          radiusMm: 1.5,
        },
      }),
  },
  {
    kind: 'cassette',
    name: 'Cassette',
    group: 'Cases',
    variants: [{ id: 'std', label: 'Standard J-card' }],
    build: () =>
      assemble({
        kind: 'cassette',
        name: 'Cassette',
        variantId: 'std',
        bleedMm: 3,
        pieces: [
          // One strip folded twice, 101.6 mm tall: the flap wraps round the spine onto the back of the case (a partial
          // back image), then the spine, then the front. Sizes are the standard J-card: 25.4 + 12.7 + 65.1 mm.
          {
            dir: 'row',
            specs: [
              { id: 'back', label: 'Back (wraps round)', w: 25.4, h: 101.6 },
              { id: 'spine', label: 'Spine', w: 12.7, h: 101.6, text: 'vertical' },
              { id: 'front', label: 'Front', w: 65.1, h: 101.6 },
            ],
          },
        ],
        preview: {
          kind: 'box',
          widthMm: 65.1,
          heightMm: 101.6,
          depthMm: 12.7,
          faces: { '+z': 'front', '-x': 'spine' },
          decals: [{ panel: 'back', face: '-z', align: 'min-x' }],
          casing: { color: '#d8e6ee', transmission: 0.85, roughness: 0.15 },
          glossy: true,
          radiusMm: 1,
        },
      }),
  },
  {
    kind: 'floppy',
    name: 'Floppy disk',
    group: 'Labels & cards',
    variants: [{ id: 'face', label: 'Face label (69.85 mm)' }],
    build: () =>
      assemble({
        kind: 'floppy',
        name: 'Floppy disk',
        variantId: 'face',
        bleedMm: 1,
        pieces: [{ dir: 'row', specs: [{ id: 'front', label: 'Label', w: 69.85, h: 69.85 }] }],
        preview: {
          kind: 'slab',
          bodyWidthMm: 90,
          bodyHeightMm: 94,
          bodyDepthMm: 3.3,
          body: { color: '#2b2e36', roughness: 0.5 },
          panel: 'front',
          fullFace: false,
          // Real labels start below the metal shutter and wrap round the bottom edge onto the back.
          labelTopMm: 42,
          shutter: { widthMm: 24, heightMm: 23, xMm: -4 },
          hub: { radiusMm: 11, yMm: -4 },
          chamferMm: 6,
          radiusMm: 2,
        },
      }),
  },
  {
    kind: 'nfc-card',
    name: 'NFC card',
    group: 'Labels & cards',
    variants: [
      { id: 'cr80-duplex', label: 'CR80 (54 × 85.6 mm, portrait), front + back' },
      { id: 'cr80', label: 'CR80 (54 × 85.6 mm, portrait), front only' },
    ],
    build: (id) => {
      const duplex = id === 'cr80-duplex';
      return assemble({
        kind: 'nfc-card',
        name: 'NFC card',
        variantId: duplex ? 'cr80-duplex' : 'cr80',
        bleedMm: 1,
        // Two separate cards side by side (not folded), so each gets its own bleed.
        pieces: [
          { dir: 'row', specs: [{ id: 'front', label: 'Card face', w: 54, h: 85.6 }] },
          ...(duplex ? [{ dir: 'row' as const, specs: [{ id: 'back' as const, label: 'Card back', w: 54, h: 85.6 }] }] : []),
        ],
        preview: {
          kind: 'slab',
          bodyWidthMm: 54,
          bodyHeightMm: 85.6,
          bodyDepthMm: 0.76,
          body: { color: '#f4f4f2', roughness: 0.4 },
          panel: 'front',
          backPanel: duplex ? 'back' : undefined,
          fullFace: true,
          radiusMm: 3.18,
        },
      });
    },
  },
  {
    kind: 'nfc-sticker',
    name: 'NFC sticker',
    group: 'Labels & cards',
    variants: Object.keys(NFC_STICKER_MM).map((id) => ({ id, label: `Round sticker (${id} mm)` })),
    build: (id) => {
      const dia = NFC_STICKER_MM[id] ?? 25;
      return assemble({
        kind: 'nfc-sticker',
        name: 'NFC sticker',
        variantId: NFC_STICKER_MM[id] ? id : '25',
        bleedMm: 1,
        pieces: [{ dir: 'row', specs: [{ id: 'front', label: 'Sticker', w: dia, h: dia }] }],
        // The panel is square; the sticker is the circle inside it.
        marks: (panels) => [{ label: 'Cut', xMm: panels[0].xMm + dia / 2, yMm: panels[0].yMm + dia / 2, diameterMm: dia }],
        preview: {
          kind: 'slab',
          bodyWidthMm: dia,
          bodyHeightMm: dia,
          bodyDepthMm: 0.4,
          body: { color: '#f4f4f2', roughness: 0.5 },
          panel: 'front',
          fullFace: true,
          radiusMm: dia / 2,
        },
      });
    },
  },
  {
    kind: 'nfc-box',
    name: 'NFC box',
    group: 'Boxes',
    variants: [
      ...Object.entries(NFC_BOX).map(([id, v]) => ({ id, label: `${v.label} (${v.w} × ${v.h} × ${v.d} mm)` })),
      { id: 'wallet', label: `Card wallet, slip cover (${NFC_WALLET.w} × ${NFC_WALLET.h} mm, no spine)` },
    ],
    build: (id) => {
      // The tag sits inside, behind the front: mark its spot on the front panel for placement.
      const marksFor = (w: number, h: number) => (panels: PanelRect[]): TemplateMark[] => {
        const front = panels.find((p) => p.id === 'front')!;
        const dia = Math.min(25, w * 0.6, h * 0.6);
        return [{ label: 'NFC tag (inside)', xMm: front.xMm + front.widthMm / 2, yMm: front.yMm + front.heightMm / 2, diameterMm: dia }];
      };
      if (id === 'wallet') return wallet('NFC card wallet', NFC_WALLET.w, NFC_WALLET.h, marksFor(NFC_WALLET.w, NFC_WALLET.h));
      const v = NFC_BOX[id] ?? NFC_BOX.card;
      const variantId = NFC_BOX[id] ? id : 'card';
      return tuckBox({ kind: 'nfc-box', name: `NFC box, ${v.label}`, variantId, ...v, casing: { color: '#e9e4d8', roughness: 0.85 }, radiusMm: 0.8, marks: marksFor(v.w, v.h) });
    },
  },
  {
    kind: 'vinyl',
    name: 'Vinyl',
    group: 'Cases',
    variants: Object.entries(VINYL).map(([id, v]) => ({ id, label: `${v.label} (${v.sizeMm} × ${v.sizeMm} mm)` })),
    build: (id) => {
      const v = VINYL[id] ?? VINYL['12inch'];
      const s = v.sizeMm;
      return wrap(
        'vinyl',
        `Vinyl ${v.label}`,
        VINYL[id] ? id : '12inch',
        undefined,
        s,
        s,
        v.spine,
        {
          kind: 'box',
          widthMm: s,
          heightMm: s,
          depthMm: v.spine,
          faces: { '-x': 'spine', '+z': 'front', '-z': 'back' },
          casing: { color: '#1a1a1a', roughness: 0.7 },
          glossy: false,
          radiusMm: 1,
        },
      );
    },
  },
];
