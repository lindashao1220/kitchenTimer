// Link to reference sketches for inspiration
// https://openprocessing.org/sketch/773556
// https://editor.p5js.org/Sophi333/sketches/2f2tUOTEB

// --- GLOBAL VARIABLES ---
// These variables store information that needs to be remembered between frames.

let timer = null; // This will hold our timer object (the colorful circle)
let mode = 'LANDING'; // Keeps track of which screen we are on: 'LANDING', 'SETUP', or 'ACTIVE'

// Timer settings (default values)
let durationInput = 5; // How long the timer lasts (in seconds)
let beyondInput = 2; // How long the "fuzzy" phase lasts (in minutes)
let lastSensorValue1 = -1; // Remembers the previous sensor value to detect changes

// Visual settings
let currentDisplayRadius = 0; // Used to make the circle grow smoothly in Setup mode

// Serial communication (talking to the Arduino/sensor)
let serial; // The serial port object
// IMPORTANT: You must change this to match your computer's USB port name!
// You can see the list of available ports in the console when you run the code.
const portName = "/dev/tty.usbmodem1101";

let sensorValue1 = 0; // The first number received from the sensor
let sensorValue2 = 0; // The second number received from the sensor
let lastSensor2 = null; // Used to check if the button was just pressed (debounce)


// --- SETUP FUNCTION ---
// This runs once when the program starts.
function setup() {
  // Create a canvas that fills the entire window
  let canvas = createCanvas(windowWidth, windowHeight);
  // Put the canvas inside the HTML element with id "canvasContainer"
  canvas.parent("canvasContainer");
  // Set the background color to white (255)
  background(255);

  // --- SERIAL SETUP ---
  // Try to set up the connection to the external sensor
  try {
    serial = new p5.SerialPort(); // Create the serial object
    serial.on("list", gotList);   // When we get a list of ports, call 'gotList'
    serial.on("data", gotData);   // When we get data, call 'gotData'
    serial.list();                // Ask for the list of ports
    serial.open(portName);        // Open the specific port
  } catch (e) {
    // If something goes wrong, print an error to the console
    console.log("Serial Port not available or failed to initialize: ", e);
  }
  
  // Set text settings (size 32px, centered)
  textSize(32);
  textAlign(CENTER, CENTER);
  
  // Initialize the circle size for the Setup screen
  // We want it to match the starting duration.
  // min(width, height) / 2 is the maximum size the circle can be without going off screen.
  let maxRadius = min(width, height) / 2;
  // map converts the time (0-60s) to a size (0-maxRadius)
  currentDisplayRadius = map(durationInput, 0, 60, 0, maxRadius);
}


// --- START TIMER HELPER ---
// This function creates the timer and switches to the active mode.
function startNewTimer() {
  // Use the current durationInput as the time (in seconds)
  let duration = durationInput || 5;
  const color = [255, 255, 255]; // Default color (white)
  
  // Calculate how big the timer should be based on the duration
  let maxRadius = min(width, height) / 2;
  let r = map(duration, 0, 60, 0, maxRadius);
  
  // Create a new CircleTimer object with our settings
  timer = new CircleTimer(duration, beyondInput, width / 2, height / 2, r, color);

  // Tell the timer to start ticking
  timer.start();

  // Switch the application mode to 'ACTIVE' so we see the timer
  mode = 'ACTIVE';
}


// --- DRAW LOOP ---
// This runs over and over again (about 60 times a second).
// It handles drawing everything to the screen.
function draw() {
  background(255); // Clear the screen with white every frame
  
  // Check which mode we are in and draw the correct thing
  if (mode === 'LANDING') {
    drawLanding(); // Draw the start screen
  } else if (mode === 'SETUP') {
    drawSetup();   // Draw the settings screen
  } else if (mode === 'ACTIVE') {
    // If we have a timer, update and draw it
    if (timer) {
      timer.update(); // Update the time and physics
      timer.draw();   // Draw the blobs
      
      // If the timer is finished (in the "Beyond" phase)
      if (timer.isComplete && timer.completionTime) {
         // Calculate how much time has passed since it finished
         let elapsed = millis() - timer.completionTime;
         let seconds = Math.floor(elapsed / 1000);
         let m = Math.floor(seconds / 60); // Minutes
         let s = seconds % 60;             // Seconds
         let timeStr = nf(m, 2) + ':' + nf(s, 2); // Format as MM:SS
         
         // Draw the "Beyond" timer text
         stroke(0);        // Black outline
         strokeWeight(4);  // Thick outline
         strokeJoin(ROUND);// Rounded corners for text stroke
         fill(50);         // Dark grey text color
         textSize(48);     // Big text
         textAlign(CENTER, CENTER);
         text("Beyond " + timeStr, width/2, height/2);
      }
    }
  }

  // Draw the sensor values at the bottom left for debugging
  fill(100);
  textSize(12);
  textAlign(LEFT, BOTTOM);
  text(`Sensor: ${sensorValue1}, ${sensorValue2}`, 10, height - 10);

  // Reset text alignment for other things
  textAlign(CENTER, CENTER);
}


// --- LANDING SCREEN ---
// Draws the initial "Press 's' to start" screen.
function drawLanding() {
  fill(0); // Black text
  textSize(32);
  text("Press 's' to enter Full Screen", width / 2, height / 2);
}


// --- WINDOW RESIZE ---
// This runs automatically if the browser window changes size.
function windowResized() {
  resizeCanvas(windowWidth, windowHeight); // Resize the drawing area

  // Recenter the timer if it exists
  if (timer) {
    timer.x = width / 2;
    timer.y = height / 2;
  }
  
  // If user exits full screen (ESC key), go back to landing page
  if (!fullscreen() && mode !== 'LANDING') {
    mode = 'LANDING';
  }
}


// --- SETUP SCREEN ---
// Draws the screen where you set the time.
function drawSetup() {
  // Calculate the target size based on the current duration setting
  let maxRadius = min(width, height) / 2;
  let targetRadius = map(durationInput, 0, 60, 0, maxRadius);
  
  // Smoothly animate the circle size changing
  // 'lerp' moves 10% (0.1) of the way towards the target each frame
  currentDisplayRadius = lerp(currentDisplayRadius, targetRadius, 0.1);
  
  // Draw the preview circle outline
  noFill();
  stroke(55);
  strokeWeight(2);
  circle(width / 2, height / 2, currentDisplayRadius * 2);
  
  // Draw the duration text in the middle
  fill(55);
  noStroke();
  textSize(32);
  text(durationInput + "s", width / 2, height / 2);
  
  // Draw instructions
  textSize(24);
  fill(150);
  text("Setup Mode", width / 2, height / 2 - maxRadius - 40);
  text("Beyond: " + beyondInput + " min", width / 2, height / 2 + 50);

  textSize(16);
  text("Keys: 1/2 (Duration), 3/4 (Beyond), SPACE (Start)", width / 2, height / 2 + maxRadius + 80);
}


// --- KEYBOARD INPUT ---
// Runs when any key is pressed.
function keyPressed() {
  if (mode === 'LANDING') {
    // If on landing screen, 's' starts the app
    if (key === 's' || key === 'S') {
      fullscreen(true); // Enter full screen mode
      mode = 'SETUP';   // Go to setup

      // Initialize the circle size
      let maxRadius = min(width, height) / 2;
      currentDisplayRadius = map(durationInput, 0, 60, 0, maxRadius);
    }
  } else if (mode === 'SETUP') {
    // Keys to adjust settings
    if (key === '1') {
      durationInput++; // Add 1 second
    } else if (key === '2') {
      if (durationInput > 1) {
        durationInput--; // Subtract 1 second
      }
    } else if (key === '3') {
      beyondInput++; // Add 1 minute to Beyond time
    } else if (key === '4') {
      if (beyondInput > 1) {
        beyondInput--; // Subtract 1 minute
      }
    } else if (key === ' ') {
      // Spacebar starts the timer
      startNewTimer();
    }
  } else if (mode === 'ACTIVE') {
    // Spacebar to go back to Setup
    if (key === ' ') {
      mode = 'SETUP';
      if (timer) timer.reset();
    }
  }
}

// ------------------------------------------------------------------
// SERIAL COMMUNICATION FUNCTIONS
// ------------------------------------------------------------------

// Called when the computer finds a list of USB devices
function gotList(thelist) {
  console.log("Available Serial Ports:");
  // Print each port name to the console
  for (let i = 0; i < thelist.length; i++) {
    console.log(i + " " + thelist[i]);
  }
}

// Called automatically when data arrives from the sensor
function gotData() {
  const currentString = serial.readLine(); // Read the text line sent by the sensor
  trim(currentString); // Remove any extra spaces

  // If the line is empty, do nothing
  if (!currentString) return;

  // We expect data like "value1,value2"
  if (currentString.includes(",")) {
    // 1. Break the text into pieces at the comma
    const inMessage = split(currentString, ",");

    // 2. Check if we have at least two numbers
    if (inMessage.length >= 2) {
      // 3. Convert text to numbers and save them
      sensorValue1 = int(inMessage[0]);
      sensorValue2 = int(inMessage[1]);

      // If in Setup mode, update the duration based on the knob (sensorValue1)
      if (mode === 'SETUP') {
         if (sensorValue1 !== lastSensorValue1) {
             let newVal = max(1, sensorValue1); // Ensure it's at least 1
             durationInput = newVal;
             lastSensorValue1 = sensorValue1;
         }
      }

      // If the button (sensorValue2) is pressed (value is 0)
      // We check 'lastSensor2' to make sure we only trigger once per press
      if (sensorValue2 === 0 && lastSensor2 !== 0) {
        if (mode === 'SETUP') {
          startNewTimer();
        }
      }
      lastSensor2 = sensorValue2; // Remember for next time
    }
  }
}
