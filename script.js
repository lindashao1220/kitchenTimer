//more reference: https://openprocessing.org/sketch/773556
//https://editor.p5js.org/Sophi333/sketches/2f2tUOTEB


let timer = null;
let durationInput;

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
  serial = new p5.SerialPort();
  serial.on("list", gotList);
  serial.on("data", gotData);
  serial.list();
  serial.open(portName);
  textSize(32);
  textAlign(CENTER, CENTER);
  
  // Create input field for duration
  durationInput = createInput('5');
  durationInput.position(20, 20);
  durationInput.size(100);
  durationInput.attribute('type', 'number');
  durationInput.attribute('min', '1');
  durationInput.attribute('placeholder', 'Duration (seconds)');
  
  // Create label for duration input
  let durationLabel = createElement('label', 'Duration (seconds):');
  durationLabel.position(20, 0);
  durationLabel.style('color', 'white');
  durationLabel.style('font-family', 'Arial');

  // Create start button
  let startButton = createButton('Start Timer');
  startButton.position(20, 50);
  startButton.mousePressed(startNewTimer);
}

function startNewTimer() {
  let duration = parseFloat(durationInput.value()) || 5;
  // Use a fixed color (greenish) with transparency handled in CircleTimer
  const color = [255, 255, 255];
  // Increase radius for a larger initial circle
  timer = new CircleTimer(duration, width / 2, height / 2, 300, color);
  timer.start();
}

function draw() {
  background(30);
  // Update and draw single timer
  if (timer) {
    timer.update();
    timer.draw();
  }

  // Show incoming sensor values
  fill(255);
  textSize(24);
  text(sensorValue1, width / 2, height / 2 - 40);
  text(sensorValue2, width / 2, height / 2);
  textSize(14);
  text("Sensor 1", width / 2, height / 2 - 60);
  text("Sensor 2", width / 2, height / 2 - 20);
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

      // Let sensorValue1 control the duration input (keep it numeric and >=1)
      if (durationInput) {
        const durVal = max(1, sensorValue1);
        durationInput.value(durVal);
      }

      // If sensorValue2 is 0, trigger start (debounced on change to 0)
      if (sensorValue2 === 0 && lastSensor2 !== 0) {
        startNewTimer();
      }
      lastSensor2 = sensorValue2;

      // Log the updated values
      console.log("Received: ", sensorValue1, ",", sensorValue2);
    }
  }
}



// ------------------------------------------------------------------

// Send '1' to the Arduino when the mouse is pressed
// function mousePressed() {
//   if (serial) {
//     serial.write("1");
//     console.log("Sent: 1");
//   }
// }

// // Send '0' to the Arduino when the mouse is released
// function mouseReleased() {
//   if (serial) {
//     serial.write("0");
//     console.log("Sent: 0");
//   }
// }
