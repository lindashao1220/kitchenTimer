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
  if (mode === 'LANDING') {
    if (key === 's' || key === 'S') {
      fullscreen(true);
      mode = 'SETUP';
      // Reset radius when entering setup to ensure it starts from correct size (or animate from 0?)
      // Let's keep it continuous or reset to current duration
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
