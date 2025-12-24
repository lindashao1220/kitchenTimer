//more reference: https://openprocessing.org/sketch/773556
//https://editor.p5js.org/Sophi333/sketches/2f2tUOTEB

let timer = null;
let mode = 'LANDING'; // 'LANDING', 'SETUP', or 'ACTIVE'

// Timer settings
let durationInput = 5; // The actual value
let lastSensorValue1 = -1; // To track sensor changes

// Animation variables for the split-flap effect
let animationStartTime = 0;
let isAnimating = false;
const animationDuration = 300; // ms

// Split-flap buffers
let flapBufferCurrent;
let flapBufferNext;
const flapWidth = 200;
const flapHeight = 300;

// Serial communication globals
let serial;
// !! IMPORTANT: Replace this
const portName = "/dev/tty.usbmodem101";
let sensorValue1 = 0;
let sensorValue2 = 0;
let lastSensor2 = null; // for simple debounce on start trigger

function setup() {
  let canvas = createCanvas(windowWidth, windowHeight);
  canvas.parent("canvasContainer");
  background(30);

  // Initialize serial connection
  try {
    serial = new p5.SerialPort();
    serial.on("list", gotList);
    serial.on("data", gotData);
    serial.list();
    serial.open(portName);
  } catch (e) {
    console.log("Serial Port not available or failed to initialize: ", e);
  }
  
  textSize(32);
  textAlign(CENTER, CENTER);
  
  // Initialize split-flap buffers
  flapBufferCurrent = createGraphics(flapWidth, flapHeight);
  flapBufferNext = createGraphics(flapWidth, flapHeight);
  drawNumberToBuffer(flapBufferCurrent, durationInput);
  drawNumberToBuffer(flapBufferNext, durationInput);
}

function drawNumberToBuffer(pg, val) {
  pg.background(40); // Dark card background
  pg.fill(255);
  pg.textSize(100);
  pg.textAlign(CENTER, CENTER);
  pg.noStroke();
  pg.text(val, pg.width/2, pg.height/2);
  // Add a thin line in the middle for the split
  pg.stroke(0);
  pg.strokeWeight(4);
  pg.line(0, pg.height/2, pg.width, pg.height/2);
}

function startNewTimer() {
  // durationInput is now a number
  let duration = durationInput || 5;
  // Use a fixed color (greenish) with transparency handled in CircleTimer
  const color = [255, 255, 255];

  // Calculate radius based on duration (1 min = full screen)
  // Full screen is min(width, height)
  // So radius = (duration / 60) * (min(width, height) / 2)
  let maxRadius = min(width, height) / 2;
  let radius = map(duration, 0, 60, 0, maxRadius);

  // Ensure a minimum visibility
  radius = max(radius, 10);

  timer = new CircleTimer(duration, width / 2, height / 2, radius, color);
  timer.start();
  mode = 'ACTIVE';
}

function draw() {
  background(30);
  
  if (mode === 'LANDING') {
    drawLanding();
  } else if (mode === 'SETUP') {
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

function drawLanding() {
  fill(255);
  textSize(32);
  text("Press 's' to enter Full Screen", width / 2, height / 2);
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  if (timer) {
    timer.x = width / 2;
    timer.y = height / 2;
  }
  
  // If we exited full screen (and not just starting up), go back to landing
  if (!fullscreen() && mode !== 'LANDING') {
    mode = 'LANDING';
  }
}

function drawSetup() {
  // Check if we need to start an animation
  if (isAnimating) {
    let elapsed = millis() - animationStartTime;
    let t = constrain(elapsed / animationDuration, 0, 1);
    
    // Smooth stepping (ease out) could use cubic, but linear is often better for mechanical feel
    // t = 1 - Math.pow(1 - t, 3); 
    
    drawSplitFlap(flapBufferCurrent, flapBufferNext, t, width / 2, height / 2);
    
    if (t >= 1) {
      isAnimating = false;
    }
  } else {
    // Static display
    imageMode(CENTER);
    image(flapBufferNext, width / 2, height / 2);
  }

  // Draw preview circle
  let maxRadius = min(width, height) / 2;
  let previewRadius = map(durationInput, 0, 60, 0, maxRadius);
  previewRadius = max(previewRadius, 10);

  noFill();
  stroke(255, 150);
  strokeWeight(4);
  circle(width / 2, height / 2, previewRadius * 2);
  
  textSize(24);
  fill(150);
  text("Setup Mode", width / 2, height / 2 - 200);
  textSize(16);
  text("Keys: 1 (+), 2 (-), SPACE (Start)", width / 2, height / 2 + 150);
}

function drawSplitFlap(currentImg, nextImg, progress, x, y) {
  const w = currentImg.width;
  const h = currentImg.height;
  
  push();
  translate(x, y);
  imageMode(CORNER);
  
  // 1. Top Half of Next (Upper Back) - Static
  image(nextImg, -w/2, -h/2, w, h/2, 0, 0, w, h/2);
  
  // 2. Bottom Half of Current (Lower Back) - Static
  image(currentImg, -w/2, 0, w, h/2, 0, h/2, w, h/2);
  
  // 3. The Flap
  if (progress < 0.5) {
     // First half: Top half of Current folds down
     let s = map(progress, 0, 0.5, 1, 0);
     push();
     scale(1, s); // Pivot is effectively at y=0 because we draw from -h/2 to 0
     image(currentImg, -w/2, -h/2, w, h/2, 0, 0, w, h/2);
     
     // Shadow/Darkening as it falls
     fill(0, map(progress, 0, 0.5, 0, 150));
     noStroke();
     rect(-w/2, -h/2, w, h/2);
     pop();
  } else {
     // Second half: Bottom half of Next falls down
     let s = map(progress, 0.5, 1, 0, 1);
     push();
     scale(1, s);
     image(nextImg, -w/2, 0, w, h/2, 0, h/2, w, h/2);
     
     // Shadow/Lightening as it arrives
     fill(0, map(progress, 0.5, 1, 150, 0));
     noStroke();
     rect(-w/2, 0, w, h/2);
     pop();
  }
  
  pop();
}

function updateDuration(newValue) {
  if (newValue !== durationInput) {
    // Capture current state into current buffer
    drawNumberToBuffer(flapBufferCurrent, durationInput);
    
    // Update value
    durationInput = newValue;
    
    // Prepare next buffer
    drawNumberToBuffer(flapBufferNext, durationInput);
    
    // Trigger animation
    isAnimating = true;
    animationStartTime = millis();
  }
}

function keyPressed() {
  if (mode === 'LANDING') {
    if (key === 's' || key === 'S') {
      fullscreen(true);
      mode = 'SETUP';
    }
  } else if (mode === 'SETUP') {
    if (key === '1') {
      updateDuration(durationInput + 1);
    } else if (key === '2') {
      // Prevent going below 1
      if (durationInput > 1) {
        updateDuration(durationInput - 1);
      }
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

// Called when a list of serial ports is returned
function gotList(thelist) {
  console.log("Available Serial Ports:");
  for (let i = 0; i < thelist.length; i++) {
    console.log(i + " " + thelist[i]);
  }
}

// Called when new data arrives from the serial port
function gotData() {
  const currentString = serial.readLine(); // Read the entire incoming line
  trim(currentString); // Remove leading/trailing whitespace

  // Only proceed if the string is not empty
  if (!currentString) return;

  // Check if the data contains a comma, indicating a pair of values
  if (currentString.includes(",")) {
    // 1. Split the string using the comma (',') delimiter
    const inMessage = split(currentString, ",");

    // 2. Ensure we received at least two values
    if (inMessage.length >= 2) {
      // 3. Convert the string values to integers and store them globally
      sensorValue1 = int(inMessage[0]);
      sensorValue2 = int(inMessage[1]);

      if (mode === 'SETUP') {
         if (sensorValue1 !== lastSensorValue1) {
             let newVal = max(1, sensorValue1);
             updateDuration(newVal);
             lastSensorValue1 = sensorValue1;
         }
      }

      // If sensorValue2 is 0, trigger start (debounced on change to 0)
      if (sensorValue2 === 0 && lastSensor2 !== 0) {
        if (mode === 'SETUP') {
          startNewTimer();
        }
      }
      lastSensor2 = sensorValue2;
    }
  }
}