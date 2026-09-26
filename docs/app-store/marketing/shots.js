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
//           blank page in it and an optional tag.

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

// The hands holding a blank sketchpad (Pixabay 1791337, 960 x 1280): the part of
// the photo a print shows, and where the page is blank enough to draw on.
const sketchpad = {
  photo: 'assets/photos/sketchpad-hands.jpg',
  crop: [110, 200, 760, 1080],
  drawing: { tutorial: 'palm-tree', cx: 492, cy: 725, size: 480 },
};

export const SHOTS = [
  {
    id: 'learn',
    title: 'Learn to draw<br><em>step by step</em>',
    capture: 'player-awaiting',
    device: { width: 0.56, x: 0.02, y: 0.205, rot: -5 },
    card: { ...sketchpad, tag: 'I drew this!', width: 0.44, x: 0.545, y: 0.585, rot: 6 },
    stickers: [
      { name: 'pencil:yellow', x: 0.36, y: 1.075, size: 0.70, rot: -10 },
      { name: 'cactus', x: 1.04, y: 0.10, size: 0.36, rot: 12 },
    ],
    ipad: {
      device: { width: 0.56, x: 0.04, y: 0.215, rot: -4 },
      card: { ...sketchpad, tag: 'I drew this!', width: 0.37, x: 0.585, y: 0.52, rot: 6 },
      stickers: [
        { name: 'pencil:yellow', x: 0.40, y: 1.11, size: 0.62, rot: -8 },
        { name: 'cactus', x: 1.02, y: 0.08, size: 0.30, rot: 12 },
      ],
    },
  },
  {
    id: 'method',
    title: 'Watch a line,<br><em>then draw it</em>',
    capture: 'preview-default',
    stickers: [
      { name: 'hot-air-balloon', x: 0.0, y: 0.11, size: 0.30, rot: -10 },
      { name: 'pencil:green', x: 1.0, y: 0.68, size: 0.58, rot: 62 },
    ],
  },
  {
    id: 'color',
    title: 'Then add<br><em>a little color</em>',
    capture: 'player-last',
    stickers: [
      { name: 'pencil:clay', x: 0.0, y: 0.58, size: 0.56, rot: -64 },
      { name: 'pencil:green', x: 0.06, y: 0.74, size: 0.56, rot: -40 },
      { name: 'sun', x: 0.99, y: 0.09, size: 0.30, rot: 10 },
    ],
  },
  {
    id: 'lessons',
    title: '<em>100 lessons</em><br>on 10 paths',
    capture: 'lessons',
    stickers: [
      { name: 'rocket', x: 0.99, y: 0.10, size: 0.30, rot: 18 },
      { name: 'donut', x: -0.02, y: 0.50, size: 0.25, rot: -12 },
      { name: 'sailboat', x: 1.01, y: 0.80, size: 0.30, rot: 8 },
    ],
    ipad: {
      stickers: [
        { name: 'rocket', x: 1.0, y: 0.08, size: 0.30, rot: 18 },
        { name: 'donut', x: -0.07, y: 0.46, size: 0.25, rot: -12 },
        { name: 'sailboat', x: 1.05, y: 0.80, size: 0.30, rot: 8 },
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
    capture: 'completion-default',
    stickers: [
      { name: 'star', x: 0.02, y: 0.09, size: 0.24, rot: -16 },
      { name: 'gift-box', x: 1.01, y: 0.60, size: 0.26, rot: 10 },
    ],
  },
  {
    id: 'sketchbook',
    title: 'Keep every<br><em>drawing</em>',
    capture: 'sketchbook-filled',
    stickers: [
      { name: 'strawberry', x: 0.99, y: 0.09, size: 0.26, rot: 14 },
      { name: 'pencil:yellow', x: 0.0, y: 0.66, size: 0.58, rot: -60 },
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
