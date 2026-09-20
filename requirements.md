# Universal Cover Art & Template Generator: Product Requirements Document (PRD)

---

## 1. Product Overview & Vision

**CoverForge** is a standalone, client-side web platform and open-source utility designed for physical media collectors, retro gaming enthusiasts, and custom packaging creators.

Operating entirely in the browser without requiring user API keys or custom server infrastructure, CoverForge simplifies the creation of physical media packaging and labels. Users build a multi-media queue (spanning Video Games, Movies, and Music), apply a single global physical template (such as Blu-ray, DVD, Cassette, VHS, 3.5" Floppy Disks, or Avery commercial label standards) and aesthetic style across all items, adjust individual panels as needed, preview layouts in an interactive 3D WebGL viewport, and export print-ready multi-up sheet layouts.

---

## 2. Target Media Scope & Universal Search Capabilities

### A. Client-Side Universal Search Engine

* **No User API Keys Required:** The application utilizes public, CORS-friendly client-side endpoints or zero-authentication proxy endpoints to fetch metadata and images without requiring users to register or paste personal API keys.
* **Multi-Media Item Entry:** Users can search for and append disparate media types to a single active work queue:
* **Video Games:** Fetched via public game metadata and image endpoints (e.g., Steam Store, SteamGridDB).


* **Movies & TV Shows:** Fetched via public video metadata APIs (e.g., TMDB, OMDb).
* **Music (Albums/Tapes):** Fetched via public music metadata APIs (e.g., Cover Art Archive, MusicBrainz).
* **Custom Entries:** Manual asset uploads (Front, Spine, Back images, and Title text) for unsupported or homebrew media.



### B. Unified Asset Return Schema

Queries normalize retrieved assets into standardized panel slots across all supported media types:

* Vertical Cover / Poster Art
* Horizontal Hero Banners / Backdrops
* Transparent Logos & Wordmarks
* Screenshots & Media Backdrops

---

## 3. Physical Template Inventory & Dieline Specifications

CoverForge supports standardized physical media dimensions and commercial office label standards (e.g., Avery). Every template defines exact panel geometry, bleed areas, fold creases, and cut boundaries:

| Template Category | Physical Target Format | Target Panel Geometry | Standard / Dieline Alignment |
| --- | --- | --- | --- |
| **Blu-ray Keepcase** | Standard single/multi-disc Blu-ray case | ~149mm × 129mm main panels, ~11mm or ~14mm spine | Full-bleed outer wrap with spine fold guides |
| **DVD Keepcase** | Standard Amaray DVD keepcase | ~190mm × 135mm main panels, ~14mm spine | Full-bleed outer wrap

 |
| **CD Jewel Case** | Standard jewel case | ~142mm × 125mm front booklet, ~10mm tray card spine | Booklet insert + rear tray card with dual spine flaps

 |
| **3.5" Floppy Disk** | Standard 3.5" floppy disk face label | ~69.85mm × 69.85mm ($2\frac{3}{4}" \times 2\frac{3}{4}"$) | **Avery 5196 / 5296** Standard (9 per sheet)

 |
| **NFC Card (CR80)** | Standard Credit Card / CR80 NFC Card | ~85.6mm × 54mm ($3.375" \times 2.125"$) | **Avery 5390** Badge / **Avery 5371** Business Card Standard

 |
| **Audio Cassette** | Standard Cassette J-Card | ~65mm × 102mm main face, ~12mm spine, ~25mm flap | 3-panel J-card inlay foldout |
| **VHS Box** | Standard VHS slipcase | ~190mm × 105mm main panels, ~25mm spine | Full slipcase outer wrap |
| **Generic NFC Box** | Custom fold-and-glue mini box shell | Variable rectangular prism layout | Fold lines, tuck flaps, dust flaps, interior NFC target spot

 |

---

## 4. Universal Style Application & Customization

```
┌─────────────────────────────────────────────────────────┐
│ 1. Build Multi-Media Queue (Games, Movies, Songs, etc.) │
└───────────────────────────┬─────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│ 2. Apply Global Physical Template & Aesthetic Overlay    │
│    (e.g., DVD Wrap + "Scanned/Retro Wear" across all)   │
└───────────────────────────┬─────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│ 3. Customize Individual Items (Optional Fine-Tuning)     │
│    (Adjust positioning, colors, text, logos, or QR)     │
└───────────────────────────┬─────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│ 4. Interactive Previews (2D Canvas + 3D WebGL Box View)  │
└───────────────────────────┬─────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│ 5. Download All (Batch Multi-Up Print Sheets + ZIP)     │
└───────────────────────────┴─────────────────────────────┘

```

### A. Universal Dieline & Aesthetic Inheritance

* **Global Template Selection:** Choosing a physical media template (e.g., DVD Keepcase Wrap, 3.5" Floppy Label, NFC Card) automatically formats **all items currently in the media queue** to that target dieline geometry.


* **Cross-Media Formatting:** Normalized asset slots (Front Cover, Spine, Rear Metadata/Screenshots) map to the selected dieline regardless of the source media type (e.g., a queue containing a Movie, a Video Game, and a Music Album assigned to a DVD Keepcase Template will render three uniform DVD keepcase wraps using each item's respective assets).


* **Global Style Overlays:** A single style selection applies across the entire queue:
1. **Clean:** Pure artwork rendering with zero branding overlays or wear.
2. **Digital / Official:** Injects platform or media header banners matching the selected template (e.g., PS5 top header, DVD Video header, Compact Disc logo, VHS Hi-Fi header).
3. **Scanned / Retro Wear:** Applies procedural plastic wrap glare, spine creasing, and shelf-wear textures across all covers in the batch.



### B. Global vs. Individual Customization Matrix

* **Global Controls:** Adjust background fill colors, default spine fonts, border accents, or scannable codes across **all** queued items simultaneously.
* **Item-Level Overrides:** Clicking into an individual queue item allows fine-grained adjustments without breaking the rest of the queue:
* Pan, zoom, rotate, and scale image framing within panel bounding boxes.
* Adjust item-specific spine text, font size, orientation (vertical vs. horizontal), and logo scaling.
* Customize individual background colors or swap out rear screenshots and logos.



### C. Physical Media Identifiers (QR Codes & Barcodes)

* **Dynamic QR Code Generator:** Inject QR codes onto back or spine panels using configurable URL patterns (passing title, AppID, or custom media paths). If a small physical format (such as a slim floppy label) cannot fit a $35\text{ mm}$ QR code safely, the QR element is automatically omitted.


* **Barcode Generator:** Option to generate and position realistic EAN-13, UPC-A, or Code128 barcodes per item.

---

## 5. User Interaction Workflow & UI States

### State 1: Media Search & Queue Builder

* **UI Area:** Search Bar & Queue List View.
* **Actions:** User searches across media types, selects search results, and appends them to the active media queue list.

### State 2: Global Template & Style Selection

* **UI Area:** Global Configuration Toolbar.
* **Actions:** User selects a physical media template (e.g., Avery 5196 Floppy Label, DVD Keepcase) and an aesthetic overlay style (Clean, Digital, Retro Wear). All queued items update instantly.



### State 3: Interactive 2D Canvas & Item Customization

* **UI Area:** Main 2D Editor Canvas & Item Selector.
* **Actions:** User selects an individual queue item to fine-tune panel asset placement, edit spine typography, adjust background fill colors, or toggle QR code/barcode settings.

### State 4: Interactive 3D WebGL Box Viewport

* **UI Area:** Toggleable 3D Inspector Viewport.
* **Actions:** Maps the flat 2D layout of the currently selected item onto an interactive 3D box model matching the physical target dimensions. Supports 360-degree rotation, zoom, light angle adjustment, and PBR plastic/paper shaders.

### State 5: Batch Print Sheet Imposition & Export Modal

* **UI Area:** Multi-Up Export Preview & Download Panel.
* **Actions:**
1. User selects target sheet paper size (A4 vs. US Letter) and toggles cut/fold guides.
2. The system automatically calculates multi-up imposition (e.g., arranging 9 Floppy Labels per sheet on Avery 5196 or 8 NFC Card Labels per sheet on Avery 5390).


3. User selects the export format to download all generated items.



---

## 6. Export & "Download All" Requirements

* **Multi-Up Print Imposition:** Automatically arranges multiple queue items onto A4 or US Letter sheets when space permits (e.g., 9 Floppy Labels on Avery 5196/5296, 8 NFC Cards on Avery 5390, or 2 Cassette J-Cards per A4 page).


* **Batch Print-Ready Formats:**
* **High-DPI Raster (PNG / JPEG):** 300 DPI print-ready sheets containing all queued items with optional cut/fold guides.
* **Vector (SVG / PDF):** Scalable vector sheets preserving exact physical millimetre boundaries for vector editing software or automated cutting plotters.


* **Asset Pack ZIP ("Download All"):** Compiles all individual raw assets, customized flat cover renders, and final multi-up print sheets into a single structured `.zip` archive.

---

## 7. Product Boundaries & Constraints

* **No User-Uploaded Custom Dielines:** CoverForge relies strictly on built-in standard dielines and commercial sheet formats (Avery). User-defined custom dielines are out of scope for v1.
* **100% Client-Side Architecture:** No user accounts, database backends, or custom server infrastructure are required to run or host CoverForge.
