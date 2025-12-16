//more reference: https://openprocessing.org/sketch/773556
//https://editor.p5js.org/Sophi333/sketches/2f2tUOTEB

let timer = null;
let mode = 'SETUP'; // 'SETUP' or 'ACTIVE'

// Timer settings
let durationInput = 5; // The actual final value used for the timer
let lastSensorValue1 = -1; // To track sensor changes

// Split-Flap Animation State
let currentDisplayValue = 5;
let targetValue = 5;
let nextValue = 5; // The immediate next number we are flipping to
let isFlipping = false;
let flipStartTime = 0;
const flipDuration = 150; // ms per flip (fast mechanical feel)
let flipDirection = 1; // 1 for increment, -1 for decrement

// Graphics buffer for rendering numbers (texture)
let numCard;
const cardWidth = 200;
const cardHeight = 300;

// Serial communication globals
let serial;
// !! IMPORTANT: Replace this
const portName = "/dev/tty.usbmodem101";
let sensorValue1 = 0;
let sensorValue2 = 0;
let lastSensor2 = null; // for simple debounce on start trigger

function setup() {
  console.log("Setup started");
  let canvas = createCanvas(windowWidth, windowHeight);
  canvas.parent("canvasContainer");
  background(30);

  // Initialize Offscreen Graphics for Number Card
  numCard = createGraphics(cardWidth, cardHeight);
  numCard.pixelDensity(1);
  numCard.textAlign(CENTER, CENTER);
  numCard.textSize(180);
  numCard.noStroke();

  // Initialize serial connection
  try {
    serial = new p5.SerialPort();
    serial.on("list", gotList);
    serial.on("data", gotData);
    // serial.list(); // specific to p5.serialcontrol app
    console.log("Attempting to open serial port...");
    serial.open(portName);
    console.log("Serial port open request sent.");
  } catch (e) {
    console.log("Serial Port not available or failed to initialize: ", e);
  }

  textSize(32);
  textAlign(CENTER, CENTER);
  console.log("Setup finished");
}

function startNewTimer() {
  // Use current targetValue as the duration, or ensure we settle?
  // User might hit start while it's rolling. Let's use targetValue.
  let duration = targetValue || 5;
  const color = [255, 255, 255];
  timer = new CircleTimer(duration, width / 2, height / 2, 300, color);
  timer.start();
  mode = 'ACTIVE';
}

function draw() {
  background(30);

  if (mode === 'SETUP') {
    drawSetup();
  } else if (mode === 'ACTIVE') {
    if (timer) {
      timer.update();
      timer.draw();
    }
  }

  // Show incoming sensor values
  fill(100);
  textSize(12);
  textAlign(LEFT, BOTTOM);
  text(`Sensor: ${sensorValue1}, ${sensorValue2}`, 10, height - 10);
  textAlign(CENTER, CENTER);
}

// Draw a specific number onto the shared graphics buffer
function updateNumCard(num) {
  numCard.background(40); // Dark grey card background
  numCard.fill(255);      // White text
  numCard.text(num, numCard.width / 2, numCard.height / 2 + 15); // Slight y-offset for visual centering

  // Optional: Add a subtle line in the middle?
  // Split flap usually has a cut.
  numCard.stroke(20);
  numCard.strokeWeight(2);
  numCard.line(0, numCard.height/2, numCard.width, numCard.height/2);
  numCard.noStroke();
}

function drawSplitFlap(valA, valB, progress, direction, x, y) {
  // valA = Start Number, valB = End Number
  // direction = 1 (A -> B is increment), -1 (A -> B is decrement)
  // x, y = Center coordinates

  let w = cardWidth;
  let h = cardHeight;
  let halfH = h / 2;

  // Determine Top Static and Bottom Static numbers based on direction
  let staticTopVal, staticBottomVal;

  if (direction > 0) {
    // FWD (5 -> 6):
    // Static Top is '6' (behind the falling '5')
    // Static Bottom is '5' (below the falling '5')
    staticTopVal = valB;
    staticBottomVal = valA;
  } else {
    // BWD (6 -> 5):
    // Static Top is '6' (above the rising '6')
    // Static Bottom is '5' (behind the rising '6')
    staticTopVal = valA;
    staticBottomVal = valB;
  }

  // Draw Static Top
  updateNumCard(staticTopVal);
  // Copy Top Half: sx=0, sy=0, sw=w, sh=halfH
  image(numCard, x - w/2, y - h/2, w, halfH, 0, 0, w, halfH);

  // Draw Static Bottom
  updateNumCard(staticBottomVal);
  // Copy Bottom Half: sx=0, sy=halfH, sw=w, sh=halfH
  image(numCard, x - w/2, y, w, halfH, 0, halfH, w, halfH);

  // Draw Moving Flap
  // We need to darken it based on angle
  // 0.0 -> 0.5: First half of animation
  // 0.5 -> 1.0: Second half

  if (direction > 0) {
    // FWD: Top of A falls down to become Bottom of B
    if (progress < 0.5) {
      // Draw Top of A
      updateNumCard(valA);
      let p = map(progress, 0, 0.5, 0, 1);
      let currentH = halfH * (1 - p); // Shrink from full half to 0

      // Draw anchored at Top (y - halfH)
      // Actually, it's anchored at the Hinge (y).
      // Top half usually sits from y-halfH to y.
      // If it rotates down, the top edge moves towards y.
      // So visual position is y - currentH.

      image(numCard, x - w/2, y - currentH, w, currentH, 0, 0, w, halfH);

      // Shadow: Darken as it falls (approaches 90deg)
      let shadowAlpha = map(p, 0, 1, 0, 150);
      fill(0, shadowAlpha);
      noStroke();
      rect(x - w/2, y - currentH, w, currentH);

    } else {
      // Draw Bottom of B
      updateNumCard(valB);
      let p = map(progress, 0.5, 1, 0, 1);
      let currentH = halfH * p; // Grow from 0 to full half

      // Draw anchored at Hinge (y) growing down
      image(numCard, x - w/2, y, w, currentH, 0, halfH, w, halfH);

      // Shadow: Lighten as it flattens (leaves 90deg)
      let shadowAlpha = map(p, 0, 1, 150, 0);
      fill(0, shadowAlpha);
      noStroke();
      rect(x - w/2, y, w, currentH);
    }
  } else {
    // BWD: Bottom of A lifts up to become Top of B
    if (progress < 0.5) {
      // Draw Bottom of A
      updateNumCard(valA);
      let p = map(progress, 0, 0.5, 0, 1);
      let currentH = halfH * (1 - p); // Shrink from full half to 0

      // Draw anchored at Hinge (y)
      // Bottom half sits from y to y+halfH.
      // As it lifts, bottom edge moves towards y.
      image(numCard, x - w/2, y, w, currentH, 0, halfH, w, halfH);

      // Shadow
      let shadowAlpha = map(p, 0, 1, 0, 150);
      fill(0, shadowAlpha);
      noStroke();
      rect(x - w/2, y, w, currentH);

    } else {
      // Draw Top of B
      updateNumCard(valB);
      let p = map(progress, 0.5, 1, 0, 1);
      let currentH = halfH * p; // Grow from 0 to full half

      // Draw anchored at Hinge (y) growing Up
      // Position is y - currentH
      image(numCard, x - w/2, y - currentH, w, currentH, 0, 0, w, halfH);

      // Shadow
      let shadowAlpha = map(p, 0, 1, 150, 0);
      fill(0, shadowAlpha);
      noStroke();
      rect(x - w/2, y - currentH, w, currentH);
    }
  }
}

function drawSetup() {
  // Logic to handle stepping
  if (!isFlipping) {
    if (currentDisplayValue !== targetValue) {
      // Start a new flip
      isFlipping = true;
      flipStartTime = millis();

      let diff = targetValue - currentDisplayValue;
      // Flip 1 unit towards target
      flipDirection = diff > 0 ? 1 : -1;
      nextValue = currentDisplayValue + flipDirection;
    }
  }

  if (isFlipping) {
    let elapsed = millis() - flipStartTime;
    let progress = constrain(elapsed / flipDuration, 0, 1);

    drawSplitFlap(currentDisplayValue, nextValue, progress, flipDirection, width/2, height/2);

    if (progress >= 1) {
      // Flip complete
      currentDisplayValue = nextValue;
      isFlipping = false;
    }
  } else {
    // Static draw (no animation)
    updateNumCard(currentDisplayValue);
    image(numCard, width/2 - cardWidth/2, height/2 - cardHeight/2);
  }

  textSize(24);
  fill(150);
  text("Setup Mode", width / 2, height / 2 - 200);
  textSize(16);
  text("Keys: 1 (+), 2 (-), SPACE (Start)", width / 2, height / 2 + 200);
}

function updateTarget(newTarget) {
  // Ensure target is at least 1
  targetValue = max(1, newTarget);
}

function keyPressed() {
  if (mode === 'SETUP') {
    if (key === '1') {
      updateTarget(targetValue + 1);
    } else if (key === '2') {
      updateTarget(targetValue - 1);
    } else if (key === ' ') {
      startNewTimer();
    }
  } else if (mode === 'ACTIVE') {
    // Optional: SPACE to reset?
    if (key === ' ') {
      mode = 'SETUP';
      if (timer) timer.reset();
    }
  }
}

// ------------------------------------------------------------------

function gotList(thelist) {
  console.log("Available Serial Ports:");
  for (let i = 0; i < thelist.length; i++) {
    console.log(i + " " + thelist[i]);
  }
}

function gotData() {
  const currentString = serial.readLine();
  trim(currentString);

  if (!currentString) return;

  if (currentString.includes(",")) {
    const inMessage = split(currentString, ",");

    if (inMessage.length >= 2) {
      sensorValue1 = int(inMessage[0]);
      sensorValue2 = int(inMessage[1]);

      if (mode === 'SETUP') {
         // Map sensorValue1 to targetValue
         // We only update target if sensor changed significantly?
         // Or just let it flow. The animation queue handles the smoothing.
         if (sensorValue1 !== lastSensorValue1) {
             let newVal = max(1, sensorValue1);
             // If sensor changes, we update target.
             // Keyboard changes also update target.
             // Last one wins.
             updateTarget(newVal);
             lastSensorValue1 = sensorValue1;
         }
      }

      if (sensorValue2 === 0 && lastSensor2 !== 0) {
        if (mode === 'SETUP') {
          startNewTimer();
        }
      }
      lastSensor2 = sensorValue2;
    }
  }
}
