// The App Store screenshots, in listing order. Read by shots.html (which draws one
// of them) and render.mjs (which saves every one at each device's upload size).
//
// capture   a raw screen in captures/<device>/, taken by capture.sh
// title     the headline; <em> marks the words set in the highlight color
// device    where the device sits, as fractions of the canvas (width and x of its
//           width, y of its height) and a tilt in degrees; centred under the
//           headline when left out. `iphone` / `ipad` keys override per device.
// stickers  lesson illustrations (shared/Assets/References/<name>.svg) or pencils
//           ("pencil:<color>"), placed around the device. x and y are the
//           sticker's centre and size its width, all as fractions of the device
//           frame, so one list suits the iPhone and the iPad; rot is in degrees.
// card      a photo print laid over the canvas (placed like `device`), cropped to
//           `crop` (pixels of the photo), with a lesson's pen lines drawn on the
//           blank page in it and an optional tag. The drawing is either centred at
//           cx, cy at `size`, or drawn up to a stroke whose end sits on `anchor`.
// arrow     a doodled arrow from `from` to `to` (fractions of the canvas).

export const DEVICES = {
  iphone: {
    width: 1320, height: 2868, // App Store "6.9-inch display"
    frame: 'frames/iPhone 18 Pro Max - Black - Portrait.png',
    frameSize: [1470, 3000],
    // The frame's opening is square-cornered, so the capture is rounded to the
    // display: 190 px, concentric with the bezel's outer curve.
    screen: { x: 75, y: 66, width: 1320, height: 2868, radius: 190 },
    headline: { top: 205, size: 132 },
    device: { width: 0.79, y: 0.216 },
  },
  ipad: {
    width: 2064, height: 2752, // App Store "13-inch display"
    frame: 'frames/iPad Pro (M5) 13" - Space Black - Portrait.png',
    frameSize: [2300, 3000],
    screen: { x: 118, y: 124, width: 2064, height: 2752, radius: 61 },
    headline: { top: 175, size: 150 },
    device: { width: 0.72, y: 0.233 },
    stickerScale: 0.72, // the margins beside the device are narrower than on the iPhone
  },
};

// A hand drawing with a black marker on blank paper (Pixabay 3709125, 1280 x 784):
// the part of the photo a print shows, and the marker's tip, in pixels of the photo.
// The palm tree is drawn as far as the phone's step 6, the upper-right leaf's arch
// part-way, so the tip sits at the end of the line the phone is showing; `scale` is
// photo pixels per lesson unit and `rot` turns the drawing with the page.
const handDrawing = {
  photo: 'assets/photos/hand-marker.jpg',
  crop: [230, 60, 1020, 724],
  drawing: { tutorial: 'palm-tree', upTo: { step: 6, stroke: 0, t: 0.72 }, anchor: [817, 449], scale: 0.42, rot: 4 },
};

// Hands holding a blank sketchpad (Pixabay 1791337, 960 x 1280): the part of the
// photo a print shows, and where on its blank page the finished drawing sits, colored
// in as the lesson's last steps leave it.
const sketchpad = {
  photo: 'assets/photos/sketchpad-hands.jpg',
  crop: [110, 200, 760, 1080],
  drawing: { tutorial: 'sunflower', cx: 492, cy: 760, size: 600, color: true },
};

export const SHOTS = [
  {
    id: 'learn',
    title: 'Learn to draw<br><em>step by step</em>',
    capture: 'player-awaiting',
    device: { width: 0.54, x: 0.05, y: 0.19, rot: -5 },
    card: { ...handDrawing, tag: 'Your turn!', width: 0.86, x: 0.10, y: 0.678, rot: 3 },
    arrow: { from: [0.66, 0.35], to: [0.66, 0.672], bend: -0.42 },
    stickers: [
      { name: 'cactus', x: 1.25, y: 0.10, size: 0.34, rot: 12 },
    ],
    ipad: {
      device: { width: 0.46, x: 0.07, y: 0.19, rot: -4 },
      card: { ...handDrawing, tag: 'Your turn!', width: 0.58, x: 0.36, y: 0.655, rot: 3 },
      arrow: { from: [0.64, 0.33], to: [0.64, 0.648], bend: -0.4 },
      stickers: [
        { name: 'cactus', x: 1.42, y: 0.10, size: 0.30, rot: 12 },
      ],
    },
  },
  {
    id: 'paths',
    title: 'Draw what<br><em>you love</em>',
    capture: 'paths',
    stickers: [
      { name: 'ice-cream-cone', x: 0.0, y: 0.10, size: 0.26, rot: -12 },
      { name: 'race-car', x: 1.0, y: 0.82, size: 0.30, rot: 10 },
    ],
    ipad: {
      stickers: [
        { name: 'ice-cream-cone', x: -0.06, y: 0.07, size: 0.26, rot: -12 },
        { name: 'race-car', x: 1.05, y: 0.80, size: 0.30, rot: 10 },
      ],
    },
  },
  {
    id: 'keep',
    title: 'Keep every<br><em>drawing</em>',
    capture: 'sketchbook-filled',
    device: { width: 0.56, x: 0.38, y: 0.205, rot: 5 },
    card: { ...sketchpad, tag: 'I drew this!', width: 0.5, x: 0.05, y: 0.555, rot: -6 },
    stickers: [
      { name: 'strawberry', x: -0.55, y: 0.08, size: 0.30, rot: -12 },
    ],
    ipad: {
      device: { width: 0.5, x: 0.44, y: 0.2, rot: 4 },
      card: { ...sketchpad, tag: 'I drew this!', width: 0.38, x: 0.07, y: 0.47, rot: -5 },
      stickers: [
        { name: 'strawberry', x: -0.62, y: 0.06, size: 0.30, rot: -12 },
      ],
    },
  },
  {
    id: 'color',
    title: 'Finish it<br><em>in full color</em>',
    capture: 'player-last@donut',
    stickers: [
      { name: 'pencil:clay', x: 0.0, y: 0.58, size: 0.56, rot: -64 },
      { name: 'pencil:green', x: 0.06, y: 0.74, size: 0.56, rot: -40 },
      { name: 'sun', x: 0.99, y: 0.09, size: 0.30, rot: 10 },
    ],
  },
  {
    id: 'method',
    title: 'Watch a line,<br><em>then draw it</em>',
    capture: 'preview-default@rocket',
    stickers: [
      { name: 'hot-air-balloon', x: 0.0, y: 0.11, size: 0.30, rot: -10 },
      { name: 'pencil:green', x: 1.0, y: 0.68, size: 0.58, rot: 62 },
    ],
    ipad: {
      stickers: [
        { name: 'hot-air-balloon', x: -0.04, y: 0.08, size: 0.30, rot: -10 },
        { name: 'pencil:green', x: 1.06, y: 0.84, size: 0.50, rot: 62 },
      ],
    },
  },
  {
    id: 'path',
    title: 'Start simple,<br><em>then level up</em>',
    capture: 'path-default',
    stickers: [
      { name: 'star', x: 0.99, y: 0.08, size: 0.26, rot: 14 },
      { name: 'mushroom', x: -0.01, y: 0.68, size: 0.26, rot: -12 },
    ],
  },
  {
    id: 'done',
    title: 'A finished picture<br><em>in minutes</em>',
    capture: 'completion-default@sailboat',
    stickers: [
      { name: 'star', x: 0.02, y: 0.09, size: 0.24, rot: -16 },
      { name: 'gift-box', x: 1.01, y: 0.60, size: 0.26, rot: 10 },
    ],
  },
  {
    id: 'home',
    title: 'Pick up where<br><em>you left off</em>',
    capture: 'home-progress',
    stickers: [
      { name: 'apple', x: 0.01, y: 0.10, size: 0.26, rot: -12 },
      { name: 'sunflower', x: 1.0, y: 0.70, size: 0.28, rot: 10 },
    ],
    ipad: {
      stickers: [
        { name: 'apple', x: -0.05, y: 0.05, size: 0.26, rot: -12 },
        { name: 'sunflower', x: 1.04, y: 0.70, size: 0.28, rot: 10 },
      ],
    },
  },
];
