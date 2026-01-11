//more reference: https://openprocessing.org/sketch/773556
//https://editor.p5js.org/Sophi333/sketches/2f2tUOTEB

let timer = null;
let mode = 'LANDING'; // 'LANDING', 'INSTRUCTIONS', 'SETUP', or 'ACTIVE'

// Timer settings
let durationInput = 5; // The actual value in seconds
let beyondInput = 2; // Beyond duration in minutes
let lastRawSensorValue1 = -1; // To track sensor changes

// Smooth transition for setup circle
let currentDisplayRadius = 0;

// Instructions Mode
let landingVisuals;
let lastInteractionTime = 0;
let isTransitioning = false;
let transitionStartTime = 0;
const INSTRUCTIONS_IDLE_TIME = 5000; // 5 seconds
const TRANSITION_DURATION = 1500; // 1.5 seconds for the wipe

// Serial communication globals
let serial;
// !! IMPORTANT: Replace this
const portName = "/dev/tty.usbmodem101";
let sensorValue1 = 5;
let sensorValue2 = 0;
let lastSensor2 = null; // for simple debounce on start trigger

function setup() {
  let canvas = createCanvas(windowWidth, windowHeight);
  canvas.parent("canvasContainer");
  background(255);

  // Initialize landing visuals (handles full screen wandering metaballs)
  landingVisuals = new LandingVisuals(width, height);

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
  
  // Make gotData accessible globally for testing if needed
  window.gotData = gotData;

  textSize(32);
  textAlign(CENTER, CENTER);
  
  // Initialize currentDisplayRadius to match durationInput initially
  let maxRadius = min(width, height) / 2;
  currentDisplayRadius = map(durationInput, 0, 60, 0, maxRadius);
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
  background(255);
  
  if (mode === 'LANDING') {
    drawLanding();
  } else if (mode === 'INSTRUCTIONS') {
    if (isTransitioning) {
       // Draw Setup first (the "revealed" content)
       drawSetup();
       
       // Then draw the Instructions "curtain" sliding up
       let elapsed = millis() - transitionStartTime;
       let t = constrain(elapsed / TRANSITION_DURATION, 0, 1);
       t = t * t * (3 - 2 * t);
       let yOffset = -height * t;
       
       push();
       translate(0, yOffset);
       
       // The curtain needs to be opaque
       fill(255);
       noStroke();
       rectMode(CORNER);
       rect(0, 0, width, height);
       
       // Draw blobs and text on the curtain
       drawInstructionsContent();
       
       pop();
       
       if (t >= 1) {
          isTransitioning = false;
          mode = 'SETUP';
       }
    } else {
       // Normal instructions mode
       // Check idle
       if (millis() - lastInteractionTime > INSTRUCTIONS_IDLE_TIME) {
          isTransitioning = true;
          transitionStartTime = millis();
       }
       drawInstructionsContent();
    }
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
  fill(0);
  textSize(32);
  textAlign(CENTER, CENTER);
  text("Press 's' to enter Full Screen", width / 2, height / 2);
}

function drawInstructionsContent() {
    if (landingVisuals) {
        landingVisuals.update();
        landingVisuals.draw();
    }
    fill(50);
    noStroke();
    textAlign(CENTER, CENTER);
    textSize(24);
    textLeading(36);
    text("Turn the knob to add or reduce time.\nPress the button to start.", width / 2, height / 2);
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  if (timer) {
    timer.x = width / 2;
    timer.y = height / 2;
  }
  
  // If we exited full screen, go back to landing
  if (!fullscreen() && mode !== 'LANDING') {
    mode = 'LANDING';
  }
}

function drawSetup() {
  // Calculate target radius
  let maxRadius = min(width, height) / 2;
  let targetRadius = map(durationInput, 0, 60, 0, maxRadius);
  
  // Smoothly interpolate currentDisplayRadius towards targetRadius
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
  if (mode === 'LANDING') {
    if (key === 's' || key === 'S') {
      fullscreen(true);
      mode = 'INSTRUCTIONS';
      lastInteractionTime = millis();
      // Initialize blobs if needed, or they are already there
    }
  } else if (mode === 'INSTRUCTIONS') {
      // Any key press resets idle
      lastInteractionTime = millis();
      
      // If user presses keys that would be useful in Setup, maybe we just go to Setup?
      if (['1', '2', '3', '4', ' '].includes(key)) {
          mode = 'SETUP';
      }
      
  } else if (mode === 'SETUP') {
    if (key === '1') {
      durationInput++;
      sensorValue1 = durationInput;
    } else if (key === '2') {
      if (durationInput > 1) {
        durationInput--;
        sensorValue1 = durationInput;
      }
    } else if (key === '3') {
      beyondInput++;
    } else if (key === '4') {
      if (beyondInput > 1) {
        beyondInput--;
      }
    } else if (key === ' ') {
      startNewTimer();
    }
  } else if (mode === 'ACTIVE') {
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
  let currentString = serial.readLine(); 
  if (!currentString) return;
  currentString = trim(currentString);

  if (!currentString) return;

  if (currentString.includes(",")) {
    const inMessage = split(currentString, ",");

    if (inMessage.length >= 2) {
      let currentRaw1 = int(inMessage[0]);
      sensorValue2 = int(inMessage[1]);

      // Handle interactions in INSTRUCTIONS mode
      if (mode === 'INSTRUCTIONS') {
         // If sensors change significantly, reset idle or transition
         if (abs(currentRaw1 - lastRawSensorValue1) > 2 || (sensorValue2 === 0 && lastSensor2 !== 0)) {
             // Interaction detected
             lastInteractionTime = millis();
             
             // If button pressed (sensorValue2 == 0), maybe go to SETUP or start?
             // "Press the button to start." implies it might start the timer?
             // But usually we go to setup first.
             if (sensorValue2 === 0 && lastSensor2 !== 0) {
                 mode = 'SETUP';
                 // Optionally start timer immediately if that was the instruction intent?
                 // But text says "Press the button to start" which usually means start the timer.
                 // However, "Turn the knob to add or reduce time" implies we are in setup logic.
                 // So let's transition to SETUP so they can see the time.
             }
             
             // If knob turned, transition to SETUP to show the change
             if (abs(currentRaw1 - lastRawSensorValue1) > 2) {
                 mode = 'SETUP';
             }
         }
      }

      if (mode === 'SETUP' || mode === 'INSTRUCTIONS') { 
         // Allow updating duration input even if in instructions (so it's ready when we switch)
         // SensorValue1 should be equivalent to key '1' (increment) and key '2' (decrement)
         if (lastRawSensorValue1 !== -1 && currentRaw1 !== lastRawSensorValue1) {
             if (currentRaw1 > lastRawSensorValue1) {
                 durationInput++;
             } else if (currentRaw1 < lastRawSensorValue1) {
                 if (durationInput > 1) durationInput--;
             }
             sensorValue1 = durationInput;
         }
         lastRawSensorValue1 = currentRaw1;
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
