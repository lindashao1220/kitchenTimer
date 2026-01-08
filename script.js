//more reference: https://openprocessing.org/sketch/773556
//https://editor.p5js.org/Sophi333/sketches/2f2tUOTEB

let timer = null;
let mode = 'LANDING'; // 'LANDING', 'SETUP', or 'ACTIVE'

// Timer settings
let durationInput = 5; // The actual value in seconds
let beyondInput = 2; // Beyond duration in minutes
let lastSensorValue1 = -1; // To track sensor changes

// Smooth transition for setup circle
let currentDisplayRadius = 0;

// Serial communication globals
let serial;
// !! IMPORTANT: Replace this
const portName = "/dev/tty.usbmodem1101";
let sensorValue1 = 0;
let sensorValue2 = 0;
let lastSensor2 = null; // for simple debounce on start trigger

// Landing Page Globals
let landingVisuals = null;
let lastInteractionTime = 0;
let isTransitioning = false;
let transitionStartTime = 0;
const IDLE_THRESHOLD = 5000; // 5 seconds
const TRANSITION_DURATION = 1500; // 1.5 seconds for wipe

function setup() {
  let canvas = createCanvas(windowWidth, windowHeight);
  canvas.parent("canvasContainer");
  background(255);

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
  
  // Initialize currentDisplayRadius to match durationInput initially
  let maxRadius = min(width, height) / 2;
  currentDisplayRadius = map(durationInput, 0, 60, 0, maxRadius);

  // Initialize Landing Visuals (Metaballs)
  landingVisuals = new LandingVisuals();
  lastInteractionTime = millis();
}

function startNewTimer() {
  // durationInput is now a number in seconds
  let duration = durationInput || 5;
  const color = [255, 255, 255];
  
  // Calculate radius based on duration (Reference: Full screen radius = 60 seconds)
  // Use currentDisplayRadius for seamless transition if needed, 
  // but better to use the exact target for the timer.
  let maxRadius = min(width, height) / 2;
  let r = map(duration, 0, 60, 0, maxRadius);
  
  timer = new CircleTimer(duration, beyondInput, width / 2, height / 2, r, color);
  timer.start();
  mode = 'ACTIVE';
}

function draw() {
  // If in landing mode, background is handled by drawLanding to allow trails or transparency if needed
  // For other modes, clear background
  if (mode !== 'LANDING') {
    background(255);
  } else {
    // Landing mode might redraw background every frame
    background(255);
  }
  
  if (mode === 'LANDING') {
    drawLanding();
  } else if (mode === 'SETUP') {
    drawSetup();
  } else if (mode === 'ACTIVE') {
    if (timer) {
      timer.update();
      timer.draw();
      
      if (timer.isComplete && timer.completionTime) {
         let elapsed = millis() - timer.completionTime;
         let seconds = Math.floor(elapsed / 1000);
         let m = Math.floor(seconds / 60);
         let s = seconds % 60;
         let timeStr = nf(m, 2) + ':' + nf(s, 2);
         
         // Ensure text is visible over bright blobs
         stroke(0);
         strokeWeight(4);
         strokeJoin(ROUND);
         fill(50);
         textSize(48);
         textAlign(CENTER, CENTER);
         text("Beyond " + timeStr, width/2, height/2);
      }
    }
  }

  // Show incoming sensor values
  fill(100);
  noStroke();
  textSize(12);
  textAlign(LEFT, BOTTOM);
  text(`Sensor: ${sensorValue1}, ${sensorValue2}`, 10, height - 10);
  textAlign(CENTER, CENTER);
}

function drawLanding() {
  // Draw floating metaballs
  if (landingVisuals) {
    landingVisuals.update();
    landingVisuals.draw();
  }

  // Draw Text
  fill(50);
  noStroke();
  textSize(24);
  textLeading(36);
  textAlign(CENTER, CENTER);
  text("Turn the knob to add or reduce time.\nPress the button to start.", width / 2, height / 2);

  // Check Idle Time
  if (!isTransitioning) {
    if (millis() - lastInteractionTime > IDLE_THRESHOLD) {
      isTransitioning = true;
      transitionStartTime = millis();
    }
  }

  // Handle Transition
  if (isTransitioning) {
    let elapsed = millis() - transitionStartTime;
    let progress = constrain(elapsed / TRANSITION_DURATION, 0, 1);

    // Vertical wipe: rectangle rising from bottom
    // We want to cover the screen with white to prepare for SETUP mode
    let wipeHeight = height * progress;
    fill(255); // White curtain
    noStroke();
    rect(0, height - wipeHeight, width, wipeHeight);

    if (progress >= 1) {
      mode = 'SETUP';
      isTransitioning = false;
      // Reset radius when entering setup
      let maxRadius = min(width, height) / 2;
      currentDisplayRadius = map(durationInput, 0, 60, 0, maxRadius);
    }
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  if (timer) {
    timer.x = width / 2;
    timer.y = height / 2;
  }
  
  if (landingVisuals) {
      // Recreate graphics or just rely on image scaling?
      // Since it's WEBGL, resizing is tricky without recreation.
      // Easiest to just recreate the visual manager or its buffer.
      landingVisuals = new LandingVisuals();
  }

  // If we exited full screen (and not just starting up), go back to landing
  if (!fullscreen() && mode !== 'LANDING') {
    mode = 'LANDING';
    lastInteractionTime = millis();
  }
}

function drawSetup() {
  // Calculate target radius
  let maxRadius = min(width, height) / 2;
  let targetRadius = map(durationInput, 0, 60, 0, maxRadius);
  
  // Smoothly interpolate currentDisplayRadius towards targetRadius
  // lerp factor 0.1 gives a nice slide
  currentDisplayRadius = lerp(currentDisplayRadius, targetRadius, 0.1);
  
  // Draw preview circle using smoothed radius
  noFill();
  stroke(55);
  strokeWeight(2);
  circle(width / 2, height / 2, currentDisplayRadius * 2);
  
  // Draw duration text
  fill(55);
  noStroke();
  textSize(32);
  text(durationInput + "s", width / 2, height / 2);
  
  textSize(24);
  fill(150);
  text("Setup Mode", width / 2, height / 2 - maxRadius - 40);
  text("Beyond: " + beyondInput + " min", width / 2, height / 2 + 50);

  textSize(16);
  text("Keys: 1/2 (Duration), 3/4 (Beyond), SPACE (Start)", width / 2, height / 2 + maxRadius + 80);
}


function keyPressed() {
  // Reset idle timer on any interaction
  lastInteractionTime = millis();

  if (mode === 'LANDING') {
    if (key === 's' || key === 'S') {
      fullscreen(true);
      mode = 'SETUP';
      let maxRadius = min(width, height) / 2;
      currentDisplayRadius = map(durationInput, 0, 60, 0, maxRadius);
    }
  } else if (mode === 'SETUP') {
    if (key === '1') {
      // Increase duration
      durationInput++;
    } else if (key === '2') {
      // Decrease duration
      if (durationInput > 1) {
        durationInput--;
      }
    } else if (key === '3') {
      // Increase beyond duration
      beyondInput++;
    } else if (key === '4') {
      // Decrease beyond duration
      if (beyondInput > 1) {
        beyondInput--;
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

function mouseMoved() {
  lastInteractionTime = millis();
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
  // Reset idle timer on serial data (assuming interaction if values change?)
  // If the sensors are noisy, this might prevent idle.
  // However, the prompt says "Turn the knob... Press the button".
  // Let's reset only if values change meaningfully?
  // For now, let's assume any data is potentially interaction, but to be safe against noise,
  // maybe only if values change.

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
      let newVal1 = int(inMessage[0]);
      let newVal2 = int(inMessage[1]);

      // Check for change to reset idle timer
      if (newVal1 !== sensorValue1 || newVal2 !== sensorValue2) {
          lastInteractionTime = millis();
      }

      sensorValue1 = newVal1;
      sensorValue2 = newVal2;

      if (mode === 'SETUP') {
         if (sensorValue1 !== lastSensorValue1) {
             let newVal = max(1, sensorValue1);
             durationInput = newVal;
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
