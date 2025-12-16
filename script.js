//more reference: https://openprocessing.org/sketch/773556
//https://editor.p5js.org/Sophi333/sketches/2f2tUOTEB

let timer = null;
let mode = 'LANDING'; // 'LANDING', 'SETUP', or 'ACTIVE'

// Timer settings
let durationInput = 5; // The actual value
let lastSensorValue1 = -1; // To track sensor changes

// Animation variables for the rolling effect
let displayValue = 5;
let oldDisplayValue = 5;
let animationStartTime = 0;
let isAnimating = false;
const animationDuration = 300; // ms

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
}

function startNewTimer() {
  // durationInput is now a number
  let duration = durationInput || 5;
  // Use a fixed color (greenish) with transparency handled in CircleTimer
  const color = [255, 255, 255];
  // Increase radius for a larger initial circle
  timer = new CircleTimer(duration, width / 2, height / 2, 300, color);
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
  fill(255);
  textSize(100);
  
  if (isAnimating) {
    let elapsed = millis() - animationStartTime;
    let t = constrain(elapsed / animationDuration, 0, 1);
    
    // Smooth stepping (ease out)
    t = 1 - Math.pow(1 - t, 3);
    
    let offset = height * 0.2 * t; // Move by 20% of height
    
    let direction = (displayValue > oldDisplayValue) ? 1 : -1;
    
    // Draw Old Value moving away
    let oldY = height / 2 - (direction * offset * 5); // Amplify movement to clear screen
    let oldAlpha = map(t, 0, 0.5, 255, 0); // Fade out quickly
    
    fill(255, 255, 255, oldAlpha);
    text(oldDisplayValue, width / 2, oldY);
    
    // Draw New Value entering
    let startNewY = height / 2 + (direction * height * 0.5); 
    let targetNewY = height / 2;
    let currentNewY = lerp(startNewY, targetNewY, t);
    
    fill(255, 255, 255, 255); 
    text(displayValue, width / 2, currentNewY);
    
    if (t >= 1) {
      isAnimating = false;
    }
  } else {
    // Static display
    text(durationInput, width / 2, height / 2);
  }
  
  textSize(24);
  fill(150);
  text("Setup Mode", width / 2, height / 2 - 100);
  textSize(16);
  text("Keys: 1 (+), 2 (-), SPACE (Start)", width / 2, height / 2 + 80);
}

function updateDuration(newValue) {
  if (newValue !== durationInput) {
    oldDisplayValue = durationInput;
    durationInput = newValue;
    displayValue = durationInput;
    
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